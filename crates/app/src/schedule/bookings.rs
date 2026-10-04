use super::{
    ActionOutcome, Execution, NoticeIntent, ResourceRef, ScheduleError, ScheduleService,
    ScheduleWarning,
    commands::{BookingEdit, NewBooking, NewRequest, ScheduleAction as A},
    ports::{Recipients, ScheduleTransaction},
    setup::{outcome, version},
};
use crate::auth::AuthError;
use gymtime_domain::{GymSpace, Instant, auth::UserId, schedule::*};

pub(super) fn notice(
    service: &ScheduleService,
    recipients: Recipients,
    title: &str,
    text: String,
) -> NoticeIntent {
    NoticeIntent {
        recipients,
        subject: title.to_owned(),
        text: format!(
            "{text}\n\nView the current gym calendar at {}/app/calendar.",
            service.public_url
        ),
    }
}
pub(super) fn execution(resources: Vec<ResourceRef>, notices: Vec<NoticeIntent>) -> Execution {
    Execution {
        outcome: outcome(resources),
        notices,
    }
}
pub(super) fn next(v: Version) -> Result<Version, ScheduleError> {
    Ok(Version::try_from(
        v.get().checked_add(1).ok_or(ScheduleError::Stale)?,
    )?)
}
pub(super) fn one() -> Result<Version, ScheduleError> {
    Ok(Version::try_from(1)?)
}
pub(super) fn available<'a>(
    s: &'a ScheduleSnapshot,
    id: SlotId,
    now: Instant,
    except: &[BookingId],
) -> Result<&'a Slot, ScheduleError> {
    let slot = s.slot(id).ok_or(ScheduleError::NotFound)?;
    if s.season(slot.season).ok_or(ScheduleError::NotFound)?.status != SeasonStatus::Active {
        return Err(ScheduleError::Inactive);
    }
    if slot.interval.end() <= now {
        return Err(ScheduleError::Past);
    }
    if !slot.enabled || s.closed(slot) || !s.conflicting_bookings(slot, except).is_empty() {
        return Err(ScheduleError::Unavailable);
    }
    if slot.space != GymSpace::Full && s.gym.split == SplitMode::WholeOnly {
        return Err(ScheduleError::SplitDisabled);
    }
    Ok(slot)
}
fn team_slot(s: &ScheduleSnapshot, team: TeamId, slot: &Slot) -> Result<(), ScheduleError> {
    if !s
        .team(team)
        .ok_or(ScheduleError::NotFound)?
        .seasons
        .contains(&slot.season)
    {
        return Err(ScheduleError::Inactive);
    }
    Ok(())
}
pub(super) fn coach_overlap(
    s: &ScheduleSnapshot,
    team: TeamId,
    slot: &Slot,
    except: &[BookingId],
) -> bool {
    let Some(primary) = s.team(team).map(|team| team.primary) else {
        return false;
    };
    s.bookings
        .iter()
        .filter(|b| b.status == BookingStatus::Confirmed && !except.contains(&b.id))
        .any(|b| {
            s.team(b.team).is_some_and(|t| t.primary == primary)
                && s.slot(b.slot)
                    .is_some_and(|other| slot.interval.overlaps(other.interval))
        })
}
pub(super) async fn edit_booking(
    tx: &mut dyn ScheduleTransaction,
    s: &mut ScheduleSnapshot,
    edit: BookingEdit,
) -> Result<(), ScheduleError> {
    tx.edit_booking(&edit).await?;
    let b = s
        .bookings
        .iter_mut()
        .find(|b| b.id == edit.id)
        .ok_or(ScheduleError::NotFound)?;
    b.slot = edit.slot;
    b.activity = edit.activity;
    b.note = edit.note;
    b.status = edit.status;
    b.version = next(b.version)?;
    b.changed = edit.now;
    Ok(())
}
async fn request_status(
    tx: &mut dyn ScheduleTransaction,
    s: &mut ScheduleSnapshot,
    id: RequestId,
    status: RequestStatus,
) -> Result<(), ScheduleError> {
    let r = s
        .requests
        .iter_mut()
        .find(|r| r.id == id)
        .ok_or(ScheduleError::NotFound)?;
    tx.set_request_status(id, status, r.version).await?;
    r.status = status;
    r.version = next(r.version)?;
    Ok(())
}
async fn new_booking(
    tx: &mut dyn ScheduleTransaction,
    s: &mut ScheduleSnapshot,
    value: NewBooking,
) -> Result<BookingId, ScheduleError> {
    let id = tx.create_booking(&value).await?;
    s.bookings.push(Booking {
        id,
        team: value.team,
        slot: value.slot,
        series: value.series,
        calendar_uid: value.calendar_uid,
        activity: value.activity,
        note: value.note,
        status: BookingStatus::Confirmed,
        version: one()?,
        created: value.now,
        changed: value.now,
    });
    Ok(id)
}

