//! Flat SQLite rows are decoded into validated scheduling values at this boundary.
use gymtime_app::StorageError;
use gymtime_domain::{
    GymSpace, Instant, Interval,
    auth::{OpaqueToken, UserId},
    schedule::*,
};
use sqlx::{FromRow, SqliteConnection};
use std::collections::BTreeMap;

pub(super) fn value<T, E>(result: Result<T, E>) -> Result<T, StorageError> {
    result.map_err(|_| StorageError::InvalidData)
}
pub(super) fn unavailable(_: sqlx::Error) -> StorageError {
    StorageError::Unavailable
}
pub(super) fn space(raw: &str) -> Result<GymSpace, StorageError> {
    match raw {
        "full" => Ok(GymSpace::Full),
        "half_a" => Ok(GymSpace::HalfA),
        "half_b" => Ok(GymSpace::HalfB),
        _ => Err(StorageError::InvalidData),
    }
}
pub(super) fn space_label(space: GymSpace) -> &'static str {
    match space {
        GymSpace::Full => "full",
        GymSpace::HalfA => "half_a",
        GymSpace::HalfB => "half_b",
    }
}
pub(super) fn activity(raw: &str) -> Result<Activity, StorageError> {
    match raw {
        "practice" => Ok(Activity::Practice),
        "game" => Ok(Activity::Game),
        _ => Err(StorageError::InvalidData),
    }
}
pub(super) fn activity_label(activity: Activity) -> &'static str {
    match activity {
        Activity::Practice => "practice",
        Activity::Game => "game",
    }
}
pub(super) fn booking_status(raw: &str) -> Result<BookingStatus, StorageError> {
    match raw {
        "confirmed" => Ok(BookingStatus::Confirmed),
        "coach_cancelled" => Ok(BookingStatus::CoachCancelled),
        "organizer_cancelled" => Ok(BookingStatus::OrganizerCancelled),
        "closure_cancelled" => Ok(BookingStatus::ClosureCancelled),
        _ => Err(StorageError::InvalidData),
    }
}
pub(super) fn booking_label(status: BookingStatus) -> &'static str {
    match status {
        BookingStatus::Confirmed => "confirmed",
        BookingStatus::CoachCancelled => "coach_cancelled",
        BookingStatus::OrganizerCancelled => "organizer_cancelled",
        BookingStatus::ClosureCancelled => "closure_cancelled",
    }
}
pub(super) fn request_status(raw: &str) -> Result<RequestStatus, StorageError> {
    match raw {
        "pending" => Ok(RequestStatus::Pending),
        "approved" => Ok(RequestStatus::Approved),
        "declined" => Ok(RequestStatus::Declined),
        "conflict_cancelled" => Ok(RequestStatus::ConflictCancelled),
        "withdrawn" => Ok(RequestStatus::Withdrawn),
        "closure_cancelled" => Ok(RequestStatus::ClosureCancelled),
        "invalidated" => Ok(RequestStatus::Invalidated),
        _ => Err(StorageError::InvalidData),
    }
}
pub(super) fn request_label(status: RequestStatus) -> &'static str {
    match status {
        RequestStatus::Pending => "pending",
        RequestStatus::Approved => "approved",
        RequestStatus::Declined => "declined",
        RequestStatus::ConflictCancelled => "conflict_cancelled",
        RequestStatus::Withdrawn => "withdrawn",
        RequestStatus::ClosureCancelled => "closure_cancelled",
        RequestStatus::Invalidated => "invalidated",
    }
}
pub(super) fn season_status(raw: &str) -> Result<SeasonStatus, StorageError> {
    match raw {
        "draft" => Ok(SeasonStatus::Draft),
        "active" => Ok(SeasonStatus::Active),
        "closed" => Ok(SeasonStatus::Closed),
        _ => Err(StorageError::InvalidData),
    }
}
pub(super) fn season_label(status: SeasonStatus) -> &'static str {
    match status {
        SeasonStatus::Draft => "draft",
        SeasonStatus::Active => "active",
        SeasonStatus::Closed => "closed",
    }
}
pub(super) fn swap_status(raw: &str) -> Result<SwapStatus, StorageError> {
    match raw {
        "pending" => Ok(SwapStatus::Pending),
        "accepted" => Ok(SwapStatus::Accepted),
        "declined" => Ok(SwapStatus::Declined),
        "withdrawn" => Ok(SwapStatus::Withdrawn),
        "expired" => Ok(SwapStatus::Expired),
        "invalidated" => Ok(SwapStatus::Invalidated),
        _ => Err(StorageError::InvalidData),
    }
}
pub(super) fn swap_label(status: SwapStatus) -> &'static str {
    match status {
        SwapStatus::Pending => "pending",
        SwapStatus::Accepted => "accepted",
        SwapStatus::Declined => "declined",
        SwapStatus::Withdrawn => "withdrawn",
        SwapStatus::Expired => "expired",
        SwapStatus::Invalidated => "invalidated",
    }
}
fn token(raw: &str) -> Result<OpaqueToken, StorageError> {
    value(OpaqueToken::try_from(raw))
}
fn optional_token(raw: Option<String>) -> Result<Option<OpaqueToken>, StorageError> {
    raw.map(|raw| token(&raw)).transpose()
}
fn interval(start: i64, end: i64) -> Result<Interval, StorageError> {
    value(Interval::new(
        Instant::from_epoch_millis(start),
        Instant::from_epoch_millis(end),
    ))
}

