use crate::errors::ApiError;
use gymtime_domain::{GymSpace, Instant, auth::UserId, schedule::*};
use serde::Serialize;
use utoipa::ToSchema;
#[derive(Serialize, ToSchema)]
pub struct GymView {
    pub name: String,
    pub timezone: String,
    pub split: bool,
    pub version: i64,
    pub hours: Vec<super::input::HoursBody>,
}
#[derive(Serialize, ToSchema)]
pub struct SeasonView {
    pub id: i64,
    pub name: String,
    pub start_date: String,
    pub end_date: String,
    pub status: &'static str,
    pub version: i64,
}
#[derive(Serialize, ToSchema)]
pub struct TeamView {
    pub id: i64,
    pub name: String,
    pub primary: i64,
    pub assistants: Vec<i64>,
    pub seasons: Vec<i64>,
    pub share_token: Option<String>,
    pub version: i64,
}
#[derive(Serialize, ToSchema)]
pub struct SlotView {
    pub id: i64,
    pub season: i64,
    pub date: String,
    pub start: String,
    pub end: String,
    pub starts_at: i64,
    pub ends_at: i64,
    pub space: &'static str,
    pub enabled: bool,
    pub available: bool,
    pub version: i64,
}
#[derive(Serialize, ToSchema)]
pub struct BookingView {
    pub id: i64,
    pub team: i64,
    pub slot: i64,
    pub series: Option<String>,
    pub activity: &'static str,
    pub note: String,
    pub status: &'static str,
    pub version: i64,
}
#[derive(Serialize, ToSchema)]
pub struct RequestView {
    pub id: i64,
    pub team: i64,
    pub slot: i64,
    pub series: Option<String>,
    pub activity: &'static str,
    pub note: String,
    pub reason: String,
    pub status: &'static str,
    pub replacement: Option<i64>,
    pub version: i64,
}
#[derive(Serialize, ToSchema)]
pub struct SwapView {
    pub id: i64,
    pub first: i64,
    pub second: i64,
    pub proposer: i64,
    pub deadline: i64,
    pub status: &'static str,
    pub version: i64,
}
#[derive(Serialize, ToSchema)]
pub struct ClosureView {
    pub id: i64,
    pub starts_at: i64,
    pub ends_at: i64,
    pub space: &'static str,
    pub reason: String,
    pub active: bool,
    pub version: i64,
}
#[derive(Serialize, ToSchema)]
pub struct ScheduleView {
    pub gym: GymView,
    pub seasons: Vec<SeasonView>,
    pub teams: Vec<TeamView>,
    pub slots: Vec<SlotView>,
    pub bookings: Vec<BookingView>,
    pub requests: Vec<RequestView>,
    pub swaps: Vec<SwapView>,
    pub closures: Vec<ClosureView>,
    pub now: i64,
}
#[derive(Serialize, ToSchema)]
pub struct ResourceView {
    pub kind: &'static str,
    pub id: i64,
}
#[derive(Serialize, ToSchema)]
pub struct OutcomeView {
    pub resources: Vec<ResourceView>,
    pub warnings: Vec<&'static str>,
}
impl From<gymtime_app::schedule::ActionOutcome> for OutcomeView {
    fn from(value: gymtime_app::schedule::ActionOutcome) -> Self {
        use gymtime_app::schedule::{ResourceRef as R, ScheduleWarning as W};
        Self {
            resources: value
                .resources
                .into_iter()
                .map(|r| {
                    let (kind, id) = match r {
                        R::User(v) => ("user", v.get()),
                        R::Gym(v) => ("gym", v.get()),
                        R::Season(v) => ("season", v.get()),
                        R::Team(v) => ("team", v.get()),
                        R::Slot(v) => ("slot", v.get()),
                        R::Closure(v) => ("closure", v.get()),
                        R::Booking(v) => ("booking", v.get()),
                        R::Request(v) => ("request", v.get()),
                        R::Swap(v) => ("swap", v.get()),
                    };
                    ResourceView { kind, id }
                })
                .collect(),
            warnings: value
                .warnings
                .into_iter()
                .map(|w| match w {
                    W::CoachOverlap => "coach_overlap",
                    W::SomeDatesUnavailable => "some_dates_unavailable",
                })
                .collect(),
        }
    }
}
pub(super) const fn space(value: GymSpace) -> &'static str {
    match value {
        GymSpace::Full => "full",
        GymSpace::HalfA => "half_a",
        GymSpace::HalfB => "half_b",
    }
}
pub(super) const fn activity(value: Activity) -> &'static str {
    match value {
        Activity::Practice => "practice",
        Activity::Game => "game",
    }
}
/// # Errors
/// Returns safe conversion errors if persisted local times cannot be represented.
pub fn view(
    s: &ScheduleSnapshot,
    user: UserId,
    organizer: bool,
    now: Instant,
) -> Result<ScheduleView, ApiError> {
    Ok(ScheduleView {
        gym: GymView {
            name: s.gym.name.as_str().to_owned(),
            timezone: s.gym.timezone.as_str().to_owned(),
            split: s.gym.split == SplitMode::HalvesAvailable,
            version: s.gym.version.get(),
            hours: s
                .gym
                .hours
                .entries()
                .iter()
                .map(|(d, h)| super::input::HoursBody {
                    weekday: d.get(),
                    start: h.start().as_string(),
                    end: h.end().as_string(),
                })
                .collect(),
        },
        seasons: s
            .seasons
            .iter()
            .map(|v| SeasonView {
                id: v.id.get(),
                name: v.name.as_str().to_owned(),
                start_date: v.dates.start().as_string(),
                end_date: v.dates.end().as_string(),
                status: match v.status {
                    SeasonStatus::Draft => "draft",
                    SeasonStatus::Active => "active",
                    SeasonStatus::Closed => "closed",
                },
                version: v.version.get(),
            })
            .collect(),
        teams: s
            .teams
            .iter()
            .map(|v| TeamView {
                id: v.id.get(),
                name: v.name.as_str().to_owned(),
                primary: v.primary.get(),
                assistants: v.assistants.iter().map(|id| id.get()).collect(),
                seasons: v.seasons.iter().map(|id| id.get()).collect(),
                share_token: (organizer || v.primary == user || v.assistants.contains(&user))
                    .then(|| v.share_token.as_str().to_owned()),
                version: v.version.get(),
            })
            .collect(),
        slots: s
            .slots
            .iter()
            .map(|v| {
                let (date, start) = s
                    .gym
                    .timezone
                    .local_parts(v.interval.start())
                    .map_err(super::map_value)?;
                let (_, end) = s
                    .gym
                    .timezone
                    .local_parts(v.interval.end())
                    .map_err(super::map_value)?;
                Ok(SlotView {
                    id: v.id.get(),
                    season: v.season.get(),
                    date: date.as_string(),
                    start: start.as_string(),
                    end: end.as_string(),
                    starts_at: v.interval.start().epoch_millis(),
                    ends_at: v.interval.end().epoch_millis(),
                    space: space(v.space),
                    enabled: v.enabled,
                    available: s.requestable(v, now),
                    version: v.version.get(),
                })
            })
            .collect::<Result<Vec<_>, ApiError>>()?,
        bookings: s
            .bookings
            .iter()
            .map(|v| BookingView {
                id: v.id.get(),
                team: v.team.get(),
                slot: v.slot.get(),
                series: v.series.as_ref().map(|id| id.as_str().to_owned()),
                activity: activity(v.activity),
                note: v.note.as_str().to_owned(),
                status: match v.status {
                    BookingStatus::Confirmed => "confirmed",
                    BookingStatus::CoachCancelled => "coach_cancelled",
                    BookingStatus::OrganizerCancelled => "organizer_cancelled",
                    BookingStatus::ClosureCancelled => "closure_cancelled",
                },
                version: v.version.get(),
            })
            .collect(),
        requests: s
            .requests
            .iter()
            .map(|v| RequestView {
                id: v.id.get(),
                team: v.team.get(),
                slot: v.slot.get(),
                series: v.series.as_ref().map(|id| id.as_str().to_owned()),
                activity: activity(v.activity),
                note: v.note.as_str().to_owned(),
                reason: v.reason.as_str().to_owned(),
                status: match v.status {
                    RequestStatus::Pending => "pending",
                    RequestStatus::Approved => "approved",
                    RequestStatus::Declined => "declined",
                    RequestStatus::ConflictCancelled => "conflict_cancelled",
                    RequestStatus::Withdrawn => "withdrawn",
                    RequestStatus::ClosureCancelled => "closure_cancelled",
                    RequestStatus::Invalidated => "invalidated",
                },
                replacement: v.replacement.as_ref().map(|v| v.booking.get()),
                version: v.version.get(),
            })
            .collect(),
        swaps: s
            .swaps
            .iter()
            .map(|v| SwapView {
                id: v.id.get(),
                first: v.first.get(),
                second: v.second.get(),
                proposer: v.proposer.get(),
                deadline: v.deadline.epoch_millis(),
                status: match v.status {
                    SwapStatus::Pending => "pending",
                    SwapStatus::Accepted => "accepted",
                    SwapStatus::Declined => "declined",
                    SwapStatus::Withdrawn => "withdrawn",
                    SwapStatus::Expired => "expired",
                    SwapStatus::Invalidated => "invalidated",
                },
                version: v.version.get(),
            })
            .collect(),
        closures: s
            .closures
            .iter()
            .map(|v| ClosureView {
                id: v.id.get(),
                starts_at: v.interval.start().epoch_millis(),
                ends_at: v.interval.end().epoch_millis(),
                space: space(v.space),
                reason: v.reason.as_str().to_owned(),
                active: v.active,
                version: v.version.get(),
            })
            .collect(),
        now: now.epoch_millis(),
    })
}