fn selected_bookings(
    s: &ScheduleSnapshot,
    id: BookingId,
    scope: SeriesScope,
    now: Instant,
) -> Result<Vec<Booking>, ScheduleError> {
    let source = s.booking(id).ok_or(ScheduleError::NotFound)?;
    let source_slot = s.slot(source.slot).ok_or(ScheduleError::NotFound)?;
    if s.season(source_slot.season)
        .ok_or(ScheduleError::NotFound)?
        .status
        != SeasonStatus::Active
    {
        return Err(ScheduleError::Inactive);
    }
    if source.status != BookingStatus::Confirmed {
        return Err(ScheduleError::InvalidTransition);
    }
    if source_slot.interval.end() <= now {
        return Err(ScheduleError::Past);
    }
    let mut selected = s
        .bookings
        .iter()
        .filter(|b| {
            b.status == BookingStatus::Confirmed
                && b.team == source.team
                && s.slot(b.slot).is_some_and(|slot| slot.interval.end() > now)
        })
        .filter(|b| match scope {
            SeriesScope::One => b.id == id,
            SeriesScope::Future => {
                source.series.is_some()
                    && b.series == source.series
                    && s.slot(b.slot)
                        .is_some_and(|slot| slot.interval.start() >= source_slot.interval.start())
                    || b.id == id
            }
            SeriesScope::Remaining => {
                source.series.is_some() && b.series == source.series || b.id == id
            }
        })
        .cloned()
        .collect::<Vec<_>>();
    selected.sort_by_key(|b| s.slot(b.slot).map(|slot| (slot.interval.start(), b.id)));
    Ok(selected)
}
pub(super) async fn invalidate_related(
    service: &ScheduleService,
    tx: &mut dyn ScheduleTransaction,
    s: &mut ScheduleSnapshot,
    bookings: &[BookingId],
    ignore_request: &[RequestId],
    ignore_swap: &[SwapId],
) -> Result<Vec<NoticeIntent>, ScheduleError> {
    let invalid_requests = s
        .requests
        .iter()
        .filter(|r| {
            r.status == RequestStatus::Pending
                && !ignore_request.contains(&r.id)
                && r.replacement
                    .as_ref()
                    .is_some_and(|old| bookings.contains(&old.booking))
        })
        .map(|r| (r.id, r.team))
        .collect::<Vec<_>>();
    for (id, _) in &invalid_requests {
        request_status(tx, s, *id, RequestStatus::Invalidated).await?;
    }
    let invalid_swaps = s
        .swaps
        .iter()
        .filter(|swap| {
            swap.status == SwapStatus::Pending
                && !ignore_swap.contains(&swap.id)
                && (bookings.contains(&swap.first) || bookings.contains(&swap.second))
        })
        .map(|swap| (swap.id, swap.first, swap.second, swap.version))
        .collect::<Vec<_>>();
    let mut teams = invalid_requests
        .into_iter()
        .map(|(_, team)| team)
        .collect::<Vec<_>>();
    for (id, first, second, version) in invalid_swaps {
        for booking in [first, second] {
            teams.push(s.booking(booking).ok_or(ScheduleError::NotFound)?.team);
        }
        tx.set_swap_status(id, SwapStatus::Invalidated, version)
            .await?;
        let swap = s
            .swaps
            .iter_mut()
            .find(|swap| swap.id == id)
            .ok_or(ScheduleError::NotFound)?;
        swap.status = SwapStatus::Invalidated;
        swap.version = next(swap.version)?;
    }
    teams.sort_unstable();
    teams.dedup();
    Ok(if teams.is_empty() {
        vec![]
    } else {
        vec![notice(service,Recipients::Teams(teams),"Proposal no longer available","An original booking changed or was cancelled. Related change requests and swaps can no longer complete. Confirmed bookings keep their current times; submit a new proposal if needed.".to_owned())]
    })
}
pub(super) async fn cancel_competing(
    tx: &mut dyn ScheduleTransaction,
    s: &mut ScheduleSnapshot,
    slot: SlotId,
    except: &[RequestId],
) -> Result<Vec<TeamId>, ScheduleError> {
    let slot = s.slot(slot).ok_or(ScheduleError::NotFound)?;
    let ids = s.competing_requests(slot, except);
    let mut teams = vec![];
    for id in ids {
        teams.push(
            s.requests
                .iter()
                .find(|r| r.id == id)
                .ok_or(ScheduleError::NotFound)?
                .team,
        );
        request_status(tx, s, id, RequestStatus::ConflictCancelled).await?;
    }
    Ok(teams)
}