#[derive(FromRow)]
struct SeasonRow {
    id: i64,
    name: String,
    starts_on: String,
    ends_on: String,
    status: String,
    version: i64,
}
impl TryFrom<SeasonRow> for Season {
    type Error = StorageError;
    fn try_from(r: SeasonRow) -> Result<Self, Self::Error> {
        Ok(Self {
            id: value(SeasonId::try_from(r.id))?,
            name: value(Name::try_from(r.name.as_str()))?,
            dates: value(DateRange::new(
                value(LocalDate::try_from(r.starts_on.as_str()))?,
                value(LocalDate::try_from(r.ends_on.as_str()))?,
            ))?,
            status: season_status(&r.status)?,
            version: value(Version::try_from(r.version))?,
        })
    }
}
#[derive(FromRow)]
struct TeamRow {
    id: i64,
    name: String,
    share_token: String,
    version: i64,
}
#[derive(FromRow)]
struct GrantRow {
    team_id: i64,
    user_id: i64,
    role: String,
}
#[derive(FromRow)]
struct SlotRow {
    id: i64,
    season_id: i64,
    local_date: String,
    local_start: String,
    local_end: String,
    starts_at: i64,
    ends_at: i64,
    space: String,
    enabled: bool,
    version: i64,
}
impl TryFrom<SlotRow> for Slot {
    type Error = StorageError;
    fn try_from(r: SlotRow) -> Result<Self, Self::Error> {
        Ok(Self {
            id: value(SlotId::try_from(r.id))?,
            season: value(SeasonId::try_from(r.season_id))?,
            date: value(LocalDate::try_from(r.local_date.as_str()))?,
            hours: value(OpeningHours::new(
                value(LocalTime::try_from(r.local_start.as_str()))?,
                value(LocalTime::try_from(r.local_end.as_str()))?,
            ))?,
            interval: interval(r.starts_at, r.ends_at)?,
            space: space(&r.space)?,
            enabled: r.enabled,
            version: value(Version::try_from(r.version))?,
        })
    }
}
#[derive(FromRow)]
struct ClosureRow {
    id: i64,
    starts_at: i64,
    ends_at: i64,
    space: String,
    reason: String,
    active: bool,
    version: i64,
}
impl TryFrom<ClosureRow> for Closure {
    type Error = StorageError;
    fn try_from(r: ClosureRow) -> Result<Self, Self::Error> {
        let reason = value(Note::try_from(r.reason.as_str()))?;
        if reason.is_empty() {
            return Err(StorageError::InvalidData);
        }
        Ok(Self {
            id: value(ClosureId::try_from(r.id))?,
            interval: interval(r.starts_at, r.ends_at)?,
            space: space(&r.space)?,
            reason,
            active: r.active,
            version: value(Version::try_from(r.version))?,
        })
    }
}
#[derive(FromRow)]
struct BookingRow {
    id: i64,
    team_id: i64,
    slot_id: i64,
    series_id: Option<String>,
    calendar_uid: String,
    activity: String,
    note: String,
    status: String,
    version: i64,
    created_at: i64,
    changed_at: i64,
}
impl TryFrom<BookingRow> for Booking {
    type Error = StorageError;
    fn try_from(r: BookingRow) -> Result<Self, Self::Error> {
        Ok(Self {
            id: value(BookingId::try_from(r.id))?,
            team: value(TeamId::try_from(r.team_id))?,
            slot: value(SlotId::try_from(r.slot_id))?,
            series: optional_token(r.series_id)?,
            calendar_uid: token(&r.calendar_uid)?,
            activity: activity(&r.activity)?,
            note: value(Note::try_from(r.note.as_str()))?,
            status: booking_status(&r.status)?,
            version: value(Version::try_from(r.version))?,
            created: Instant::from_epoch_millis(r.created_at),
            changed: Instant::from_epoch_millis(r.changed_at),
        })
    }
}
#[derive(FromRow)]
struct RequestRow {
    id: i64,
    team_id: i64,
    slot_id: i64,
    series_id: Option<String>,
    activity: String,
    note: String,
    competing_reason: String,
    status: String,
    replaces_booking_id: Option<i64>,
    replaces_version: Option<i64>,
    created_by: i64,
    created_at: i64,
    version: i64,
}
impl TryFrom<RequestRow> for BookingRequest {
    type Error = StorageError;
    fn try_from(r: RequestRow) -> Result<Self, Self::Error> {
        let replacement = match (r.replaces_booking_id, r.replaces_version) {
            (None, None) => None,
            (Some(id), Some(version)) => Some(PendingReplacement {
                booking: value(BookingId::try_from(id))?,
                version: value(Version::try_from(version))?,
            }),
            (None, Some(_)) | (Some(_), None) => return Err(StorageError::InvalidData),
        };
        Ok(Self {
            id: value(RequestId::try_from(r.id))?,
            team: value(TeamId::try_from(r.team_id))?,
            slot: value(SlotId::try_from(r.slot_id))?,
            series: optional_token(r.series_id)?,
            activity: activity(&r.activity)?,
            note: value(Note::try_from(r.note.as_str()))?,
            reason: value(Note::try_from(r.competing_reason.as_str()))?,
            status: request_status(&r.status)?,
            replacement,
            creator: value(UserId::try_from(r.created_by))?,
            created: Instant::from_epoch_millis(r.created_at),
            version: value(Version::try_from(r.version))?,
        })
    }
}
#[derive(FromRow)]
struct SwapRow {
    id: i64,
    first_booking_id: i64,
    second_booking_id: i64,
    first_version: i64,
    second_version: i64,
    proposed_by: i64,
    proposed_at: i64,
    deadline: i64,
    status: String,
    version: i64,
}
impl TryFrom<SwapRow> for Swap {
    type Error = StorageError;
    fn try_from(r: SwapRow) -> Result<Self, Self::Error> {
        Ok(Self {
            id: value(SwapId::try_from(r.id))?,
            first: value(BookingId::try_from(r.first_booking_id))?,
            second: value(BookingId::try_from(r.second_booking_id))?,
            first_version: value(Version::try_from(r.first_version))?,
            second_version: value(Version::try_from(r.second_version))?,
            proposer: value(UserId::try_from(r.proposed_by))?,
            proposed: Instant::from_epoch_millis(r.proposed_at),
            deadline: Instant::from_epoch_millis(r.deadline),
            status: swap_status(&r.status)?,
            version: value(Version::try_from(r.version))?,
        })
    }
}

