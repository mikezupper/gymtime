use super::{
    Execution, NoticeIntent, ResourceRef, ScheduleError, ScheduleService,
    commands::ScheduleAction,
    ports::{Recipients, ScheduleTransaction},
    setup::{organizer, outcome, primary, version},
};
use gymtime_domain::{
    GymSpace, Instant, Interval,
    auth::{AccountRole, UserId},
    schedule::*,
};

fn executed(resources: Vec<ResourceRef>, notices: Vec<NoticeIntent>) -> Execution {
    Execution {
        outcome: outcome(resources),
        notices,
    }
}
fn available(service: &ScheduleService) -> NoticeIntent {
    NoticeIntent {
        recipients: Recipients::ActiveCoaches,
        subject: "New slot available".to_owned(),
        text: format!(
            "New gym time is available. Open {}/app/calendar to view the current slots and request a time.",
            service.public_url
        ),
    }
}
fn assignment(service: &ScheduleService, team: TeamId) -> NoticeIntent {
    NoticeIntent {
        recipients: Recipients::Teams(vec![team]),
        subject: "Your Gymtime team assignment".to_owned(),
        text: format!(
            "Your gym organizer has updated your team assignment. Sign in at {}/sign-in with this email address. Primary coaches can request, change, cancel, and swap bookings. Assistant coaches can view the same schedule and receive team notifications.",
            service.public_url
        ),
    }
}
/// # Errors
/// Returns permission, version, calendar, or storage errors for organizer setup actions.
pub async fn execute(
    service: &ScheduleService,
    tx: &mut dyn ScheduleTransaction,
    actor: UserId,
    snapshot: &ScheduleSnapshot,
    command: &ScheduleAction,
    now: Instant,
) -> Result<Option<Execution>, ScheduleError> {
    let result = match command {
        ScheduleAction::InviteAccount { email, role } => {
            organizer(tx, actor).await?;
            let existing = tx.account_by_email(email).await?;
            let changed = existing.as_ref().is_none_or(|a| {
                a.status == gymtime_domain::auth::AccountStatus::Disabled
                    || *role == AccountRole::Organizer && !a.actor.organizer
            });
            let invited = tx.invite(email, *role).await?;
            if changed {
                let message=crate::EmailMessage::new(invited.email,"You're invited to Gymtime".to_owned(),format!("Your gym organizer invited you to Gymtime. Sign in at {}/sign-in with this email address to receive a six-digit code.",service.public_url)).map_err(|_|crate::auth::AuthError::Unavailable)?;
                tx.enqueue(invited.id, &service.crypto.token()?, &message, now)
                    .await?;
            }
            executed(vec![ResourceRef::User(invited.id)], vec![])
        }
        ScheduleAction::SetAccountStatus { user, status } => {
            organizer(tx, actor).await?;
            let accounts = tx.accounts().await?;
            let account = accounts
                .iter()
                .find(|a| a.actor.id == *user)
                .ok_or(ScheduleError::NotFound)?;
            if *status == gymtime_domain::auth::AccountStatus::Disabled
                && account.actor.organizer
                && account.status == gymtime_domain::auth::AccountStatus::Enabled
                && accounts
                    .iter()
                    .filter(|a| {
                        a.actor.organizer
                            && a.status == gymtime_domain::auth::AccountStatus::Enabled
                    })
                    .count()
                    <= 1
            {
                return Err(ScheduleError::LastOrganizer);
            }
            tx.set_account_status(*user, *status).await?;
            executed(vec![ResourceRef::User(*user)], vec![])
        }
        ScheduleAction::MarkNoticeRead { id } => {
            if !tx.mark_notice_read(actor, id, now).await? {
                return Err(ScheduleError::NotFound);
            }
            executed(vec![], vec![])
        }
        ScheduleAction::RetryEmail { id } => {
            organizer(tx, actor).await?;
            if !tx.retry_email(id, now).await? {
                return Err(ScheduleError::InvalidTransition);
            }
            executed(vec![], vec![])
        }
        ScheduleAction::ConfigureGym {
            name,
            timezone,
            split,
            hours,
            version: expected,
        } => {
            organizer(tx, actor).await?;
            version(*expected, snapshot.gym.version)?;
            if *split == SplitMode::WholeOnly
                && (snapshot.bookings.iter().any(|b| {
                    b.status == BookingStatus::Confirmed
                        && snapshot
                            .slot(b.slot)
                            .is_some_and(|s| s.space != GymSpace::Full && s.interval.end() > now)
                }) || snapshot.requests.iter().any(|r| {
                    r.status == RequestStatus::Pending
                        && snapshot.slot(r.slot).is_some_and(|slot| {
                            slot.space != GymSpace::Full && slot.interval.end() > now
                        })
                }))
            {
                return Err(ScheduleError::OccupiedSlot);
            }
            let v = tx
                .save_gym(name, *timezone, *split, hours, *expected)
                .await?;
            executed(vec![ResourceRef::Gym(v)], vec![])
        }
        ScheduleAction::CreateSeason { name, dates } => {
            organizer(tx, actor).await?;
            executed(
                vec![ResourceRef::Season(tx.create_season(name, *dates).await?)],
                vec![],
            )
        }
        ScheduleAction::EditSeason {
            id,
            name,
            dates,
            version: expected,
        } => {
            organizer(tx, actor).await?;
            let s = snapshot.season(*id).ok_or(ScheduleError::NotFound)?;
            version(*expected, s.version)?;
            if s.status == SeasonStatus::Closed {
                return Err(ScheduleError::Inactive);
            }
            if snapshot
                .slots
                .iter()
                .any(|slot| slot.season == *id && !dates.contains(slot.date))
            {
                return Err(ScheduleValueError::Range.into());
            }
            tx.edit_season(*id, name, *dates, *expected).await?;
            executed(vec![ResourceRef::Season(*id)], vec![])
        }
        ScheduleAction::SetSeasonStatus {
            id,
            status,
            version: expected,
        } => {
            organizer(tx, actor).await?;
            let s = snapshot.season(*id).ok_or(ScheduleError::NotFound)?;
            version(*expected, s.version)?;
            match (s.status, *status) {
                (SeasonStatus::Draft, SeasonStatus::Active | SeasonStatus::Closed)
                | (SeasonStatus::Active, SeasonStatus::Closed) => {}
                (SeasonStatus::Draft, SeasonStatus::Draft)
                | (SeasonStatus::Active, SeasonStatus::Active)
                | (SeasonStatus::Closed, SeasonStatus::Closed) => {
                    return Ok(Some(executed(vec![ResourceRef::Season(*id)], vec![])));
                }
                (SeasonStatus::Closed, SeasonStatus::Draft | SeasonStatus::Active)
                | (SeasonStatus::Active, SeasonStatus::Draft) => {
                    return Err(ScheduleError::InvalidTransition);
                }
            }
            if *status == SeasonStatus::Active
                && snapshot
                    .seasons
                    .iter()
                    .any(|s| s.status == SeasonStatus::Active && s.id != *id)
            {
                return Err(ScheduleError::ActiveSeasonExists);
            }
            tx.set_season_status(*id, *status, *expected).await?;
            executed(
                vec![ResourceRef::Season(*id)],
                if *status == SeasonStatus::Active {
                    vec![available(service)]
                } else {
                    vec![]
                },
            )
        }
        ScheduleAction::CreateTeam {
            name,
            primary: email,
            season,
        } => {
            organizer(tx, actor).await?;
            snapshot.season(*season).ok_or(ScheduleError::NotFound)?;
            let primary = tx.invite(email, AccountRole::Coach).await?;
            let id = tx
                .create_team(name, primary.id, *season, &service.crypto.token()?)
                .await?;
            executed(vec![ResourceRef::Team(id)], vec![assignment(service, id)])
        }
        ScheduleAction::EditTeam {
            id,
            name,
            primary: email,
            version: expected,
        } => {
            organizer(tx, actor).await?;
            let team = snapshot.team(*id).ok_or(ScheduleError::NotFound)?;
            version(*expected, team.version)?;
            let primary = tx.invite(email, AccountRole::Coach).await?;
            tx.edit_team(*id, name, primary.id, *expected).await?;
            executed(vec![ResourceRef::Team(*id)], vec![assignment(service, *id)])
        }
        ScheduleAction::AssignAssistant {
            team,
            email,
            remove,
            version: expected,
        } => {
            organizer(tx, actor).await?;
            let t = snapshot.team(*team).ok_or(ScheduleError::NotFound)?;
            version(*expected, t.version)?;
            let user = if *remove {
                tx.account_by_email(email)
                    .await?
                    .ok_or(ScheduleError::NotFound)?
                    .actor
                    .id
            } else {
                tx.invite(email, AccountRole::Coach).await?.id
            };
            if user == t.primary {
                return Err(ScheduleError::InvalidTransition);
            }
            tx.assign_assistant(*team, user, *remove, *expected).await?;
            executed(
                vec![ResourceRef::Team(*team)],
                if *remove {
                    vec![]
                } else {
                    vec![assignment(service, *team)]
                },
            )
        }
        ScheduleAction::AssignTeamSeason {
            team,
            season,
            version: expected,
        } => {
            organizer(tx, actor).await?;
            let t = snapshot.team(*team).ok_or(ScheduleError::NotFound)?;
            version(*expected, t.version)?;
            snapshot.season(*season).ok_or(ScheduleError::NotFound)?;
            tx.assign_team_season(*team, *season, *expected).await?;
            executed(
                vec![ResourceRef::Team(*team)],
                vec![assignment(service, *team)],
            )
        }
        ScheduleAction::RotateTeamLink {
            team,
            version: expected,
        } => {
            let t = snapshot.team(*team).ok_or(ScheduleError::NotFound)?;
            primary(tx, actor, t).await?;
            version(*expected, t.version)?;
            tx.rotate_team_link(*team, &service.crypto.token()?, *expected)
                .await?;
            executed(vec![ResourceRef::Team(*team)], vec![])
        }
        ScheduleAction::CreateSlots {
            season,
            dates,
            weekdays,
            hours,
            space,
        } => {
            organizer(tx, actor).await?;
            let s = snapshot.season(*season).ok_or(ScheduleError::NotFound)?;
            if s.status == SeasonStatus::Closed {
                return Err(ScheduleError::Inactive);
            }
            let slots = expand_slots(snapshot.gym.timezone, *dates, weekdays, *hours, *space)
                .into_iter()
                .map(|(_, s)| s.map_err(ScheduleError::from))
                .collect::<Result<Vec<_>, _>>()?;
            if slots.is_empty() {
                return Err(ScheduleValueError::Selection.into());
            }
            for slot in &slots {
                validate_slot(snapshot, s, slot)?;
            }
            let ids = tx.create_slots(*season, &slots).await?;
            let notices = if !ids.is_empty() && s.status == SeasonStatus::Active {
                vec![available(service)]
            } else {
                vec![]
            };
            executed(ids.into_iter().map(ResourceRef::Slot).collect(), notices)
        }
        ScheduleAction::EditSlot {
            id,
            date,
            hours,
            space,
            version: expected,
        } => {
            organizer(tx, actor).await?;
            let slot = snapshot.slot(*id).ok_or(ScheduleError::NotFound)?;
            version(*expected, slot.version)?;
            if snapshot
                .season(slot.season)
                .is_some_and(|season| season.status == SeasonStatus::Closed)
            {
                return Err(ScheduleError::Inactive);
            }
            if slot.interval.start() <= now {
                return Err(ScheduleError::Past);
            }
            unoccupied(snapshot, *id)?;
            let interval = Interval::new(
                snapshot.gym.timezone.resolve(*date, hours.start())?,
                snapshot.gym.timezone.resolve(*date, hours.end())?,
            )
            .map_err(|_| ScheduleValueError::Range)?;
            if interval.start() <= now {
                return Err(ScheduleError::Past);
            }
            let occurrence = SlotOccurrence {
                date: *date,
                hours: *hours,
                interval,
                space: *space,
            };
            let s = snapshot
                .season(slot.season)
                .ok_or(ScheduleError::NotFound)?;
            validate_slot(snapshot, s, &occurrence)?;
            tx.edit_slot(*id, &occurrence, *expected).await?;
            executed(
                vec![ResourceRef::Slot(*id)],
                if s.status == SeasonStatus::Active {
                    vec![available(service)]
                } else {
                    vec![]
                },
            )
        }
        ScheduleAction::SetSlotEnabled {
            id,
            enabled,
            version: expected,
        } => {
            organizer(tx, actor).await?;
            let slot = snapshot.slot(*id).ok_or(ScheduleError::NotFound)?;
            version(*expected, slot.version)?;
            if snapshot
                .season(slot.season)
                .is_some_and(|season| season.status == SeasonStatus::Closed)
            {
                return Err(ScheduleError::Inactive);
            }
            if slot.interval.start() <= now {
                return Err(ScheduleError::Past);
            }
            unoccupied(snapshot, *id)?;
            tx.set_slot_enabled(*id, *enabled, *expected).await?;
            executed(
                vec![ResourceRef::Slot(*id)],
                if *enabled
                    && snapshot
                        .season(slot.season)
                        .is_some_and(|s| s.status == SeasonStatus::Active)
                    && !snapshot.closed(slot)
                {
                    vec![available(service)]
                } else {
                    vec![]
                },
            )
        }
        ScheduleAction::CloseGym { .. }
        | ScheduleAction::ReopenGym { .. }
        | ScheduleAction::SubmitRequests { .. }
        | ScheduleAction::EditRequest { .. }
        | ScheduleAction::WithdrawRequests { .. }
        | ScheduleAction::DecideRequests { .. }
        | ScheduleAction::BookDirectly { .. }
        | ScheduleAction::CancelBooking { .. }
        | ScheduleAction::ChangeBooking { .. }
        | ScheduleAction::MoveBooking { .. }
        | ScheduleAction::ProposeSwap { .. }
        | ScheduleAction::RespondSwap { .. }
        | ScheduleAction::WithdrawSwap { .. } => return Ok(None),
    };
    Ok(Some(result))
}
fn unoccupied(s: &ScheduleSnapshot, id: SlotId) -> Result<(), ScheduleError> {
    if s.bookings
        .iter()
        .any(|b| b.slot == id && b.status == BookingStatus::Confirmed)
        || s.requests
            .iter()
            .any(|r| r.slot == id && r.status == RequestStatus::Pending)
    {
        return Err(ScheduleError::OccupiedSlot);
    }
    Ok(())
}
pub(super) fn validate_slot(
    snapshot: &ScheduleSnapshot,
    season: &Season,
    slot: &SlotOccurrence,
) -> Result<(), ScheduleError> {
    if !season.dates.contains(slot.date) {
        return Err(ScheduleValueError::Range.into());
    }
    if slot.space != GymSpace::Full && snapshot.gym.split == SplitMode::WholeOnly {
        return Err(ScheduleError::SplitDisabled);
    }
    if !snapshot
        .gym
        .hours
        .on(slot.date)
        .is_some_and(|hours| hours.contains(slot.hours))
    {
        return Err(ScheduleError::OutsideHours);
    }
    Ok(())
}
