use gymtime_domain::{EmailAddress, GymSpace, Interval, auth::UserId, schedule::*};
pub enum ScheduleAction {
    InviteAccount {
        email: EmailAddress,
        role: gymtime_domain::auth::AccountRole,
    },
    SetAccountStatus {
        user: UserId,
        status: gymtime_domain::auth::AccountStatus,
    },
    MarkNoticeRead {
        id: gymtime_domain::auth::OpaqueToken,
    },
    RetryEmail {
        id: gymtime_domain::auth::OpaqueToken,
    },
    ConfigureGym {
        name: Name,
        timezone: GymTimezone,
        split: SplitMode,
        hours: WeeklyHours,
        version: Version,
    },
    CreateSeason {
        name: Name,
        dates: DateRange,
    },
    EditSeason {
        id: SeasonId,
        name: Name,
        dates: DateRange,
        version: Version,
    },
    SetSeasonStatus {
        id: SeasonId,
        status: SeasonStatus,
        version: Version,
    },
    CreateTeam {
        name: Name,
        primary: EmailAddress,
        season: SeasonId,
    },
    EditTeam {
        id: TeamId,
        name: Name,
        primary: EmailAddress,
        version: Version,
    },
    AssignAssistant {
        team: TeamId,
        email: EmailAddress,
        remove: bool,
        version: Version,
    },
    AssignTeamSeason {
        team: TeamId,
        season: SeasonId,
        version: Version,
    },
    RotateTeamLink {
        team: TeamId,
        version: Version,
    },
    CreateSlots {
        season: SeasonId,
        dates: DateRange,
        weekdays: Weekdays,
        hours: OpeningHours,
        space: GymSpace,
    },
    EditSlot {
        id: SlotId,
        date: LocalDate,
        hours: OpeningHours,
        space: GymSpace,
        version: Version,
    },
    SetSlotEnabled {
        id: SlotId,
        enabled: bool,
        version: Version,
    },
    CloseGym {
        interval: Interval,
        space: GymSpace,
        reason: Note,
    },
    ReopenGym {
        id: ClosureId,
        version: Version,
    },
    SubmitRequests {
        team: TeamId,
        slots: Selection<SlotId>,
        activity: Activity,
        note: Note,
        reason: Note,
    },
    EditRequest {
        id: RequestId,
        slot: SlotId,
        activity: Activity,
        note: Note,
        reason: Note,
        version: Version,
    },
    WithdrawRequests {
        ids: Selection<RequestId>,
    },
    DecideRequests {
        decisions: Vec<RequestDecision>,
    },
    BookDirectly {
        team: TeamId,
        slots: Selection<SlotId>,
        activity: Activity,
        note: Note,
    },
    CancelBooking {
        id: BookingId,
        scope: SeriesScope,
        version: Version,
    },
    ChangeBooking {
        id: BookingId,
        scope: SeriesScope,
        slots: Selection<SlotId>,
        activity: Activity,
        note: Note,
        reason: Note,
        version: Version,
    },
    MoveBooking {
        id: BookingId,
        slot: SlotId,
        activity: Activity,
        note: Note,
        version: Version,
    },
    ProposeSwap {
        first: BookingId,
        second: BookingId,
        first_version: Version,
        second_version: Version,
    },
    RespondSwap {
        id: SwapId,
        accept: bool,
        version: Version,
    },
    WithdrawSwap {
        id: SwapId,
        version: Version,
    },
}
impl ScheduleAction {
    #[must_use]
    pub const fn operation(&self) -> &'static str {
        match self {
            Self::InviteAccount { .. } => "invite_account",
            Self::SetAccountStatus { .. } => "set_account_status",
            Self::MarkNoticeRead { .. } => "mark_notice_read",
            Self::RetryEmail { .. } => "retry_email",
            Self::ConfigureGym { .. } => "configure_gym",
            Self::CreateSeason { .. } => "create_season",
            Self::EditSeason { .. } => "edit_season",
            Self::SetSeasonStatus { .. } => "set_season_status",
            Self::CreateTeam { .. } => "create_team",
            Self::EditTeam { .. } => "edit_team",
            Self::AssignAssistant { .. } => "assign_assistant",
            Self::AssignTeamSeason { .. } => "assign_team_season",
            Self::RotateTeamLink { .. } => "rotate_team_link",
            Self::CreateSlots { .. } => "create_slots",
            Self::EditSlot { .. } => "edit_slot",
            Self::SetSlotEnabled { .. } => "set_slot_enabled",
            Self::CloseGym { .. } => "close_gym",
            Self::ReopenGym { .. } => "reopen_gym",
            Self::SubmitRequests { .. } => "submit_requests",
            Self::EditRequest { .. } => "edit_request",
            Self::WithdrawRequests { .. } => "withdraw_requests",
            Self::DecideRequests { .. } => "decide_requests",
            Self::BookDirectly { .. } => "book_directly",
            Self::CancelBooking { .. } => "cancel_booking",
            Self::ChangeBooking { .. } => "change_booking",
            Self::MoveBooking { .. } => "move_booking",
            Self::ProposeSwap { .. } => "propose_swap",
            Self::RespondSwap { .. } => "respond_swap",
            Self::WithdrawSwap { .. } => "withdraw_swap",
        }
    }
}
pub struct RequestDecision {
    pub id: RequestId,
    pub approve: bool,
    pub version: Version,
}
pub struct NewRequest {
    pub team: TeamId,
    pub slot: SlotId,
    pub series: Option<gymtime_domain::auth::OpaqueToken>,
    pub activity: Activity,
    pub note: Note,
    pub reason: Note,
    pub replacement: Option<PendingReplacement>,
    pub creator: UserId,
    pub created: gymtime_domain::Instant,
}
pub struct NewBooking {
    pub team: TeamId,
    pub slot: SlotId,
    pub series: Option<gymtime_domain::auth::OpaqueToken>,
    pub calendar_uid: gymtime_domain::auth::OpaqueToken,
    pub activity: Activity,
    pub note: Note,
    pub now: gymtime_domain::Instant,
}
pub struct BookingEdit {
    pub id: BookingId,
    pub slot: SlotId,
    pub activity: Activity,
    pub note: Note,
    pub status: BookingStatus,
    pub version: Version,
    pub now: gymtime_domain::Instant,
}
pub struct NewSwap {
    pub first: BookingId,
    pub second: BookingId,
    pub first_version: Version,
    pub second_version: Version,
    pub proposer: UserId,
    pub now: gymtime_domain::Instant,
    pub deadline: gymtime_domain::Instant,
}
