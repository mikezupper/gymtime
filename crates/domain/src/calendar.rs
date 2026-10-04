//! Public projections and RFC 5545 encoding never include internal notes or requests.
use crate::{GymSpace, Instant, auth::OpaqueToken, schedule::*};
pub struct PublicEvent {
    pub uid: OpaqueToken,
    pub sequence: i64,
    pub interval: crate::Interval,
    pub changed: Instant,
    pub activity: Activity,
    pub space: GymSpace,
    pub cancelled: bool,
}
pub struct PublicCalendar {
    pub team: Name,
    pub gym: Name,
    pub timezone: GymTimezone,
    pub events: Vec<PublicEvent>,
}
impl PublicCalendar {
    #[must_use]
    pub fn project(snapshot: &ScheduleSnapshot, team: &Team) -> Self {
        let mut events = snapshot
            .bookings
            .iter()
            .filter(|b| b.team == team.id)
            .filter_map(|b| {
                let slot = snapshot.slot(b.slot)?;
                if snapshot.season(slot.season)?.status == SeasonStatus::Draft {
                    return None;
                }
                Some(PublicEvent {
                    uid: b.calendar_uid.clone(),
                    sequence: b.version.get() - 1,
                    interval: slot.interval,
                    changed: b.changed,
                    activity: b.activity,
                    space: slot.space,
                    cancelled: b.status != BookingStatus::Confirmed,
                })
            })
            .collect::<Vec<_>>();
        events.sort_by_key(|event| event.interval.start());
        Self {
            team: team.name.clone(),
            gym: snapshot.gym.name.clone(),
            timezone: snapshot.gym.timezone,
            events,
        }
    }
    /// # Errors
    /// Returns Date if an event timestamp cannot be represented as an RFC 5545 UTC date-time.
    pub fn icalendar(&self) -> Result<String, ScheduleValueError> {
        let mut lines = vec![
            "BEGIN:VCALENDAR".to_owned(),
            "VERSION:2.0".to_owned(),
            "PRODID:-//Gymtime//Team Schedule//EN".to_owned(),
            "CALSCALE:GREGORIAN".to_owned(),
            format!("X-WR-CALNAME:{}", escape(self.team.as_str())),
            format!("X-WR-TIMEZONE:{}", self.timezone.as_str()),
        ];
        for event in &self.events {
            let activity = match event.activity {
                Activity::Practice => "Practice",
                Activity::Game => "Game",
            };
            let space = match event.space {
                GymSpace::Full => "Full gym",
                GymSpace::HalfA => "Half A",
                GymSpace::HalfB => "Half B",
            };
            lines.extend([
                "BEGIN:VEVENT".to_owned(),
                format!("UID:{}@gymtime", event.uid.as_str()),
                format!("SEQUENCE:{}", event.sequence),
                format!("DTSTAMP:{}", utc(event.changed)?),
                format!("LAST-MODIFIED:{}", utc(event.changed)?),
                format!("DTSTART:{}", utc(event.interval.start())?),
                format!("DTEND:{}", utc(event.interval.end())?),
                format!(
                    "SUMMARY:{}",
                    escape(&format!("{} — {activity}", self.team.as_str()))
                ),
                format!(
                    "LOCATION:{}",
                    escape(&format!("{} · {space}", self.gym.as_str()))
                ),
                format!(
                    "STATUS:{}",
                    if event.cancelled {
                        "CANCELLED"
                    } else {
                        "CONFIRMED"
                    }
                ),
                "END:VEVENT".to_owned(),
            ]);
        }
        lines.push("END:VCALENDAR".to_owned());
        Ok(lines
            .iter()
            .map(|line| fold(line))
            .collect::<Vec<_>>()
            .join("\r\n")
            + "\r\n")
    }
}
fn utc(value: Instant) -> Result<String, ScheduleValueError> {
    Ok(
        chrono::DateTime::from_timestamp_millis(value.epoch_millis())
            .ok_or(ScheduleValueError::Date)?
            .format("%Y%m%dT%H%M%SZ")
            .to_string(),
    )
}
fn escape(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace("\r\n", "\n")
        .replace('\r', "\n")
        .replace('\n', "\\n")
        .replace(';', "\\;")
        .replace(',', "\\,")
}
fn fold(value: &str) -> String {
    let mut out = String::new();
    let mut size = 0;
    for ch in value.chars() {
        if size + ch.len_utf8() > 75 {
            out.push_str("\r\n ");
            size = 1;
        }
        out.push(ch);
        size += ch.len_utf8();
    }
    out
}
#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;
    proptest! {#[test]fn folding_preserves_unicode_and_octet_limit(value in ".{0,400}") {let folded=fold(&value);prop_assert_eq!(folded.replace("\r\n ",""),value);prop_assert!(folded.split("\r\n").all(|line|line.len()<=75));}}
    #[test]
    fn long_ascii_and_multibyte_lines_remain_valid_after_folding() {
        for value in ["a".repeat(200), "a".repeat(74) + "é", "🏀".repeat(60)] {
            let folded = fold(&value);
            assert!(folded.split("\r\n").all(|line| line.len() <= 75));
            assert_eq!(folded.replace("\r\n ", ""), value);
        }
    }
    #[test]
    fn text_escaping_blocks_content_line_injection() {
        assert_eq!(
            escape("a,b;c\\d\r\nBEGIN:VEVENT"),
            "a\\,b\\;c\\\\d\\nBEGIN:VEVENT"
        );
    }
}
