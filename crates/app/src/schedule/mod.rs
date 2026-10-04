//! Scheduling workflows run inside an immediate transaction supplied through ports.
pub mod bookings;
pub mod commands;
pub mod ports;
pub mod preview;
pub mod setup;
pub mod setup_actions;
pub mod swaps;
use crate::{
    StorageError,
    auth::{AuthError, Clock, Crypto},
};
use gymtime_domain::{
    auth::{OpaqueToken, UserId},
    schedule::*,
};
use std::sync::Arc;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ScheduleError {
    #[error(transparent)]
    Storage(#[from] StorageError),
    #[error(transparent)]
    Auth(#[from] AuthError),
    #[error(transparent)]
    Value(#[from] ScheduleValueError),
    #[error("record does not exist")]
    NotFound,
    #[error("the record changed; refresh and try again")]
    Stale,
    #[error("only the active season accepts requests")]
    Inactive,
    #[error("completed occurrences cannot be changed")]
    Past,
    #[error("this space and time are unavailable")]
    Unavailable,
    #[error("include a reason for this competing request")]
    CompetingReason,
    #[error("slots must be inside the gym's opening hours")]
    OutsideHours,
    #[error("enable gym halves before defining half-gym slots")]
    SplitDisabled,
    #[error("bookings must be rescheduled or cancelled before editing this slot")]
    OccupiedSlot,
    #[error("an active season already exists; close it first")]
    ActiveSeasonExists,
    #[error("the supplied idempotency key was already used with another input")]
    IdempotencyMismatch,
    #[error("this action is no longer available")]
    InvalidTransition,
    #[error("include a reason for the gym closure")]
    ClosureReason,
    #[error("keep at least one enabled organizer")]
    LastOrganizer,
}
pub struct ScheduleService {
    pub store: Arc<dyn ports::ScheduleStore>,
    pub clock: Arc<dyn Clock>,
    pub crypto: Arc<dyn Crypto>,
    pub public_url: String,
}
#[derive(Clone)]
pub enum ResourceRef {
    Gym(Version),
    User(UserId),
    Season(SeasonId),
    Team(TeamId),
    Slot(SlotId),
    Closure(ClosureId),
    Booking(BookingId),
    Request(RequestId),
    Swap(SwapId),
}
#[derive(Clone)]
pub enum ScheduleWarning {
    CoachOverlap,
    SomeDatesUnavailable,
}
#[derive(Clone)]
pub struct ActionOutcome {
    pub resources: Vec<ResourceRef>,
    pub warnings: Vec<ScheduleWarning>,
}
pub struct MutationIdentity {
    pub key: OpaqueToken,
    pub canonical_input: String,
}
pub struct NoticeIntent {
    pub recipients: ports::Recipients,
    pub subject: String,
    pub text: String,
}
pub struct Execution {
    pub outcome: ActionOutcome,
    pub notices: Vec<NoticeIntent>,
}
impl ScheduleService {
    /// Runs the complete mutation, audit, notification batch, and saved result atomically.
    /// # Errors
    /// Returns named permission, revision, scheduling, or infrastructure errors.
    pub async fn mutate(
        &self,
        user: UserId,
        command: commands::ScheduleAction,
        identity: MutationIdentity,
    ) -> Result<ActionOutcome, ScheduleError> {
        let now = self.clock.now()?;
        let mut tx = self.store.begin_schedule().await?;
        let actor = tx
            .actor_by_id(user)
            .await?
            .ok_or(AuthError::Unauthenticated)?;
        let mut snapshot = tx.snapshot().await?;
        authorize(&actor, &snapshot, &command)?;
        let previously_available = snapshot
            .slots
            .iter()
            .filter(|slot| snapshot.requestable(slot, now))
            .map(|slot| (slot.id, slot.version))
            .collect::<Vec<_>>();
        let operation = command.operation();
        if let Some(receipt) = tx.receipt(user, &identity.key).await? {
            if receipt.operation != operation
                || !self
                    .crypto
                    .matches("mutation", &identity.canonical_input, &receipt.digest)?
            {
                return Err(ScheduleError::IdempotencyMismatch);
            }
            tx.commit().await?;
            return Ok(receipt.outcome);
        }
        let mut execution =
            match setup_actions::execute(self, &mut *tx, user, &snapshot, &command, now).await? {
                Some(execution) => execution,
                None => {
                    bookings::execute(self, &mut *tx, user, &mut snapshot, &command, now).await?
                }
            };
        // Reload from this transaction: setup actions and closures also change availability.
        let updated = tx.snapshot().await?;
        execution
            .notices
            .retain(|notice| !matches!(notice.recipients, ports::Recipients::ActiveCoaches));
        if updated.slots.iter().any(|slot| {
            updated.requestable(slot, now)
                && !previously_available.contains(&(slot.id, slot.version))
        }) {
            execution.notices.push(bookings::notice(
                self,
                ports::Recipients::ActiveCoaches,
                "New slot available",
                "New gym time is available. Open the calendar to request a slot.".to_owned(),
            ));
        }
        let mut grouped = std::collections::BTreeMap::<
            i64,
            (gymtime_domain::auth::Actor, Vec<(String, String)>),
        >::new();
        for intent in execution.notices {
            for recipient in tx.recipients(&intent.recipients).await? {
                let entry = grouped
                    .entry(recipient.id.get())
                    .or_insert_with(|| (recipient, vec![]));
                let part = (intent.subject.clone(), intent.text.clone());
                if !entry.1.contains(&part) {
                    entry.1.push(part);
                }
            }
        }
        for (_, (recipient, parts)) in grouped {
            let subject = if parts.len() == 1 {
                parts
                    .first()
                    .map(|(title, _)| title.clone())
                    .ok_or(AuthError::Unavailable)?
            } else {
                "Gymtime schedule updated".to_owned()
            };
            let text = parts
                .iter()
                .map(|(title, text)| format!("{title}\n\n{text}"))
                .collect::<Vec<_>>()
                .join("\n\n");
            let message = crate::EmailMessage::new(recipient.email, subject, text)
                .map_err(|_| AuthError::Unavailable)?;
            tx.enqueue(recipient.id, &self.crypto.token()?, &message, now)
                .await?;
        }
        let digest = self.crypto.digest("mutation", &identity.canonical_input)?;
        tx.save_receipt(
            user,
            &identity.key,
            operation,
            &digest,
            &execution.outcome,
            now,
        )
        .await?;
        tx.audit_schedule(user, operation, &identity.key, now)
            .await?;
        tx.commit().await?;
        Ok(execution.outcome)
    }
    /// Expires unanswered swaps without changing either original booking.
    /// # Errors
    /// Returns clock or persistence errors.
    pub async fn expire_swaps(&self) -> Result<(), ScheduleError> {
        let now = self.clock.now()?;
        let mut tx = self.store.begin_schedule().await?;
        let snapshot = tx.snapshot().await?;
        for swap in snapshot
            .swaps
            .iter()
            .filter(|swap| swap.status == SwapStatus::Pending && swap.deadline <= now)
        {
            tx.set_swap_status(swap.id, SwapStatus::Expired, swap.version)
                .await?;
        }
        tx.commit().await?;
        Ok(())
    }
    /// # Errors
    /// Returns current permission or persistence errors.
    pub async fn notifications(
        &self,
        user: UserId,
        failed_only: bool,
    ) -> Result<Vec<crate::notifications::Notification>, ScheduleError> {
        let mut tx = self.store.begin_schedule().await?;
        let actor = tx
            .actor_by_id(user)
            .await?
            .ok_or(AuthError::Unauthenticated)?;
        if failed_only && !actor.organizer {
            return Err(AuthError::Forbidden.into());
        }
        let notices = tx.notifications(user, failed_only).await?;
        tx.commit().await?;
        Ok(notices)
    }
    /// # Errors
    /// Requires organizer permissions to read the audit history.
    pub async fn audit(&self, user: UserId) -> Result<Vec<ports::AuditEntry>, ScheduleError> {
        let mut tx = self.store.begin_schedule().await?;
        setup::organizer(&mut *tx, user).await?;
        let entries = tx.audit_entries().await?;
        tx.commit().await?;
        Ok(entries)
    }
    /// Reads only the team identified by the current public capability.
    /// # Errors
    /// Returns NotFound for an unknown or rotated token, or a persistence error.
    pub async fn public_calendar(
        &self,
        token: &OpaqueToken,
    ) -> Result<gymtime_domain::calendar::PublicCalendar, ScheduleError> {
        let mut tx = self.store.begin_schedule().await?;
        let s = tx.snapshot().await?;
        let team = s
            .teams
            .iter()
            .find(|team| team.share_token.as_str() == token.as_str())
            .ok_or(ScheduleError::NotFound)?;
        let calendar = gymtime_domain::calendar::PublicCalendar::project(&s, team);
        tx.commit().await?;
        Ok(calendar)
    }
    /// # Errors
    /// Returns authentication, decoding or persistence errors.
    pub async fn snapshot(&self, user: UserId) -> Result<ScheduleSnapshot, ScheduleError> {
        self.authorized_snapshot(user)
            .await
            .map(|(_, snapshot)| snapshot)
    }
    /// Reads permissions and schedule data in the same transaction.
    /// # Errors
    /// Returns authentication, decoding or persistence errors.
    pub async fn authorized_snapshot(
        &self,
        user: UserId,
    ) -> Result<(gymtime_domain::auth::Actor, ScheduleSnapshot), ScheduleError> {
        let mut tx = self.store.begin_schedule().await?;
        let actor = tx
            .actor_by_id(user)
            .await?
            .ok_or(AuthError::Unauthenticated)?;
        let snapshot = tx.snapshot().await?;
        tx.commit().await?;
        Ok((actor, snapshot))
    }
}

fn authorize(
    actor: &gymtime_domain::auth::Actor,
    s: &ScheduleSnapshot,
    c: &commands::ScheduleAction,
) -> Result<(), ScheduleError> {
    use commands::ScheduleAction as A;
    let manages = |team: TeamId| -> Result<(), ScheduleError> {
        let team = s.team(team).ok_or(ScheduleError::NotFound)?;
        if actor.organizer || actor.id == team.primary {
            Ok(())
        } else {
            Err(AuthError::Forbidden.into())
        }
    };
    let strict_primary = |booking: BookingId| -> Result<(), ScheduleError> {
        let booking = s.booking(booking).ok_or(ScheduleError::NotFound)?;
        let team = s.team(booking.team).ok_or(ScheduleError::NotFound)?;
        if actor.id == team.primary {
            Ok(())
        } else {
            Err(AuthError::Forbidden.into())
        }
    };
    match c {
        A::InviteAccount { .. }
        | A::SetAccountStatus { .. }
        | A::RetryEmail { .. }
        | A::ConfigureGym { .. }
        | A::CreateSeason { .. }
        | A::EditSeason { .. }
        | A::SetSeasonStatus { .. }
        | A::CreateTeam { .. }
        | A::EditTeam { .. }
        | A::AssignAssistant { .. }
        | A::AssignTeamSeason { .. }
        | A::CreateSlots { .. }
        | A::EditSlot { .. }
        | A::SetSlotEnabled { .. }
        | A::CloseGym { .. }
        | A::ReopenGym { .. }
        | A::DecideRequests { .. }
        | A::BookDirectly { .. }
        | A::MoveBooking { .. } => {
            if actor.organizer {
                Ok(())
            } else {
                Err(AuthError::Forbidden.into())
            }
        }
        A::MarkNoticeRead { .. } => Ok(()),
        A::RotateTeamLink { team, .. } | A::SubmitRequests { team, .. } => manages(*team),
        A::EditRequest { id, .. } => manages(
            s.requests
                .iter()
                .find(|r| r.id == *id)
                .ok_or(ScheduleError::NotFound)?
                .team,
        ),
        A::WithdrawRequests { ids } => {
            for id in ids.items() {
                manages(
                    s.requests
                        .iter()
                        .find(|r| r.id == *id)
                        .ok_or(ScheduleError::NotFound)?
                        .team,
                )?;
            }
            Ok(())
        }
        A::CancelBooking { id, .. } | A::ChangeBooking { id, .. } => {
            manages(s.booking(*id).ok_or(ScheduleError::NotFound)?.team)
        }
        A::ProposeSwap { first, .. } => strict_primary(*first),
        A::RespondSwap { id, .. } => strict_primary(
            s.swaps
                .iter()
                .find(|swap| swap.id == *id)
                .ok_or(ScheduleError::NotFound)?
                .second,
        ),
        A::WithdrawSwap { id, .. } => {
            let swap = s
                .swaps
                .iter()
                .find(|swap| swap.id == *id)
                .ok_or(ScheduleError::NotFound)?;
            if swap.proposer != actor.id {
                return Err(AuthError::Forbidden.into());
            }
            strict_primary(swap.first)
        }
    }
}