/// # Errors
/// Returns typed scheduling, permission, version and storage failures, with rollback protection.
pub async fn execute(
    service: &ScheduleService,
    tx: &mut dyn ScheduleTransaction,
    actor: UserId,
    s: &mut ScheduleSnapshot,
    c: &A,
    now: Instant,
) -> Result<Execution, ScheduleError> {
    match c {
        A::SubmitRequests {
            team,
            slots,
            activity,
            note,
            reason,
        } => {
            let first = slots.items().first().ok_or(ScheduleValueError::Selection)?;
            let season = available(s, *first, now, &[])?.season;
            let series = if slots.items().len() > 1 {
                let id = service.crypto.token()?;
                tx.create_series(&id, *team, season).await?;
                Some(id)
            } else {
                None
            };
            let mut resources = vec![];
            for slot_id in slots.items() {
                let slot = available(s, *slot_id, now, &[])?;
                team_slot(s, *team, slot)?;
                if slot.season != season {
                    return Err(ScheduleError::Inactive);
                }
                if s.requests.iter().any(|r| {
                    r.status == RequestStatus::Pending && r.team == *team && r.slot == *slot_id
                }) {
                    return Err(ScheduleError::InvalidTransition);
                }
                if !s.competing_requests(slot, &[]).is_empty() && reason.is_empty() {
                    return Err(ScheduleError::CompetingReason);
                }
                let id = tx
                    .create_request(&NewRequest {
                        team: *team,
                        slot: *slot_id,
                        series: series.clone(),
                        activity: *activity,
                        note: note.clone(),
                        reason: reason.clone(),
                        replacement: None,
                        creator: actor,
                        created: now,
                    })
                    .await?;
                s.requests.push(BookingRequest {
                    id,
                    team: *team,
                    slot: *slot_id,
                    series: series.clone(),
                    activity: *activity,
                    note: note.clone(),
                    reason: reason.clone(),
                    status: RequestStatus::Pending,
                    replacement: None,
                    creator: actor,
                    created: now,
                    version: one()?,
                });
                resources.push(ResourceRef::Request(id));
            }
            Ok(execution(
                resources,
                vec![notice(
                    service,
                    Recipients::Organizers,
                    "New booking request",
                    format!(
                        "{} requested {} occurrence(s).{}",
                        s.team(*team).ok_or(ScheduleError::NotFound)?.name.as_str(),
                        slots.items().len(),
                        if reason.is_empty() {
                            String::new()
                        } else {
                            format!("\n\nCompeting-request reason: {}", reason.as_str())
                        }
                    ),
                )],
            ))
        }
        A::EditRequest {
            id,
            slot,
            activity,
            note,
            reason,
            version: expected,
        } => {
            let old = s
                .requests
                .iter()
                .find(|r| r.id == *id)
                .ok_or(ScheduleError::NotFound)?
                .clone();
            version(*expected, old.version)?;
            if old.status != RequestStatus::Pending {
                return Err(ScheduleError::InvalidTransition);
            }
            if let Some(original) = &old.replacement {
                let booking = s.booking(original.booking).ok_or(ScheduleError::NotFound)?;
                version(original.version, booking.version)?;
                if booking.status != BookingStatus::Confirmed {
                    return Err(ScheduleError::InvalidTransition);
                }
            }
            let except = old
                .replacement
                .as_ref()
                .map(|r| vec![r.booking])
                .unwrap_or_default();
            let target = available(s, *slot, now, &except)?;
            team_slot(s, old.team, target)?;
            if target.season != s.slot(old.slot).ok_or(ScheduleError::NotFound)?.season {
                return Err(ScheduleError::Inactive);
            }
            if !s.competing_requests(target, &[*id]).is_empty() && reason.is_empty() {
                return Err(ScheduleError::CompetingReason);
            }
            tx.edit_request(*id, *slot, *activity, note, reason, *expected)
                .await?;
            let r = s
                .requests
                .iter_mut()
                .find(|r| r.id == *id)
                .ok_or(ScheduleError::NotFound)?;
            r.slot = *slot;
            r.activity = *activity;
            r.note = note.clone();
            r.reason = reason.clone();
            r.version = next(r.version)?;
            Ok(execution(vec![ResourceRef::Request(*id)],vec![notice(service,Recipients::Organizers,"Booking request updated","A primary coach updated a pending booking request. Review the current time, gym space, and reason before deciding.".to_owned())]))
        }
        A::WithdrawRequests { ids } => {
            for id in ids.items() {
                let r = s
                    .requests
                    .iter()
                    .find(|r| r.id == *id)
                    .ok_or(ScheduleError::NotFound)?;
                if r.status != RequestStatus::Pending {
                    return Err(ScheduleError::InvalidTransition);
                }
                let slot = s.slot(r.slot).ok_or(ScheduleError::NotFound)?;
                if s.season(slot.season).ok_or(ScheduleError::NotFound)?.status
                    != SeasonStatus::Active
                {
                    return Err(ScheduleError::Inactive);
                }
                if s.slot(r.slot)
                    .ok_or(ScheduleError::NotFound)?
                    .interval
                    .end()
                    <= now
                {
                    return Err(ScheduleError::Past);
                }
                request_status(tx, s, *id, RequestStatus::Withdrawn).await?;
            }
            Ok(execution(
                ids.items()
                    .iter()
                    .map(|id| ResourceRef::Request(*id))
                    .collect(),
                vec![notice(
                    service,
                    Recipients::Organizers,
                    "Booking request withdrawn",
                    format!(
                        "A primary coach withdrew {} pending occurrence(s). They can no longer be approved.",
                        ids.items().len()
                    ),
                )],
            ))
        }
        A::DecideRequests { decisions } => decide(service, tx, s, decisions, now).await,
        A::BookDirectly {
            team,
            slots,
            activity,
            note,
        } => {
            let season = available(
                s,
                *slots.items().first().ok_or(ScheduleValueError::Selection)?,
                now,
                &[],
            )?
            .season;
            let series = if slots.items().len() > 1 {
                let id = service.crypto.token()?;
                tx.create_series(&id, *team, season).await?;
                Some(id)
            } else {
                None
            };
            let mut resources = vec![];
            let mut teams = vec![*team];
            let mut warnings = vec![];
            for slot_id in slots.items() {
                let slot = available(s, *slot_id, now, &[])?;
                team_slot(s, *team, slot)?;
                if slot.season != season {
                    return Err(ScheduleError::Inactive);
                }
                if coach_overlap(s, *team, slot, &[]) {
                    warnings.push(ScheduleWarning::CoachOverlap);
                }
                let id = new_booking(
                    tx,
                    s,
                    NewBooking {
                        team: *team,
                        slot: *slot_id,
                        series: series.clone(),
                        calendar_uid: service.crypto.token()?,
                        activity: *activity,
                        note: note.clone(),
                        now,
                    },
                )
                .await?;
                resources.push(ResourceRef::Booking(id));
                teams.extend(cancel_competing(tx, s, *slot_id, &[]).await?);
            }
            let mut result = execution(
                resources,
                vec![notice(
                    service,
                    Recipients::Teams(teams),
                    "Booking confirmed",
                    format!(
                        "The organizer confirmed {} occurrence(s). Conflicting pending requests were cancelled.",
                        slots.items().len()
                    ),
                )],
            );
            result.outcome.warnings = warnings;
            Ok(result)
        }
        A::CancelBooking {
            id,
            scope,
            version: expected,
        } => {
            version(
                *expected,
                s.booking(*id).ok_or(ScheduleError::NotFound)?.version,
            )?;
            let selected = selected_bookings(s, *id, *scope, now)?;
            let organizer = tx
                .actor_by_id(actor)
                .await?
                .ok_or(AuthError::Unauthenticated)?
                .organizer;
            let team = s.booking(*id).ok_or(ScheduleError::NotFound)?.team;
            let mut changed = vec![];
            for b in selected {
                edit_booking(
                    tx,
                    s,
                    BookingEdit {
                        id: b.id,
                        slot: b.slot,
                        activity: b.activity,
                        note: b.note,
                        status: if organizer {
                            BookingStatus::OrganizerCancelled
                        } else {
                            BookingStatus::CoachCancelled
                        },
                        version: b.version,
                        now,
                    },
                )
                .await?;
                changed.push(b.id);
            }
            let mut notices = invalidate_related(service, tx, s, &changed, &[], &[]).await?;
            notices.push(notice(
                service,
                if organizer {
                    Recipients::Teams(vec![team])
                } else {
                    Recipients::OrganizersAndTeams(vec![team])
                },
                "Booking cancelled",
                format!(
                    "{} occurrence(s) were cancelled. Completed dates remain unchanged.",
                    changed.len()
                ),
            ));
            Ok(execution(
                changed.into_iter().map(ResourceRef::Booking).collect(),
                notices,
            ))
        }
        A::ChangeBooking {
            id,
            scope,
            slots,
            activity,
            note,
            reason,
            version: expected,
        } => {
            version(
                *expected,
                s.booking(*id).ok_or(ScheduleError::NotFound)?.version,
            )?;
            let selected = selected_bookings(s, *id, *scope, now)?;
            if selected.len() != slots.items().len() {
                return Err(ScheduleValueError::Selection.into());
            }
            let team = s.booking(*id).ok_or(ScheduleError::NotFound)?.team;
            let mut targets = slots
                .items()
                .iter()
                .map(|id| s.slot(*id).cloned().ok_or(ScheduleError::NotFound))
                .collect::<Result<Vec<_>, _>>()?;
            targets.sort_by_key(|slot| (slot.interval.start(), slot.id));
            let mut resources = vec![];
            for (b, target) in selected.into_iter().zip(targets) {
                let slot = available(s, target.id, now, &[b.id])?;
                team_slot(s, team, slot)?;
                if s.slot(b.slot).ok_or(ScheduleError::NotFound)?.season != slot.season {
                    return Err(ScheduleError::Inactive);
                }
                if !s.competing_requests(slot, &[]).is_empty() && reason.is_empty() {
                    return Err(ScheduleError::CompetingReason);
                }
                if s.requests.iter().any(|r| {
                    r.status == RequestStatus::Pending
                        && r.replacement
                            .as_ref()
                            .is_some_and(|old| old.booking == b.id)
                }) {
                    return Err(ScheduleError::InvalidTransition);
                }
                let replacement = PendingReplacement {
                    booking: b.id,
                    version: b.version,
                };
                let request = NewRequest {
                    team,
                    slot: target.id,
                    series: b.series.clone(),
                    activity: *activity,
                    note: note.clone(),
                    reason: reason.clone(),
                    replacement: Some(replacement.clone()),
                    creator: actor,
                    created: now,
                };
                let rid = tx.create_request(&request).await?;
                s.requests.push(BookingRequest {
                    id: rid,
                    team,
                    slot: target.id,
                    series: b.series,
                    activity: *activity,
                    note: note.clone(),
                    reason: reason.clone(),
                    status: RequestStatus::Pending,
                    replacement: Some(replacement),
                    creator: actor,
                    created: now,
                    version: one()?,
                });
                resources.push(ResourceRef::Request(rid));
            }
            Ok(execution(
                resources,
                vec![notice(
                    service,
                    Recipients::Organizers,
                    "Booking change requested",
                    format!(
                        "A primary coach requested changes to {} occurrence(s). Original bookings remain confirmed until approval.",
                        slots.items().len()
                    ),
                )],
            ))
        }
        A::MoveBooking {
            id,
            slot,
            activity,
            note,
            version: expected,
        } => {
            let old = s.booking(*id).ok_or(ScheduleError::NotFound)?.clone();
            version(*expected, old.version)?;
            if old.status != BookingStatus::Confirmed {
                return Err(ScheduleError::InvalidTransition);
            }
            if s.slot(old.slot)
                .ok_or(ScheduleError::NotFound)?
                .interval
                .end()
                <= now
            {
                return Err(ScheduleError::Past);
            }
            let target = available(s, *slot, now, &[*id])?;
            team_slot(s, old.team, target)?;
            if target.season != s.slot(old.slot).ok_or(ScheduleError::NotFound)?.season {
                return Err(ScheduleError::Inactive);
            }
            let warn = coach_overlap(s, old.team, target, &[*id]);
            edit_booking(
                tx,
                s,
                BookingEdit {
                    id: *id,
                    slot: *slot,
                    activity: *activity,
                    note: note.clone(),
                    status: BookingStatus::Confirmed,
                    version: *expected,
                    now,
                },
            )
            .await?;
            let mut teams = vec![old.team];
            teams.extend(cancel_competing(tx, s, *slot, &[]).await?);
            let mut notices = invalidate_related(service, tx, s, &[*id], &[], &[]).await?;
            notices.push(notice(service,Recipients::Teams(teams),"Booking changed","The organizer changed a confirmed booking. Check your team's current date, time, and gym space.".to_owned()));
            let mut result = execution(vec![ResourceRef::Booking(*id)], notices);
            if warn {
                result.outcome.warnings.push(ScheduleWarning::CoachOverlap);
            }
            Ok(result)
        }
        A::CloseGym {
            interval,
            space,
            reason,
        } => {
            if reason.is_empty() {
                return Err(ScheduleError::ClosureReason);
            }
            if interval.end() <= now {
                return Err(ScheduleError::Past);
            }
            let id = tx.create_closure(*interval, *space, reason).await?;
            let affected = s
                .bookings
                .iter()
                .filter(|b| {
                    b.status == BookingStatus::Confirmed
                        && s.slot(b.slot).is_some_and(|slot| {
                            slot.interval.end() > now
                                && gymtime_domain::conflicts(
                                    (slot.space, slot.interval),
                                    (*space, *interval),
                                )
                        })
                })
                .cloned()
                .collect::<Vec<_>>();
            let mut teams = vec![];
            let mut changed = vec![];
            for b in affected {
                teams.push(b.team);
                changed.push(b.id);
                edit_booking(
                    tx,
                    s,
                    BookingEdit {
                        id: b.id,
                        slot: b.slot,
                        activity: b.activity,
                        note: b.note,
                        status: BookingStatus::ClosureCancelled,
                        version: b.version,
                        now,
                    },
                )
                .await?;
            }
            let requests = s
                .requests
                .iter()
                .filter(|r| {
                    r.status == RequestStatus::Pending
                        && s.slot(r.slot).is_some_and(|slot| {
                            slot.interval.end() > now
                                && gymtime_domain::conflicts(
                                    (slot.space, slot.interval),
                                    (*space, *interval),
                                )
                        })
                })
                .map(|r| (r.id, r.team))
                .collect::<Vec<_>>();
            for (rid, team) in requests {
                teams.push(team);
                request_status(tx, s, rid, RequestStatus::ClosureCancelled).await?;
            }
            let mut notices = invalidate_related(service, tx, s, &changed, &[], &[]).await?;
            if !teams.is_empty() {
                notices.push(notice(service,Recipients::Teams(teams),"Gym time unavailable",format!("The organizer blocked gym time and cancelled {} confirmed occurrence(s).\n\nReason: {}\n\nFinding a replacement time is a separate action.",changed.len(),reason.as_str())));
            }
            let mut resources = vec![ResourceRef::Closure(id)];
            resources.extend(changed.into_iter().map(ResourceRef::Booking));
            Ok(execution(resources, notices))
        }
        A::ReopenGym {
            id,
            version: expected,
        } => {
            let closure = s
                .closures
                .iter()
                .find(|closure| closure.id == *id)
                .ok_or(ScheduleError::NotFound)?;
            version(*expected, closure.version)?;
            if !closure.active {
                return Err(ScheduleError::InvalidTransition);
            }
            if closure.interval.end() <= now {
                return Err(ScheduleError::Past);
            }
            tx.reopen_closure(*id, *expected).await?;
            Ok(execution(vec![ResourceRef::Closure(*id)], vec![]))
        }
        A::ProposeSwap { .. } | A::RespondSwap { .. } | A::WithdrawSwap { .. } => {
            super::swaps::execute(service, tx, actor, s, c, now).await
        }
        A::InviteAccount { .. }
        | A::SetAccountStatus { .. }
        | A::MarkNoticeRead { .. }
        | A::RetryEmail { .. }
        | A::ConfigureGym { .. }
        | A::CreateSeason { .. }
        | A::EditSeason { .. }
        | A::SetSeasonStatus { .. }
        | A::CreateTeam { .. }
        | A::EditTeam { .. }
        | A::AssignAssistant { .. }
        | A::AssignTeamSeason { .. }
        | A::RotateTeamLink { .. }
        | A::CreateSlots { .. }
        | A::EditSlot { .. }
        | A::SetSlotEnabled { .. } => Err(ScheduleError::InvalidTransition),
    }
}

