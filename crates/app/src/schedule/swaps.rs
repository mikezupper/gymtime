use super::{
    Execution, ResourceRef, ScheduleError, ScheduleService, ScheduleWarning,
    bookings::{
        available, cancel_competing, coach_overlap, edit_booking, execution, invalidate_related,
        next, notice, one,
    },
    commands::{BookingEdit, NewSwap, ScheduleAction as A},
    ports::{Recipients, ScheduleTransaction},
    setup::version,
};
use gymtime_domain::{Instant, auth::UserId, schedule::*};

/// # Errors
/// Returns stale, unavailable, expired, transition or persistence errors; both sides remain atomic.
pub async fn execute(
    service: &ScheduleService,
    tx: &mut dyn ScheduleTransaction,
    actor: UserId,
    s: &mut ScheduleSnapshot,
    c: &A,
    now: Instant,
) -> Result<Execution, ScheduleError> {
    match c {
        A::ProposeSwap {
            first,
            second,
            first_version,
            second_version,
        } => {
            let a = s.booking(*first).ok_or(ScheduleError::NotFound)?.clone();
            let b = s.booking(*second).ok_or(ScheduleError::NotFound)?.clone();
            version(*first_version, a.version)?;
            version(*second_version, b.version)?;
            if a.status != BookingStatus::Confirmed
                || b.status != BookingStatus::Confirmed
                || a.team == b.team
                || first == second
            {
                return Err(ScheduleError::InvalidTransition);
            }
            let left = available(s, a.slot, now, &[*first, *second])?;
            let right = available(s, b.slot, now, &[*first, *second])?;
            if left.season != right.season {
                return Err(ScheduleError::Inactive);
            }
            let deadline = left.interval.start().min(right.interval.start());
            if now >= deadline {
                return Err(ScheduleError::Past);
            }
            if s.swaps.iter().any(|swap| {
                swap.status == SwapStatus::Pending && swap.first == *first && swap.second == *second
            }) {
                return Err(ScheduleError::InvalidTransition);
            }
            let id = tx
                .create_swap(&NewSwap {
                    first: *first,
                    second: *second,
                    first_version: *first_version,
                    second_version: *second_version,
                    proposer: actor,
                    now,
                    deadline,
                })
                .await?;
            s.swaps.push(Swap {
                id,
                first: *first,
                second: *second,
                first_version: *first_version,
                second_version: *second_version,
                proposer: actor,
                proposed: now,
                deadline,
                status: SwapStatus::Pending,
                version: one()?,
            });
            Ok(execution(
                vec![ResourceRef::Swap(id)],
                vec![notice(
                    service,
                    Recipients::Teams(vec![b.team]),
                    "Gym booking swap requested",
                    format!(
                        "{} proposed swapping a confirmed booking with your team. Your primary coach can accept or decline before the earlier booking begins. Both original bookings remain confirmed until acceptance.",
                        s.team(a.team).ok_or(ScheduleError::NotFound)?.name.as_str()
                    ),
                )],
            ))
        }
        A::RespondSwap {
            id,
            accept,
            version: expected,
        } => {
            let swap = s
                .swaps
                .iter()
                .find(|swap| swap.id == *id)
                .ok_or(ScheduleError::NotFound)?
                .clone();
            version(*expected, swap.version)?;
            if swap.status != SwapStatus::Pending || now >= swap.deadline {
                return Err(ScheduleError::InvalidTransition);
            }
            let a = s
                .booking(swap.first)
                .ok_or(ScheduleError::NotFound)?
                .clone();
            let b = s
                .booking(swap.second)
                .ok_or(ScheduleError::NotFound)?
                .clone();
            if !accept {
                tx.set_swap_status(*id, SwapStatus::Declined, *expected)
                    .await?;
                let current = s
                    .swaps
                    .iter_mut()
                    .find(|swap| swap.id == *id)
                    .ok_or(ScheduleError::NotFound)?;
                current.status = SwapStatus::Declined;
                current.version = next(current.version)?;
                return Ok(execution(vec![ResourceRef::Swap(*id)],vec![notice(service,Recipients::Teams(vec![a.team]),"Swap declined","The other team's primary coach declined your swap. Original bookings keep their current times.".to_owned())]));
            }
            version(swap.first_version, a.version)?;
            version(swap.second_version, b.version)?;
            if a.status != BookingStatus::Confirmed || b.status != BookingStatus::Confirmed {
                return Err(ScheduleError::InvalidTransition);
            }
            let first = available(s, a.slot, now, &[a.id, b.id])?;
            let second = available(s, b.slot, now, &[a.id, b.id])?;
            if first.season != second.season {
                return Err(ScheduleError::Inactive);
            }
            if !s
                .team(a.team)
                .ok_or(ScheduleError::NotFound)?
                .seasons
                .contains(&second.season)
                || !s
                    .team(b.team)
                    .ok_or(ScheduleError::NotFound)?
                    .seasons
                    .contains(&first.season)
            {
                return Err(ScheduleError::Inactive);
            }
            let warning = coach_overlap(s, a.team, second, &[a.id, b.id])
                || coach_overlap(s, b.team, first, &[a.id, b.id]);
            edit_booking(
                tx,
                s,
                BookingEdit {
                    id: a.id,
                    slot: b.slot,
                    activity: a.activity,
                    note: a.note,
                    status: BookingStatus::Confirmed,
                    version: a.version,
                    now,
                },
            )
            .await?;
            edit_booking(
                tx,
                s,
                BookingEdit {
                    id: b.id,
                    slot: a.slot,
                    activity: b.activity,
                    note: b.note,
                    status: BookingStatus::Confirmed,
                    version: b.version,
                    now,
                },
            )
            .await?;
            let mut notices =
                invalidate_related(service, tx, s, &[a.id, b.id], &[], &[*id]).await?;
            let mut teams = vec![a.team, b.team];
            teams.extend(cancel_competing(tx, s, a.slot, &[]).await?);
            teams.extend(cancel_competing(tx, s, b.slot, &[]).await?);
            tx.set_swap_status(*id, SwapStatus::Accepted, *expected)
                .await?;
            let current = s
                .swaps
                .iter_mut()
                .find(|swap| swap.id == *id)
                .ok_or(ScheduleError::NotFound)?;
            current.status = SwapStatus::Accepted;
            current.version = next(current.version)?;
            notices.push(notice(service,Recipients::OrganizersAndTeams(teams),"Swap completed",format!("Both teams' booking times and gym spaces were exchanged together. Team calendars now show the new times. No organizer approval is needed.{}", if warning { " Warning: a primary coach has overlapping bookings for different teams." } else { "" })));
            let mut result = execution(
                vec![
                    ResourceRef::Swap(*id),
                    ResourceRef::Booking(a.id),
                    ResourceRef::Booking(b.id),
                ],
                notices,
            );
            if warning {
                result.outcome.warnings.push(ScheduleWarning::CoachOverlap);
            }
            Ok(result)
        }
        A::WithdrawSwap {
            id,
            version: expected,
        } => {
            let swap = s
                .swaps
                .iter()
                .find(|swap| swap.id == *id)
                .ok_or(ScheduleError::NotFound)?;
            version(*expected, swap.version)?;
            if swap.status != SwapStatus::Pending || now >= swap.deadline {
                return Err(ScheduleError::InvalidTransition);
            }
            tx.set_swap_status(*id, SwapStatus::Withdrawn, *expected)
                .await?;
            Ok(execution(vec![ResourceRef::Swap(*id)], vec![]))
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
        | A::SetSlotEnabled { .. }
        | A::CloseGym { .. }
        | A::ReopenGym { .. }
        | A::SubmitRequests { .. }
        | A::EditRequest { .. }
        | A::WithdrawRequests { .. }
        | A::DecideRequests { .. }
        | A::BookDirectly { .. }
        | A::CancelBooking { .. }
        | A::ChangeBooking { .. }
        | A::MoveBooking { .. } => Err(ScheduleError::InvalidTransition),
    }
}
