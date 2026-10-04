use super::{
    ScheduleError, ScheduleService, commands::ScheduleAction as A, setup_actions::validate_slot,
};
use gymtime_domain::{auth::UserId, schedule::*};
pub struct PreviewOccurrence {
    pub date: LocalDate,
    pub slot: Result<SlotOccurrence, ScheduleError>,
}
pub struct Preview {
    pub occurrences: Vec<PreviewOccurrence>,
    pub bookings: Vec<BookingId>,
    pub requests: Vec<RequestId>,
}
impl ScheduleService {
    /// # Errors
    /// Requires current organizer permissions and a slot template or closure action.
    pub async fn preview(&self, user: UserId, command: A) -> Result<Preview, ScheduleError> {
        let mut tx = self.store.begin_schedule().await?;
        super::setup::organizer(&mut *tx, user).await?;
        let s = tx.snapshot().await?;
        let result = match command {
            A::CreateSlots {
                season,
                dates,
                weekdays,
                hours,
                space,
            } => {
                let season = s.season(season).ok_or(ScheduleError::NotFound)?;
                if season.status == SeasonStatus::Closed {
                    return Err(ScheduleError::Inactive);
                }
                let occurrences = expand_slots(s.gym.timezone, dates, &weekdays, hours, space)
                    .into_iter()
                    .map(|(date, v)| PreviewOccurrence {
                        date,
                        slot: v.map_err(ScheduleError::from).and_then(|slot| {
                            validate_slot(&s, season, &slot)?;
                            Ok(slot)
                        }),
                    })
                    .collect();
                Preview {
                    occurrences,
                    bookings: vec![],
                    requests: vec![],
                }
            }
            A::CloseGym {
                interval,
                space,
                reason,
            } => {
                let now = self.clock.now()?;
                if interval.end() <= now {
                    return Err(ScheduleError::Past);
                }
                if reason.is_empty() {
                    return Err(ScheduleError::ClosureReason);
                }
                let affected = |id| {
                    s.slot(id).is_some_and(|slot| {
                        slot.interval.end() > now
                            && gymtime_domain::conflicts(
                                (slot.space, slot.interval),
                                (space, interval),
                            )
                    })
                };
                Preview {
                    occurrences: vec![],
                    bookings: s
                        .bookings
                        .iter()
                        .filter(|b| b.status == BookingStatus::Confirmed && affected(b.slot))
                        .map(|b| b.id)
                        .collect(),
                    requests: s
                        .requests
                        .iter()
                        .filter(|r| r.status == RequestStatus::Pending && affected(r.slot))
                        .map(|r| r.id)
                        .collect(),
                }
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
            | A::EditSlot { .. }
            | A::SetSlotEnabled { .. }
            | A::ReopenGym { .. }
            | A::SubmitRequests { .. }
            | A::EditRequest { .. }
            | A::WithdrawRequests { .. }
            | A::DecideRequests { .. }
            | A::BookDirectly { .. }
            | A::CancelBooking { .. }
            | A::ChangeBooking { .. }
            | A::MoveBooking { .. }
            | A::ProposeSwap { .. }
            | A::RespondSwap { .. }
            | A::WithdrawSwap { .. } => return Err(ScheduleError::InvalidTransition),
        };
        tx.commit().await?;
        Ok(result)
    }
}