async fn decide(
    service: &ScheduleService,
    tx: &mut dyn ScheduleTransaction,
    s: &mut ScheduleSnapshot,
    decisions: &[super::commands::RequestDecision],
    now: Instant,
) -> Result<Execution, ScheduleError> {
    let ids = decisions.iter().map(|d| d.id).collect::<Vec<_>>();
    Selection::try_from(ids)?;
    for d in decisions {
        let r = s
            .requests
            .iter()
            .find(|r| r.id == d.id)
            .ok_or(ScheduleError::NotFound)?;
        version(d.version, r.version)?;
        if r.status != RequestStatus::Pending {
            return Err(ScheduleError::InvalidTransition);
        }
    }
    let mut result = Execution {
        outcome: ActionOutcome {
            resources: vec![],
            warnings: vec![],
        },
        notices: vec![],
    };
    let mut teams = vec![];
    let mut handled = vec![];
    for d in decisions {
        let r = s
            .requests
            .iter()
            .find(|r| r.id == d.id)
            .ok_or(ScheduleError::NotFound)?
            .clone();
        if handled.contains(&d.id) {
            result
                .outcome
                .warnings
                .push(ScheduleWarning::SomeDatesUnavailable);
            continue;
        }
        teams.push(r.team);
        if s.slot(r.slot)
            .ok_or(ScheduleError::NotFound)?
            .interval
            .end()
            <= now
        {
            return Err(ScheduleError::Past);
        }
        if s.season(s.slot(r.slot).ok_or(ScheduleError::NotFound)?.season)
            .ok_or(ScheduleError::NotFound)?
            .status
            != SeasonStatus::Active
        {
            return Err(ScheduleError::Inactive);
        }
        if !d.approve {
            request_status(tx, s, r.id, RequestStatus::Declined).await?;
            result.outcome.resources.push(ResourceRef::Request(r.id));
            continue;
        }
        let except = r
            .replacement
            .as_ref()
            .map(|old| vec![old.booking])
            .unwrap_or_default();
        match available(s, r.slot, now, &except) {
            Ok(_) => {}
            Err(ScheduleError::Unavailable | ScheduleError::SplitDisabled) => {
                request_status(tx, s, r.id, RequestStatus::ConflictCancelled).await?;
                result.outcome.resources.push(ResourceRef::Request(r.id));
                result
                    .outcome
                    .warnings
                    .push(ScheduleWarning::SomeDatesUnavailable);
                continue;
            }
            Err(error) => return Err(error),
        }
        let target = s.slot(r.slot).ok_or(ScheduleError::NotFound)?;
        if coach_overlap(s, r.team, target, &except) {
            result.outcome.warnings.push(ScheduleWarning::CoachOverlap);
        }
        let bid = if let Some(original) = &r.replacement {
            let b = s.booking(original.booking).ok_or(ScheduleError::NotFound)?;
            version(original.version, b.version)?;
            if b.status != BookingStatus::Confirmed
                || s.slot(b.slot)
                    .ok_or(ScheduleError::NotFound)?
                    .interval
                    .end()
                    <= now
            {
                return Err(ScheduleError::InvalidTransition);
            }
            edit_booking(
                tx,
                s,
                BookingEdit {
                    id: b.id,
                    slot: r.slot,
                    activity: r.activity,
                    note: r.note.clone(),
                    status: BookingStatus::Confirmed,
                    version: b.version,
                    now,
                },
            )
            .await?;
            result.notices.extend(
                invalidate_related(service, tx, s, &[original.booking], &[r.id], &[]).await?,
            );
            original.booking
        } else {
            new_booking(
                tx,
                s,
                NewBooking {
                    team: r.team,
                    slot: r.slot,
                    series: r.series.clone(),
                    calendar_uid: service.crypto.token()?,
                    activity: r.activity,
                    note: r.note.clone(),
                    now,
                },
            )
            .await?
        };
        request_status(tx, s, r.id, RequestStatus::Approved).await?;
        result
            .outcome
            .resources
            .extend([ResourceRef::Request(r.id), ResourceRef::Booking(bid)]);
        let competing =
            s.competing_requests(s.slot(r.slot).ok_or(ScheduleError::NotFound)?, &[r.id]);
        for id in competing {
            teams.push(
                s.requests
                    .iter()
                    .find(|r| r.id == id)
                    .ok_or(ScheduleError::NotFound)?
                    .team,
            );
            request_status(tx, s, id, RequestStatus::ConflictCancelled).await?;
            result.outcome.resources.push(ResourceRef::Request(id));
            handled.push(id);
        }
    }
    result.notices.push(notice(service,Recipients::Teams(teams),"Booking request decision",format!("The organizer decided {} requested occurrence(s). Each date shows whether it was approved, declined, or cancelled by a conflicting approval. Original bookings remain confirmed for declined changes.",decisions.len())));
    Ok(result)
}
