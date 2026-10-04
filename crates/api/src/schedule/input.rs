use crate::errors::ApiError;
use gymtime_app::schedule::commands::{RequestDecision, ScheduleAction as A};
use gymtime_domain::{EmailAddress, GymSpace, Interval, schedule::*};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
fn value<T, E>(field: &str, v: Result<T, E>) -> Result<T, ApiError> {
    v.map_err(|_| ApiError::field(field, "Enter a valid value."))
}
fn parse_name(v: &str) -> Result<Name, ApiError> {
    value("name", Name::try_from(v))
}
fn address(v: &str) -> Result<EmailAddress, ApiError> {
    value("email", EmailAddress::try_from(v))
}
fn parse_note(v: &str) -> Result<Note, ApiError> {
    value("note", Note::try_from(v))
}
fn ver(v: i64) -> Result<Version, ApiError> {
    value("version", Version::try_from(v))
}
fn zone(v: &str) -> Result<GymTimezone, ApiError> {
    value("timezone", GymTimezone::try_from(v))
}
fn day(v: &str) -> Result<LocalDate, ApiError> {
    value("date", LocalDate::try_from(v))
}
fn time(v: &str) -> Result<LocalTime, ApiError> {
    value("time", LocalTime::try_from(v))
}
fn opening(start: &str, end: &str) -> Result<OpeningHours, ApiError> {
    value("time", OpeningHours::new(time(start)?, time(end)?))
}
fn dates(start: &str, end: &str) -> Result<DateRange, ApiError> {
    value("dates", DateRange::new(day(start)?, day(end)?))
}
fn slots_selection(ids: Vec<i64>) -> Result<Selection<SlotId>, ApiError> {
    value(
        "slots",
        Selection::try_from(
            ids.into_iter()
                .map(|id| value("slots", SlotId::try_from(id)))
                .collect::<Result<Vec<_>, _>>()?,
        ),
    )
}
#[derive(Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct HoursBody {
    pub weekday: u32,
    pub start: String,
    pub end: String,
}
#[derive(Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct DecisionBody {
    pub id: i64,
    pub approve: bool,
    pub version: i64,
}
#[derive(Clone, Copy, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum SpaceBody {
    Full,
    HalfA,
    HalfB,
}
impl From<SpaceBody> for GymSpace {
    fn from(v: SpaceBody) -> Self {
        match v {
            SpaceBody::Full => Self::Full,
            SpaceBody::HalfA => Self::HalfA,
            SpaceBody::HalfB => Self::HalfB,
        }
    }
}
#[derive(Clone, Copy, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum SeasonState {
    Draft,
    Active,
    Closed,
}
impl From<SeasonState> for SeasonStatus {
    fn from(v: SeasonState) -> Self {
        match v {
            SeasonState::Draft => Self::Draft,
            SeasonState::Active => Self::Active,
            SeasonState::Closed => Self::Closed,
        }
    }
}
#[derive(Clone, Copy, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ActivityBody {
    Practice,
    Game,
}
impl From<ActivityBody> for Activity {
    fn from(v: ActivityBody) -> Self {
        match v {
            ActivityBody::Practice => Self::Practice,
            ActivityBody::Game => Self::Game,
        }
    }
}
#[derive(Clone, Copy, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ScopeBody {
    One,
    Future,
    Remaining,
}
impl From<ScopeBody> for SeriesScope {
    fn from(v: ScopeBody) -> Self {
        match v {
            ScopeBody::One => Self::One,
            ScopeBody::Future => Self::Future,
            ScopeBody::Remaining => Self::Remaining,
        }
    }
}
#[derive(Serialize, Deserialize, ToSchema)]
#[serde(tag = "operation", rename_all = "snake_case", deny_unknown_fields)]
pub enum ActionBody {
    MarkNoticeRead {
        id: String,
    },
    RetryEmail {
        id: String,
    },
    ConfigureGym {
        name: String,
        timezone: String,
        split: bool,
        hours: Vec<HoursBody>,
        version: i64,
    },
    CreateSeason {
        name: String,
        start_date: String,
        end_date: String,
    },
    EditSeason {
        id: i64,
        name: String,
        start_date: String,
        end_date: String,
        version: i64,
    },
    SetSeasonStatus {
        id: i64,
        status: SeasonState,
        version: i64,
    },
    CreateTeam {
        name: String,
        primary: String,
        season: i64,
    },
    EditTeam {
        id: i64,
        name: String,
        primary: String,
        version: i64,
    },
    AssignAssistant {
        team: i64,
        email: String,
        remove: bool,
        version: i64,
    },
    AssignTeamSeason {
        team: i64,
        season: i64,
        version: i64,
    },
    RotateTeamLink {
        team: i64,
        version: i64,
    },
    CreateSlots {
        season: i64,
        start_date: String,
        end_date: String,
        weekdays: Vec<u32>,
        start: String,
        end: String,
        space: SpaceBody,
    },
    EditSlot {
        id: i64,
        date: String,
        start: String,
        end: String,
        space: SpaceBody,
        version: i64,
    },
    SetSlotEnabled {
        id: i64,
        enabled: bool,
        version: i64,
    },
    CloseGym {
        start_date: String,
        end_date: String,
        start: String,
        end: String,
        space: SpaceBody,
        reason: String,
    },
    ReopenGym {
        id: i64,
        version: i64,
    },
    SubmitRequests {
        team: i64,
        slots: Vec<i64>,
        activity: ActivityBody,
        note: String,
        reason: String,
    },
    EditRequest {
        id: i64,
        slot: i64,
        activity: ActivityBody,
        note: String,
        reason: String,
        version: i64,
    },
    WithdrawRequests {
        ids: Vec<i64>,
    },
    DecideRequests {
        decisions: Vec<DecisionBody>,
    },
    BookDirectly {
        team: i64,
        slots: Vec<i64>,
        activity: ActivityBody,
        note: String,
    },
    CancelBooking {
        id: i64,
        scope: ScopeBody,
        version: i64,
    },
    ChangeBooking {
        id: i64,
        scope: ScopeBody,
        slots: Vec<i64>,
        activity: ActivityBody,
        note: String,
        reason: String,
        version: i64,
    },
    MoveBooking {
        id: i64,
        slot: i64,
        activity: ActivityBody,
        note: String,
        version: i64,
    },
    ProposeSwap {
        first: i64,
        second: i64,
        first_version: i64,
        second_version: i64,
    },
    RespondSwap {
        id: i64,
        accept: bool,
        version: i64,
    },
    WithdrawSwap {
        id: i64,
        version: i64,
    },
}
impl ActionBody {
    /// # Errors
    /// Parses one raw command into validated domain values, resolving gym-local times explicitly.
    pub fn parse(self, timezone: GymTimezone) -> Result<A, ApiError> {
        Ok(match self {
            Self::MarkNoticeRead { id } => A::MarkNoticeRead {
                id: value(
                    "id",
                    gymtime_domain::auth::OpaqueToken::try_from(id.as_str()),
                )?,
            },
            Self::RetryEmail { id } => A::RetryEmail {
                id: value(
                    "id",
                    gymtime_domain::auth::OpaqueToken::try_from(id.as_str()),
                )?,
            },
            Self::ConfigureGym {
                name,
                timezone,
                split,
                hours,
                version,
            } => A::ConfigureGym {
                name: parse_name(&name)?,
                timezone: zone(&timezone)?,
                split: if split {
                    SplitMode::HalvesAvailable
                } else {
                    SplitMode::WholeOnly
                },
                hours: WeeklyHours::try_from(
                    hours
                        .into_iter()
                        .map(|h| {
                            Ok((
                                value("weekday", Weekday::try_from(h.weekday))?,
                                opening(&h.start, &h.end)?,
                            ))
                        })
                        .collect::<Result<Vec<_>, ApiError>>()?,
                )
                .map_err(|_| {
                    ApiError::field("hours", "Each weekday may have one opening interval.")
                })?,
                version: ver(version)?,
            },
            Self::CreateSeason {
                name,
                start_date,
                end_date,
            } => A::CreateSeason {
                name: parse_name(&name)?,
                dates: dates(&start_date, &end_date)?,
            },
            Self::EditSeason {
                id,
                name,
                start_date,
                end_date,
                version,
            } => A::EditSeason {
                id: value("id", SeasonId::try_from(id))?,
                name: parse_name(&name)?,
                version: ver(version)?,
                dates: dates(&start_date, &end_date)?,
            },
            Self::SetSeasonStatus {
                id,
                status,
                version,
            } => A::SetSeasonStatus {
                id: value("id", SeasonId::try_from(id))?,
                status: status.into(),
                version: ver(version)?,
            },
            Self::CreateTeam {
                name,
                primary,
                season,
            } => A::CreateTeam {
                name: parse_name(&name)?,
                primary: address(&primary)?,
                season: value("season", SeasonId::try_from(season))?,
            },
            Self::EditTeam {
                id,
                name,
                primary,
                version,
            } => A::EditTeam {
                id: value("id", TeamId::try_from(id))?,
                name: parse_name(&name)?,
                primary: address(&primary)?,
                version: ver(version)?,
            },
            Self::AssignAssistant {
                team,
                email,
                remove,
                version,
            } => A::AssignAssistant {
                team: value("team", TeamId::try_from(team))?,
                email: address(&email)?,
                remove,
                version: ver(version)?,
            },
            Self::AssignTeamSeason {
                team,
                season,
                version,
            } => A::AssignTeamSeason {
                team: value("team", TeamId::try_from(team))?,
                season: value("season", SeasonId::try_from(season))?,
                version: ver(version)?,
            },
            Self::RotateTeamLink { team, version } => A::RotateTeamLink {
                team: value("team", TeamId::try_from(team))?,
                version: ver(version)?,
            },
            Self::CreateSlots {
                season,
                start_date,
                end_date,
                weekdays,
                start,
                end,
                space,
            } => A::CreateSlots {
                season: value("season", SeasonId::try_from(season))?,
                weekdays: value("weekdays", Weekdays::try_from(weekdays))?,
                space: space.into(),
                dates: dates(&start_date, &end_date)?,
                hours: opening(&start, &end)?,
            },
            Self::EditSlot {
                id,
                date,
                start,
                end,
                space,
                version,
            } => A::EditSlot {
                id: value("id", SlotId::try_from(id))?,
                date: day(&date)?,
                space: space.into(),
                version: ver(version)?,
                hours: opening(&start, &end)?,
            },
            Self::SetSlotEnabled {
                id,
                enabled,
                version,
            } => A::SetSlotEnabled {
                id: value("id", SlotId::try_from(id))?,
                enabled,
                version: ver(version)?,
            },
            Self::CloseGym {
                start_date,
                end_date,
                start,
                end,
                space,
                reason,
            } => A::CloseGym {
                space: space.into(),
                reason: parse_note(&reason)?,
                interval: value(
                    "time",
                    Interval::new(
                        value("time", timezone.resolve(day(&start_date)?, time(&start)?))?,
                        value("time", timezone.resolve(day(&end_date)?, time(&end)?))?,
                    ),
                )?,
            },
            Self::ReopenGym { id, version } => A::ReopenGym {
                id: value("id", ClosureId::try_from(id))?,
                version: ver(version)?,
            },
            Self::SubmitRequests {
                team,
                slots,
                activity,
                note,
                reason,
            } => A::SubmitRequests {
                team: value("team", TeamId::try_from(team))?,
                slots: slots_selection(slots)?,
                activity: activity.into(),
                note: parse_note(&note)?,
                reason: parse_note(&reason)?,
            },
            Self::EditRequest {
                id,
                slot,
                activity,
                note,
                reason,
                version,
            } => A::EditRequest {
                id: value("id", RequestId::try_from(id))?,
                slot: value("slot", SlotId::try_from(slot))?,
                activity: activity.into(),
                note: parse_note(&note)?,
                reason: parse_note(&reason)?,
                version: ver(version)?,
            },
            Self::WithdrawRequests { ids } => A::WithdrawRequests {
                ids: value(
                    "ids",
                    Selection::try_from(
                        ids.into_iter()
                            .map(|id| value("ids", RequestId::try_from(id)))
                            .collect::<Result<Vec<_>, _>>()?,
                    ),
                )?,
            },
            Self::DecideRequests { decisions } => A::DecideRequests {
                decisions: decisions
                    .into_iter()
                    .map(|d| {
                        Ok(RequestDecision {
                            id: value("id", RequestId::try_from(d.id))?,
                            approve: d.approve,
                            version: ver(d.version)?,
                        })
                    })
                    .collect::<Result<Vec<_>, ApiError>>()?,
            },
            Self::BookDirectly {
                team,
                slots,
                activity,
                note,
            } => A::BookDirectly {
                team: value("team", TeamId::try_from(team))?,
                slots: slots_selection(slots)?,
                activity: activity.into(),
                note: parse_note(&note)?,
            },
            Self::CancelBooking { id, scope, version } => A::CancelBooking {
                id: value("id", BookingId::try_from(id))?,
                scope: scope.into(),
                version: ver(version)?,
            },
            Self::ChangeBooking {
                id,
                scope,
                slots,
                activity,
                note,
                reason,
                version,
            } => A::ChangeBooking {
                id: value("id", BookingId::try_from(id))?,
                scope: scope.into(),
                slots: slots_selection(slots)?,
                activity: activity.into(),
                note: parse_note(&note)?,
                reason: parse_note(&reason)?,
                version: ver(version)?,
            },
            Self::MoveBooking {
                id,
                slot,
                activity,
                note,
                version,
            } => A::MoveBooking {
                id: value("id", BookingId::try_from(id))?,
                slot: value("slot", SlotId::try_from(slot))?,
                activity: activity.into(),
                note: parse_note(&note)?,
                version: ver(version)?,
            },
            Self::ProposeSwap {
                first,
                second,
                first_version,
                second_version,
            } => A::ProposeSwap {
                first: value("first", BookingId::try_from(first))?,
                second: value("second", BookingId::try_from(second))?,
                first_version: ver(first_version)?,
                second_version: ver(second_version)?,
            },
            Self::RespondSwap {
                id,
                accept,
                version,
            } => A::RespondSwap {
                id: value("id", SwapId::try_from(id))?,
                accept,
                version: ver(version)?,
            },
            Self::WithdrawSwap { id, version } => A::WithdrawSwap {
                id: value("id", SwapId::try_from(id))?,
                version: ver(version)?,
            },
        })
    }
}
