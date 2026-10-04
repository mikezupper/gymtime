//! Pure values for organizer-defined schedules, expanded in the gym's local timezone.
use crate::auth::{OpaqueToken, UserId};
use crate::{GymSpace, Instant, Interval};
use chrono::{Datelike, Days, LocalResult, NaiveDate, TimeZone};
use chrono_tz::Tz;
use thiserror::Error;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum ScheduleValueError {
    #[error("a positive identifier or version is required")]
    Identifier,
    #[error("use a short, nonempty name without control characters")]
    Name,
    #[error("use a date from 2000 through 2100 in YYYY-MM-DD format")]
    Date,
    #[error("use a time in HH:MM format")]
    Time,
    #[error("choose an IANA timezone")]
    Timezone,
    #[error("end must be after start, within a season no longer than 366 days")]
    Range,
    #[error("this local time does not exist because the clocks move forward")]
    NonexistentTime,
    #[error("this local time occurs twice because the clocks move back; choose another time")]
    AmbiguousTime,
    #[error("choose at least one weekday")]
    Weekdays,
    #[error(
        "notes must be at most 2000 characters and contain no control characters except newlines"
    )]
    Note,
    #[error("select between one and 366 distinct occurrences")]
    Selection,
}
pub struct Selection<T>(Vec<T>);
impl<T: PartialEq> TryFrom<Vec<T>> for Selection<T> {
    type Error = ScheduleValueError;
    fn try_from(values: Vec<T>) -> Result<Self, Self::Error> {
        if values.is_empty()
            || values.len() > 366
            || values
                .iter()
                .enumerate()
                .any(|(index, value)| values.iter().take(index).any(|other| other == value))
        {
            return Err(ScheduleValueError::Selection);
        }
        Ok(Self(values))
    }
}
impl<T> Selection<T> {
    #[must_use]
    pub fn items(&self) -> &[T] {
        &self.0
    }
}
macro_rules! id {
    ($name:ident) => {
        #[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
        pub struct $name(i64);
        impl TryFrom<i64> for $name {
            type Error = ScheduleValueError;
            fn try_from(value: i64) -> Result<Self, Self::Error> {
                if value <= 0 {
                    return Err(ScheduleValueError::Identifier);
                }
                Ok(Self(value))
            }
        }
        impl $name {
            #[must_use]
            pub const fn get(self) -> i64 {
                self.0
            }
        }
    };
}
id!(SeasonId);
id!(TeamId);
id!(SlotId);
id!(BookingId);
id!(RequestId);
id!(SwapId);
id!(ClosureId);
id!(Version);

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Name(String);
impl TryFrom<&str> for Name {
    type Error = ScheduleValueError;
    fn try_from(raw: &str) -> Result<Self, Self::Error> {
        let value = raw.trim();
        if value.is_empty() || value.chars().count() > 120 || value.chars().any(char::is_control) {
            return Err(ScheduleValueError::Name);
        }
        Ok(Self(value.to_owned()))
    }
}
impl Name {
    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.0
    }
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Note(String);
impl TryFrom<&str> for Note {
    type Error = ScheduleValueError;
    fn try_from(raw: &str) -> Result<Self, Self::Error> {
        let value = raw.trim();
        if value.chars().count() > 2000
            || value
                .chars()
                .any(|c| c.is_control() && !matches!(c, '\n' | '\r' | '\t'))
        {
            return Err(ScheduleValueError::Note);
        }
        Ok(Self(value.to_owned()))
    }
}
impl Note {
    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.0
    }
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct LocalDate(NaiveDate);
impl TryFrom<&str> for LocalDate {
    type Error = ScheduleValueError;
    fn try_from(raw: &str) -> Result<Self, Self::Error> {
        let value =
            NaiveDate::parse_from_str(raw, "%Y-%m-%d").map_err(|_| ScheduleValueError::Date)?;
        if !(2000..=2100).contains(&value.year()) || value.format("%Y-%m-%d").to_string() != raw {
            return Err(ScheduleValueError::Date);
        }
        Ok(Self(value))
    }
}
impl LocalDate {
    #[must_use]
    pub fn as_string(self) -> String {
        self.0.format("%Y-%m-%d").to_string()
    }
    #[must_use]
    pub fn weekday(self) -> u32 {
        self.0.weekday().num_days_from_monday()
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct LocalTime(u32);
impl TryFrom<&str> for LocalTime {
    type Error = ScheduleValueError;
    fn try_from(raw: &str) -> Result<Self, Self::Error> {
        let (hour, minute) = raw.split_once(':').ok_or(ScheduleValueError::Time)?;
        let hour = hour.parse::<u32>().map_err(|_| ScheduleValueError::Time)?;
        let minute = minute
            .parse::<u32>()
            .map_err(|_| ScheduleValueError::Time)?;
        if hour > 23 || minute > 59 || format!("{hour:02}:{minute:02}") != raw {
            return Err(ScheduleValueError::Time);
        }
        Ok(Self(hour * 60 + minute))
    }
}
impl LocalTime {
    #[must_use]
    pub fn as_string(self) -> String {
        format!("{:02}:{:02}", self.0 / 60, self.0 % 60)
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct GymTimezone(Tz);
impl TryFrom<&str> for GymTimezone {
    type Error = ScheduleValueError;
    fn try_from(raw: &str) -> Result<Self, Self::Error> {
        raw.parse::<Tz>()
            .map(Self)
            .map_err(|_| ScheduleValueError::Timezone)
    }
}
impl GymTimezone {
    #[must_use]
    pub fn as_str(&self) -> &str {
        self.0.name()
    }
    /// # Errors
    /// Rejects nonexistent and ambiguous local times rather than silently shifting them.
    pub fn resolve(self, date: LocalDate, time: LocalTime) -> Result<Instant, ScheduleValueError> {
        let local = date
            .0
            .and_hms_opt(time.0 / 60, time.0 % 60, 0)
            .ok_or(ScheduleValueError::Time)?;
        match self.0.from_local_datetime(&local) {
            LocalResult::Single(value) => Ok(Instant::from_epoch_millis(value.timestamp_millis())),
            LocalResult::None => Err(ScheduleValueError::NonexistentTime),
            LocalResult::Ambiguous(_, _) => Err(ScheduleValueError::AmbiguousTime),
        }
    }
    /// # Errors
    /// Returns Date for an instant outside the supported calendar range.
    pub fn local_parts(
        self,
        instant: Instant,
    ) -> Result<(LocalDate, LocalTime), ScheduleValueError> {
        let value = chrono::DateTime::from_timestamp_millis(instant.epoch_millis())
            .ok_or(ScheduleValueError::Date)?
            .with_timezone(&self.0);
        Ok((
            LocalDate::try_from(value.format("%Y-%m-%d").to_string().as_str())?,
            LocalTime::try_from(value.format("%H:%M").to_string().as_str())?,
        ))
    }
    /// # Errors
    /// Returns Date for an instant outside the application's supported calendar range.
    pub fn local_date(self, instant: Instant) -> Result<LocalDate, ScheduleValueError> {
        let value = chrono::DateTime::from_timestamp_millis(instant.epoch_millis())
            .ok_or(ScheduleValueError::Date)?
            .with_timezone(&self.0)
            .date_naive();
        LocalDate::try_from(value.format("%Y-%m-%d").to_string().as_str())
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct DateRange {
    start: LocalDate,
    end: LocalDate,
}
impl DateRange {
    /// # Errors
    /// Rejects reversed ranges and seasons longer than 366 dates.
    pub fn new(start: LocalDate, end: LocalDate) -> Result<Self, ScheduleValueError> {
        if end < start || (end.0 - start.0).num_days() > 365 {
            return Err(ScheduleValueError::Range);
        }
        Ok(Self { start, end })
    }
    #[must_use]
    pub const fn start(self) -> LocalDate {
        self.start
    }
    #[must_use]
    pub const fn end(self) -> LocalDate {
        self.end
    }
    #[must_use]
    pub fn contains(self, date: LocalDate) -> bool {
        self.start <= date && date <= self.end
    }
    #[must_use]
    pub fn dates(self) -> Vec<LocalDate> {
        (0..=365)
            .filter_map(|day| self.start.0.checked_add_days(Days::new(day)))
            .take_while(|date| *date <= self.end.0)
            .map(LocalDate)
            .collect()
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct OpeningHours {
    start: LocalTime,
    end: LocalTime,
}
impl OpeningHours {
    /// # Errors
    /// Rejects empty, reversed, and overnight hours.
    pub fn new(start: LocalTime, end: LocalTime) -> Result<Self, ScheduleValueError> {
        if start >= end {
            return Err(ScheduleValueError::Range);
        }
        Ok(Self { start, end })
    }
    #[must_use]
    pub const fn start(self) -> LocalTime {
        self.start
    }
    #[must_use]
    pub const fn end(self) -> LocalTime {
        self.end
    }
    #[must_use]
    pub const fn contains(self, other: Self) -> bool {
        self.start.0 <= other.start.0 && other.end.0 <= self.end.0
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SeasonStatus {
    Draft,
    Active,
    Closed,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CoachRole {
    Primary,
    Assistant,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Activity {
    Practice,
    Game,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RequestStatus {
    Pending,
    Approved,
    Declined,
    ConflictCancelled,
    Withdrawn,
    ClosureCancelled,
    Invalidated,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BookingStatus {
    Confirmed,
    CoachCancelled,
    OrganizerCancelled,
    ClosureCancelled,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SwapStatus {
    Pending,
    Accepted,
    Declined,
    Withdrawn,
    Expired,
    Invalidated,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SeriesScope {
    One,
    Future,
    Remaining,
}
#[derive(Clone, Debug)]
pub struct Season {
    pub id: SeasonId,
    pub name: Name,
    pub dates: DateRange,
    pub status: SeasonStatus,
    pub version: Version,
}
#[derive(Clone, Debug)]
pub struct Slot {
    pub id: SlotId,
    pub season: SeasonId,
    pub date: LocalDate,
    pub hours: OpeningHours,
    pub interval: Interval,
    pub space: GymSpace,
    pub enabled: bool,
    pub version: Version,
}
#[derive(Clone, Debug)]
pub struct SlotOccurrence {
    pub date: LocalDate,
    pub hours: OpeningHours,
    pub interval: Interval,
    pub space: GymSpace,
}
#[derive(Clone, Debug)]
pub struct Weekdays(Vec<u32>);
impl TryFrom<Vec<u32>> for Weekdays {
    type Error = ScheduleValueError;
    fn try_from(mut days: Vec<u32>) -> Result<Self, Self::Error> {
        if days.is_empty() || days.iter().any(|day| *day > 6) {
            return Err(ScheduleValueError::Weekdays);
        }
        days.sort_unstable();
        days.dedup();
        Ok(Self(days))
    }
}
impl Weekdays {
    #[must_use]
    pub fn as_slice(&self) -> &[u32] {
        &self.0
    }
    #[must_use]
    pub fn includes(&self, date: LocalDate) -> bool {
        self.0.contains(&date.weekday())
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SplitMode {
    WholeOnly,
    HalvesAvailable,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Weekday(u32);
impl TryFrom<u32> for Weekday {
    type Error = ScheduleValueError;
    fn try_from(value: u32) -> Result<Self, Self::Error> {
        if value > 6 {
            return Err(ScheduleValueError::Weekdays);
        }
        Ok(Self(value))
    }
}
impl Weekday {
    #[must_use]
    pub const fn get(self) -> u32 {
        self.0
    }
}
#[derive(Clone)]
pub struct WeeklyHours(Vec<(Weekday, OpeningHours)>);
impl TryFrom<Vec<(Weekday, OpeningHours)>> for WeeklyHours {
    type Error = ScheduleValueError;
    fn try_from(hours: Vec<(Weekday, OpeningHours)>) -> Result<Self, Self::Error> {
        let unique: std::collections::BTreeSet<_> =
            hours.iter().map(|(day, _)| day.get()).collect();
        // Each validated weekday is in 0..7; uniqueness also bounds the count.
        if unique.len() != hours.len() {
            return Err(ScheduleValueError::Weekdays);
        }
        Ok(Self(hours))
    }
}
impl WeeklyHours {
    #[must_use]
    pub fn entries(&self) -> &[(Weekday, OpeningHours)] {
        &self.0
    }
    #[must_use]
    pub fn on(&self, date: LocalDate) -> Option<OpeningHours> {
        self.0
            .iter()
            .find(|(day, _)| day.get() == date.weekday())
            .map(|(_, hours)| *hours)
    }
}
#[derive(Clone)]
pub struct GymSettings {
    pub name: Name,
    pub timezone: GymTimezone,
    pub split: SplitMode,
    pub hours: WeeklyHours,
    pub version: Version,
}
#[derive(Clone)]
pub struct Team {
    pub id: TeamId,
    pub name: Name,
    pub primary: UserId,
    pub assistants: Vec<UserId>,
    pub share_token: OpaqueToken,
    pub version: Version,
    pub seasons: Vec<SeasonId>,
}
#[derive(Clone)]
pub struct Closure {
    pub id: ClosureId,
    pub interval: Interval,
    pub space: GymSpace,
    pub reason: Note,
    pub active: bool,
    pub version: Version,
}
#[derive(Clone)]
pub struct Booking {
    pub id: BookingId,
    pub team: TeamId,
    pub slot: SlotId,
    pub series: Option<OpaqueToken>,
    pub calendar_uid: OpaqueToken,
    pub activity: Activity,
    pub note: Note,
    pub status: BookingStatus,
    pub version: Version,
    pub created: Instant,
    pub changed: Instant,
}
#[derive(Clone)]
pub struct PendingReplacement {
    pub booking: BookingId,
    pub version: Version,
}
#[derive(Clone)]
pub struct BookingRequest {
    pub id: RequestId,
    pub team: TeamId,
    pub slot: SlotId,
    pub series: Option<OpaqueToken>,
    pub activity: Activity,
    pub note: Note,
    pub reason: Note,
    pub status: RequestStatus,
    pub replacement: Option<PendingReplacement>,
    pub creator: UserId,
    pub created: Instant,
    pub version: Version,
}
#[derive(Clone)]
pub struct Swap {
    pub id: SwapId,
    pub first: BookingId,
    pub second: BookingId,
    pub first_version: Version,
    pub second_version: Version,
    pub proposer: UserId,
    pub proposed: Instant,
    pub deadline: Instant,
    pub status: SwapStatus,
    pub version: Version,
}
#[derive(Clone)]
pub struct ScheduleSnapshot {
    pub gym: GymSettings,
    pub seasons: Vec<Season>,
    pub teams: Vec<Team>,
    pub slots: Vec<Slot>,
    pub closures: Vec<Closure>,
    pub bookings: Vec<Booking>,
    pub requests: Vec<BookingRequest>,
    pub swaps: Vec<Swap>,
}
impl ScheduleSnapshot {
    #[must_use]
    pub fn requestable(&self, slot: &Slot, now: Instant) -> bool {
        slot.enabled
            && slot.interval.end() > now
            && (slot.space == GymSpace::Full || self.gym.split == SplitMode::HalvesAvailable)
            && self
                .season(slot.season)
                .is_some_and(|season| season.status == SeasonStatus::Active)
            && !self.closed(slot)
            && self.conflicting_bookings(slot, &[]).is_empty()
    }
    #[must_use]
    pub fn slot(&self, id: SlotId) -> Option<&Slot> {
        self.slots.iter().find(|slot| slot.id == id)
    }
    #[must_use]
    pub fn team(&self, id: TeamId) -> Option<&Team> {
        self.teams.iter().find(|team| team.id == id)
    }
    #[must_use]
    pub fn booking(&self, id: BookingId) -> Option<&Booking> {
        self.bookings.iter().find(|booking| booking.id == id)
    }
    #[must_use]
    pub fn season(&self, id: SeasonId) -> Option<&Season> {
        self.seasons.iter().find(|season| season.id == id)
    }
    #[must_use]
    pub fn closed(&self, slot: &Slot) -> bool {
        self.closures.iter().any(|closure| {
            closure.active
                && crate::conflicts(
                    (closure.space, closure.interval),
                    (slot.space, slot.interval),
                )
        })
    }
    #[must_use]
    pub fn conflicting_bookings(&self, slot: &Slot, except: &[BookingId]) -> Vec<BookingId> {
        self.bookings
            .iter()
            .filter(|booking| {
                booking.status == BookingStatus::Confirmed && !except.contains(&booking.id)
            })
            .filter_map(|booking| self.slot(booking.slot).map(|assigned| (booking, assigned)))
            .filter(|(_, assigned)| {
                crate::conflicts(
                    (assigned.space, assigned.interval),
                    (slot.space, slot.interval),
                )
            })
            .map(|(booking, _)| booking.id)
            .collect()
    }
    #[must_use]
    pub fn competing_requests(&self, slot: &Slot, except: &[RequestId]) -> Vec<RequestId> {
        self.requests
            .iter()
            .filter(|request| {
                request.status == RequestStatus::Pending && !except.contains(&request.id)
            })
            .filter_map(|request| self.slot(request.slot).map(|assigned| (request, assigned)))
            .filter(|(_, assigned)| {
                crate::conflicts(
                    (assigned.space, assigned.interval),
                    (slot.space, slot.interval),
                )
            })
            .map(|(request, _)| request.id)
            .collect()
    }
}

/// # Errors
/// Returns the precise date and issue for each DST-invalid occurrence.
#[must_use]
pub fn expand_slots(
    timezone: GymTimezone,
    dates: DateRange,
    weekdays: &Weekdays,
    hours: OpeningHours,
    space: GymSpace,
) -> Vec<(LocalDate, Result<SlotOccurrence, ScheduleValueError>)> {
    dates
        .dates()
        .into_iter()
        .filter(|date| weekdays.includes(*date))
        .map(|date| {
            let result = (|| {
                let start = timezone.resolve(date, hours.start)?;
                let end = timezone.resolve(date, hours.end)?;
                let interval = Interval::new(start, end).map_err(|_| ScheduleValueError::Range)?;
                Ok(SlotOccurrence {
                    date,
                    hours,
                    interval,
                    space,
                })
            })();
            (date, result)
        })
        .collect()
}

#[cfg(test)]
#[allow(clippy::expect_used)]
mod tests {
    use super::*;
    use proptest::prelude::*;
    fn date(s: &str) -> LocalDate {
        LocalDate::try_from(s).expect("invariant: valid fixture date")
    }
    fn time(s: &str) -> LocalTime {
        LocalTime::try_from(s).expect("invariant: valid fixture time")
    }
    #[test]
    fn slot_expansion_preserves_wall_time_across_dst_and_rejects_gaps_and_folds() {
        let zone = GymTimezone::try_from("America/New_York").expect("invariant: IANA fixture zone");
        assert_eq!(
            zone.resolve(date("2026-03-08"), time("02:30")),
            Err(ScheduleValueError::NonexistentTime)
        );
        assert_eq!(
            zone.resolve(date("2026-11-01"), time("01:30")),
            Err(ScheduleValueError::AmbiguousTime)
        );
        let dates = DateRange::new(date("2026-03-01"), date("2026-03-15"))
            .expect("invariant: ordered range");
        let days = Weekdays::try_from(vec![6]).expect("invariant: Sunday");
        let hours =
            OpeningHours::new(time("09:00"), time("10:00")).expect("invariant: ordered hours");
        let slots = expand_slots(zone, dates, &days, hours, GymSpace::Full);
        assert_eq!(slots.len(), 3);
        let values: Vec<_> = slots
            .into_iter()
            .map(|(_, slot)| {
                slot.expect("invariant: morning avoids DST ambiguity")
                    .interval
                    .start()
                    .epoch_millis()
            })
            .collect();
        assert_eq!(
            values.get(1).expect("invariant: middle slot")
                - values.first().expect("invariant: first slot"),
            7 * 24 * 60 * 60 * 1000 - 60 * 60 * 1000
        );
    }
    #[test]
    fn date_and_opening_hour_boundaries_exclude_values_on_either_side() {
        let range = DateRange::new(date("2026-10-05"), date("2026-10-12"))
            .expect("invariant: ordered dates");
        for value in ["2026-10-05", "2026-10-08", "2026-10-12"] {
            assert!(range.contains(date(value)));
        }
        for value in ["2026-10-04", "2026-10-13"] {
            assert!(!range.contains(date(value)));
        }
        let hours =
            OpeningHours::new(time("08:00"), time("22:00")).expect("invariant: opening hours");
        for (start, end, expected) in [
            ("08:00", "22:00", true),
            ("09:15", "10:45", true),
            ("07:59", "09:00", false),
            ("21:00", "22:01", false),
        ] {
            assert_eq!(
                hours.contains(
                    OpeningHours::new(time(start), time(end)).expect("invariant: ordered times")
                ),
                expected
            );
        }
        let monday = Weekday::try_from(0).expect("invariant: weekday");
        assert!(WeeklyHours::try_from(vec![(monday, hours), (monday, hours)]).is_err());
    }
    proptest! {
        #[test] fn timezone_resolution_round_trips_non_hour_minutes(hour in 0u32..24, minute in 0u32..60) {
            let zone = GymTimezone::try_from("America/New_York").expect("invariant: known zone");
            let day = date("2026-10-05");
            let time = time(&format!("{hour:02}:{minute:02}"));
            let instant = zone.resolve(day, time).expect("invariant: date without DST transition");
            prop_assert_eq!(zone.local_parts(instant).expect("invariant: representable timestamp"), (day, time));
        }
        #[test] fn local_times_round_trip(hour in 0u32..24,minute in 0u32..60){let raw=format!("{hour:02}:{minute:02}");let value=LocalTime::try_from(raw.as_str()).expect("invariant: generated valid time");prop_assert_eq!(value.as_string(),raw);}
        #[test] fn dates_round_trip_and_ranges_include_each_date(day in 1u32..29){let raw=format!("2026-02-{day:02}");let value=LocalDate::try_from(raw.as_str()).expect("invariant: generated valid February date");prop_assert_eq!(value.as_string(),raw);let range=DateRange::new(date("2026-02-01"),value).expect("invariant: ordered");prop_assert_eq!(range.dates().len(),usize::try_from(day).expect("invariant: small day"));prop_assert!(range.dates().into_iter().all(|d|range.contains(d)));}
    }
}
