use super::{
    ActionOutcome,
    commands::{BookingEdit, NewBooking, NewRequest, NewSwap},
};
use crate::{StorageError, auth::AuthTransaction};
use async_trait::async_trait;
use gymtime_domain::{
    EmailAddress, GymSpace, Instant, Interval,
    auth::{Actor, Digest, OpaqueToken, UserId},
    schedule::*,
};
pub struct AuditEntry {
    pub actor: UserId,
    pub action: String,
    pub created: Instant,
}
pub struct SavedMutation {
    pub operation: String,
    pub digest: Digest,
    pub outcome: ActionOutcome,
}
pub enum Recipients {
    Organizers,
    Teams(Vec<TeamId>),
    OrganizersAndTeams(Vec<TeamId>),
    ActiveCoaches,
}

#[async_trait]
pub trait ScheduleTransaction: AuthTransaction {
    /// # Errors
    /// Reads a user's inbox or the organizer's failed-delivery queue.
    async fn notifications(
        &mut self,
        user: UserId,
        failed_only: bool,
    ) -> Result<Vec<crate::notifications::Notification>, StorageError>;
    /// # Errors
    /// Marks only the current user's notice; returns false if it does not exist.
    async fn mark_notice_read(
        &mut self,
        user: UserId,
        id: &OpaqueToken,
        now: Instant,
    ) -> Result<bool, StorageError>;
    /// # Errors
    /// Requeues a failed delivery with its existing provider key.
    async fn retry_email(&mut self, id: &OpaqueToken, now: Instant) -> Result<bool, StorageError>;
    /// # Errors
    /// Reads safe audit summaries, without internal payloads or public link tokens.
    async fn audit_entries(&mut self) -> Result<Vec<AuditEntry>, StorageError>;
    /// # Errors
    /// Records the action and receipt identity without notes or sharing tokens.
    async fn audit_schedule(
        &mut self,
        actor: UserId,
        operation: &str,
        key: &OpaqueToken,
        now: Instant,
    ) -> Result<(), StorageError>;
    /// # Errors
    /// All read methods decode persisted values or return a named storage error.
    async fn snapshot(&mut self) -> Result<ScheduleSnapshot, StorageError>;
    /// # Errors
    /// Returns a saved mutation or a storage error.
    async fn receipt(
        &mut self,
        actor: UserId,
        key: &OpaqueToken,
    ) -> Result<Option<SavedMutation>, StorageError>;
    /// # Errors
    /// Saves the typed result in the same transaction as the action.
    async fn save_receipt(
        &mut self,
        actor: UserId,
        key: &OpaqueToken,
        operation: &str,
        digest: &Digest,
        outcome: &ActionOutcome,
        now: Instant,
    ) -> Result<(), StorageError>;
    /// # Errors
    /// Returns ConcurrentChange for stale versions; other writes return StorageError.
    async fn save_gym(
        &mut self,
        name: &Name,
        timezone: GymTimezone,
        split: SplitMode,
        hours: &WeeklyHours,
        version: Version,
    ) -> Result<Version, StorageError>;
    /// # Errors
    /// Inserts a draft or returns StorageError.
    async fn create_season(
        &mut self,
        name: &Name,
        dates: DateRange,
    ) -> Result<SeasonId, StorageError>;
    /// # Errors
    /// Returns ConcurrentChange for stale versions, or a storage failure.
    async fn edit_season(
        &mut self,
        id: SeasonId,
        name: &Name,
        dates: DateRange,
        version: Version,
    ) -> Result<(), StorageError>;
    /// # Errors
    /// Returns ConcurrentChange for stale versions, or a storage failure.
    async fn set_season_status(
        &mut self,
        id: SeasonId,
        status: SeasonStatus,
        version: Version,
    ) -> Result<(), StorageError>;
    /// # Errors
    /// Creates a team, its primary grant, and season association in the current transaction.
    async fn create_team(
        &mut self,
        name: &Name,
        primary: UserId,
        season: SeasonId,
        token: &OpaqueToken,
    ) -> Result<TeamId, StorageError>;
    /// # Errors
    /// Returns ConcurrentChange for stale versions, or a storage failure.
    async fn edit_team(
        &mut self,
        id: TeamId,
        name: &Name,
        primary: UserId,
        version: Version,
    ) -> Result<(), StorageError>;
    /// # Errors
    /// Returns ConcurrentChange for stale versions, or a storage failure.
    async fn assign_assistant(
        &mut self,
        team: TeamId,
        user: UserId,
        remove: bool,
        version: Version,
    ) -> Result<(), StorageError>;
    /// # Errors
    /// Returns ConcurrentChange for stale versions, or a storage failure.
    async fn assign_team_season(
        &mut self,
        team: TeamId,
        season: SeasonId,
        version: Version,
    ) -> Result<(), StorageError>;
    /// # Errors
    /// Rotates the public link, invalidating the previous webpage and feed token.
    async fn rotate_team_link(
        &mut self,
        team: TeamId,
        token: &OpaqueToken,
        version: Version,
    ) -> Result<(), StorageError>;
    /// # Errors
    /// Inserts distinct occurrences or returns StorageError.
    async fn create_slots(
        &mut self,
        season: SeasonId,
        slots: &[SlotOccurrence],
    ) -> Result<Vec<SlotId>, StorageError>;
    /// # Errors
    /// Returns ConcurrentChange for stale versions, or a storage failure.
    async fn edit_slot(
        &mut self,
        id: SlotId,
        slot: &SlotOccurrence,
        version: Version,
    ) -> Result<(), StorageError>;
    /// # Errors
    /// Returns ConcurrentChange for stale versions, or a storage failure.
    async fn set_slot_enabled(
        &mut self,
        id: SlotId,
        enabled: bool,
        version: Version,
    ) -> Result<(), StorageError>;
    /// # Errors
    /// Inserts a gym closure or returns StorageError.
    async fn create_closure(
        &mut self,
        interval: Interval,
        space: GymSpace,
        reason: &Note,
    ) -> Result<ClosureId, StorageError>;
    /// # Errors
    /// Returns ConcurrentChange for stale versions, or a storage failure.
    async fn reopen_closure(&mut self, id: ClosureId, version: Version)
    -> Result<(), StorageError>;
    /// # Errors
    /// Inserts an occurrence group or returns StorageError.
    async fn create_series(
        &mut self,
        id: &OpaqueToken,
        team: TeamId,
        season: SeasonId,
    ) -> Result<(), StorageError>;
    /// # Errors
    /// Inserts a pending request or returns StorageError.
    async fn create_request(&mut self, request: &NewRequest) -> Result<RequestId, StorageError>;
    /// # Errors
    /// Returns ConcurrentChange for stale versions, or a storage failure.
    async fn edit_request(
        &mut self,
        id: RequestId,
        slot: SlotId,
        activity: Activity,
        note: &Note,
        reason: &Note,
        version: Version,
    ) -> Result<(), StorageError>;
    /// # Errors
    /// Returns ConcurrentChange for stale versions, or a storage failure.
    async fn set_request_status(
        &mut self,
        id: RequestId,
        status: RequestStatus,
        version: Version,
    ) -> Result<(), StorageError>;
    /// # Errors
    /// Inserts a confirmed booking or returns StorageError.
    async fn create_booking(&mut self, booking: &NewBooking) -> Result<BookingId, StorageError>;
    /// # Errors
    /// Returns ConcurrentChange for stale versions, or a storage failure.
    async fn edit_booking(&mut self, booking: &BookingEdit) -> Result<(), StorageError>;
    /// # Errors
    /// Inserts a pending swap with immutable original versions or returns StorageError.
    async fn create_swap(&mut self, swap: &NewSwap) -> Result<SwapId, StorageError>;
    /// # Errors
    /// Returns ConcurrentChange for stale versions, or a storage failure.
    async fn set_swap_status(
        &mut self,
        id: SwapId,
        status: SwapStatus,
        version: Version,
    ) -> Result<(), StorageError>;
    /// # Errors
    /// Reads enabled recipients in one query and deduplicates users across team roles.
    async fn recipients(&mut self, selection: &Recipients) -> Result<Vec<Actor>, StorageError>;
    /// # Errors
    /// Reads a user by email without revealing account status to public clients.
    async fn invited_user(&mut self, email: &EmailAddress) -> Result<Option<UserId>, StorageError>;
}
#[async_trait]
pub trait ScheduleStore: Send + Sync {
    /// # Errors
    /// Acquires the immediate write lock or returns StorageError.
    async fn begin_schedule(&self) -> Result<Box<dyn ScheduleTransaction>, StorageError>;
}
