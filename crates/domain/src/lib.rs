//! Validated values and pure scheduling decisions. No I/O or runtime dependencies.
#![forbid(unsafe_code)]
pub mod auth;
pub mod calendar;
pub mod schedule;

use thiserror::Error;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EmailAddress(String);

#[derive(Debug, Error, Eq, PartialEq)]
pub enum EmailError {
    #[error("a valid email address is required")]
    Invalid,
}

impl TryFrom<&str> for EmailAddress {
    type Error = EmailError;
    fn try_from(raw: &str) -> Result<Self, Self::Error> {
        let raw = raw.trim();
        let valid = raw.split_once('@').is_some_and(|(local, domain)| {
            !local.is_empty()
                && local.len() <= 64
                && !local.starts_with('.')
                && !local.ends_with('.')
                && !local.contains("..")
                && local
                    .bytes()
                    .all(|c| c.is_ascii_alphanumeric() || b".!#$%&'*+-/=?^_`{|}~".contains(&c))
                && domain.contains('.')
                && domain.split('.').all(|label| {
                    !label.is_empty()
                        && label.len() <= 63
                        && !label.starts_with('-')
                        && !label.ends_with('-')
                        && label
                            .bytes()
                            .all(|c| c.is_ascii_alphanumeric() || c == b'-')
                })
        });
        if raw.len() > 254 || !raw.is_ascii() || !valid {
            return Err(EmailError::Invalid);
        }
        Ok(Self(raw.to_ascii_lowercase()))
    }
}

impl EmailAddress {
    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// UTC milliseconds, supplied by a boundary or injected clock.
#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub struct Instant(i64);

impl Instant {
    #[must_use]
    pub const fn epoch_millis(self) -> i64 {
        self.0
    }
    #[must_use]
    pub const fn after_millis(self, duration: i64) -> Self {
        Self(self.0.saturating_add(duration))
    }
    #[must_use]
    pub const fn from_epoch_millis(value: i64) -> Self {
        Self(value)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Interval {
    start: Instant,
    end: Instant,
}

#[derive(Debug, Error, Eq, PartialEq)]
pub enum IntervalError {
    #[error("end time must be after start time")]
    InvalidOrder,
}

impl Interval {
    #[must_use]
    pub const fn start(self) -> Instant {
        self.start
    }
    #[must_use]
    pub const fn end(self) -> Instant {
        self.end
    }
    /// # Errors
    /// Returns `InvalidOrder` for empty or reversed intervals.
    pub fn new(start: Instant, end: Instant) -> Result<Self, IntervalError> {
        if start >= end {
            return Err(IntervalError::InvalidOrder);
        }
        Ok(Self { start, end })
    }

    #[must_use]
    pub const fn overlaps(self, other: Self) -> bool {
        self.start.0 < other.end.0 && other.start.0 < self.end.0
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum GymSpace {
    Full,
    HalfA,
    HalfB,
}

impl GymSpace {
    #[must_use]
    pub const fn shares_portion(self, other: Self) -> bool {
        match (self, other) {
            (Self::HalfA, Self::HalfB) | (Self::HalfB, Self::HalfA) => false,
            (Self::Full, Self::Full | Self::HalfA | Self::HalfB)
            | (Self::HalfA | Self::HalfB, Self::Full)
            | (Self::HalfA, Self::HalfA)
            | (Self::HalfB, Self::HalfB) => true,
        }
    }
}

#[must_use]
pub const fn conflicts(first: (GymSpace, Interval), second: (GymSpace, Interval)) -> bool {
    first.0.shares_portion(second.0) && first.1.overlaps(second.1)
}

#[cfg(test)]
#[allow(clippy::expect_used)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    fn interval(start: i64, end: i64) -> Interval {
        Interval::new(
            Instant::from_epoch_millis(start),
            Instant::from_epoch_millis(end),
        )
        .expect("invariant: test interval is ordered")
    }

    #[test]
    fn adjacent_slots_and_opposite_halves_are_compatible() {
        assert!(!conflicts(
            (GymSpace::Full, interval(0, 10)),
            (GymSpace::Full, interval(10, 20))
        ));
        assert!(!conflicts(
            (GymSpace::HalfA, interval(0, 10)),
            (GymSpace::HalfB, interval(0, 10))
        ));
        assert!(conflicts(
            (GymSpace::Full, interval(0, 10)),
            (GymSpace::HalfB, interval(5, 15))
        ));
        assert_eq!(
            Interval::new(Instant(5), Instant(5)),
            Err(IntervalError::InvalidOrder)
        );
        assert_eq!(
            EmailAddress::try_from("missing-at"),
            Err(EmailError::Invalid)
        );
    }

    #[test]
    fn email_length_boundary_and_adjacent_slots_work_in_both_directions() {
        let local = "a".repeat(64);
        for (last, valid) in [(60, true), (61, true), (62, false)] {
            let address = format!(
                "{local}@{}.{}.{}",
                "b".repeat(63),
                "c".repeat(63),
                "d".repeat(last)
            );
            assert_eq!(EmailAddress::try_from(address.as_str()).is_ok(), valid);
        }
        assert!(!interval(10, 20).overlaps(interval(0, 10)));
        assert_eq!(
            EmailAddress::try_from("é@example.test"),
            Err(EmailError::Invalid)
        );
    }

    #[test]
    fn rejects_header_injection_and_invalid_email_parts() {
        for raw in [
            "a\0@example.test",
            "a@example.test\r\nBcc:someone@example.test",
            "a@bad..test",
            "a@-bad.test",
            ".a@example.test",
            "a..b@example.test",
            "a b@example.test",
            "a@bad_test.test",
        ] {
            assert_eq!(EmailAddress::try_from(raw), Err(EmailError::Invalid));
        }
    }

    proptest! {
        #[test]
        fn email_normalization_is_stable(local in "[a-zA-Z0-9]{1,30}", label in "[a-zA-Z0-9]{1,20}") {
            let raw = format!(" {local}@{label}.test ");
            let email = EmailAddress::try_from(raw.as_str()).expect("invariant: generated address is valid");
            prop_assert_eq!(EmailAddress::try_from(email.as_str()), Ok(email.clone()));
            prop_assert_eq!(email.as_str(), raw.trim().to_ascii_lowercase());
        }
        #[test]
        fn interval_order_matches_overlap_reference(a in -1000i64..1000, b in -1000i64..1000, c in -1000i64..1000, d in -1000i64..1000) {
            let first = Interval::new(Instant(a), Instant(b));
            prop_assert_eq!(first.is_ok(), a < b);
            if let (Ok(first), Ok(second)) = (first, Interval::new(Instant(c), Instant(d))) {
                prop_assert_eq!(first.overlaps(second), a.max(c) < b.min(d));
                for x in [GymSpace::Full, GymSpace::HalfA, GymSpace::HalfB] {
                    for y in [GymSpace::Full, GymSpace::HalfA, GymSpace::HalfB] {
                        let shared = x == GymSpace::Full || y == GymSpace::Full || x == y;
                        prop_assert_eq!(conflicts((x, first), (y, second)), shared && a.max(c) < b.min(d));
                    }
                }
            }
        }

        #[test]
        fn overlap_is_symmetric(a in -100000i64..100000, b in -100000i64..100000, len_a in 1i64..1000, len_b in 1i64..1000) {
            let first = interval(a, a + len_a);
            let second = interval(b, b + len_b);
            prop_assert_eq!(first.overlaps(second), second.overlaps(first));
            prop_assert!(first.overlaps(first));
        }
    }
}