pub(super) async fn load(conn: &mut SqliteConnection) -> Result<ScheduleSnapshot, StorageError> {
    let (name, timezone, split, version): (String, String, bool, i64) =
        sqlx::query_as("SELECT name,timezone,split_enabled,version FROM gym_settings WHERE id=1")
            .fetch_one(&mut *conn)
            .await
            .map_err(unavailable)?;
    let hours: Vec<(i64, String, String)> =
        sqlx::query_as("SELECT weekday,opens,closes FROM gym_hours ORDER BY weekday")
            .fetch_all(&mut *conn)
            .await
            .map_err(unavailable)?;
    let hours = hours
        .into_iter()
        .map(|(day, start, end)| {
            Ok((
                value(Weekday::try_from(value(u32::try_from(day))?))?,
                value(OpeningHours::new(
                    value(LocalTime::try_from(start.as_str()))?,
                    value(LocalTime::try_from(end.as_str()))?,
                ))?,
            ))
        })
        .collect::<Result<Vec<_>, StorageError>>()?;
    let gym = GymSettings {
        name: value(Name::try_from(name.as_str()))?,
        timezone: value(GymTimezone::try_from(timezone.as_str()))?,
        split: if split {
            SplitMode::HalvesAvailable
        } else {
            SplitMode::WholeOnly
        },
        hours: value(WeeklyHours::try_from(hours))?,
        version: value(Version::try_from(version))?,
    };
    let seasons =
        sqlx::query_as::<_, SeasonRow>("SELECT * FROM seasons ORDER BY starts_on DESC,id DESC")
            .fetch_all(&mut *conn)
            .await
            .map_err(unavailable)?
            .into_iter()
            .map(Season::try_from)
            .collect::<Result<_, _>>()?;
    let rows = sqlx::query_as::<_, TeamRow>("SELECT * FROM teams ORDER BY name,id")
        .fetch_all(&mut *conn)
        .await
        .map_err(unavailable)?;
    let grants =
        sqlx::query_as::<_, GrantRow>("SELECT * FROM team_grants ORDER BY team_id,user_id")
            .fetch_all(&mut *conn)
            .await
            .map_err(unavailable)?;
    let associations: Vec<(i64, i64)> =
        sqlx::query_as("SELECT team_id,season_id FROM team_seasons ORDER BY team_id,season_id")
            .fetch_all(&mut *conn)
            .await
            .map_err(unavailable)?;
    let mut by_team = BTreeMap::<i64, Vec<GrantRow>>::new();
    for grant in grants {
        by_team.entry(grant.team_id).or_default().push(grant);
    }
    let mut by_season = BTreeMap::<i64, Vec<SeasonId>>::new();
    for (team, season) in associations {
        by_season
            .entry(team)
            .or_default()
            .push(value(SeasonId::try_from(season))?);
    }
    let teams = rows
        .into_iter()
        .map(|row| {
            let grants = by_team.remove(&row.id).unwrap_or_default();
            let primary = grants
                .iter()
                .filter(|g| g.role == "primary")
                .collect::<Vec<_>>();
            if primary.len() != 1
                || grants
                    .iter()
                    .any(|g| g.role != "primary" && g.role != "assistant")
            {
                return Err(StorageError::InvalidData);
            }
            let primary = value(UserId::try_from(
                primary.first().ok_or(StorageError::InvalidData)?.user_id,
            ))?;
            let assistants = grants
                .into_iter()
                .filter(|g| g.role == "assistant")
                .map(|g| value(UserId::try_from(g.user_id)))
                .collect::<Result<_, _>>()?;
            Ok(Team {
                id: value(TeamId::try_from(row.id))?,
                name: value(Name::try_from(row.name.as_str()))?,
                primary,
                assistants,
                share_token: token(&row.share_token)?,
                version: value(Version::try_from(row.version))?,
                seasons: by_season.remove(&row.id).unwrap_or_default(),
            })
        })
        .collect::<Result<Vec<_>, StorageError>>()?;
    let slots = sqlx::query_as::<_, SlotRow>("SELECT * FROM slots ORDER BY starts_at,space,id")
        .fetch_all(&mut *conn)
        .await
        .map_err(unavailable)?
        .into_iter()
        .map(Slot::try_from)
        .collect::<Result<_, _>>()?;
    let closures = sqlx::query_as::<_, ClosureRow>("SELECT * FROM closures ORDER BY starts_at,id")
        .fetch_all(&mut *conn)
        .await
        .map_err(unavailable)?
        .into_iter()
        .map(Closure::try_from)
        .collect::<Result<_, _>>()?;
    let bookings = sqlx::query_as::<_, BookingRow>("SELECT * FROM bookings ORDER BY id")
        .fetch_all(&mut *conn)
        .await
        .map_err(unavailable)?
        .into_iter()
        .map(Booking::try_from)
        .collect::<Result<_, _>>()?;
    let requests =
        sqlx::query_as::<_, RequestRow>("SELECT * FROM booking_requests ORDER BY created_at,id")
            .fetch_all(&mut *conn)
            .await
            .map_err(unavailable)?
            .into_iter()
            .map(BookingRequest::try_from)
            .collect::<Result<_, _>>()?;
    let swaps = sqlx::query_as::<_, SwapRow>("SELECT * FROM swaps ORDER BY proposed_at,id")
        .fetch_all(&mut *conn)
        .await
        .map_err(unavailable)?
        .into_iter()
        .map(Swap::try_from)
        .collect::<Result<_, _>>()?;
    Ok(ScheduleSnapshot {
        gym,
        seasons,
        teams,
        slots,
        closures,
        bookings,
        requests,
        swaps,
    })
}
