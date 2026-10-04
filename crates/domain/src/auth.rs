//! Authentication values contain no storage, cryptography, or system clock.
use crate::{EmailAddress, Instant};
use thiserror::Error;

#[derive(Debug, Error, PartialEq, Eq)]
#[error("invalid authentication value")]
pub struct AuthValueError;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct UserId(i64);
impl TryFrom<i64> for UserId {
    type Error = AuthValueError;
    fn try_from(value: i64) -> Result<Self, Self::Error> {
        if value <= 0 {
            return Err(AuthValueError);
        }
        Ok(Self(value))
    }
}
impl UserId {
    #[must_use]
    pub const fn get(self) -> i64 {
        self.0
    }
}

#[derive(Clone, PartialEq, Eq)]
pub struct OtpCode(String);
impl TryFrom<&str> for OtpCode {
    type Error = AuthValueError;
    fn try_from(value: &str) -> Result<Self, Self::Error> {
        if value.len() != 6 || !value.bytes().all(|b| b.is_ascii_digit()) {
            return Err(AuthValueError);
        }
        Ok(Self(value.to_owned()))
    }
}
impl OtpCode {
    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// Deliberately has no Debug or Display implementation.
#[derive(Clone, PartialEq, Eq)]
pub struct OpaqueToken(String);
impl TryFrom<&str> for OpaqueToken {
    type Error = AuthValueError;
    fn try_from(value: &str) -> Result<Self, Self::Error> {
        if value.len() != 64
            || !value
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        {
            return Err(AuthValueError);
        }
        Ok(Self(value.to_owned()))
    }
}
impl OpaqueToken {
    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Clone, PartialEq, Eq)]
pub struct Digest([u8; 32]);
impl TryFrom<&[u8]> for Digest {
    type Error = AuthValueError;
    fn try_from(value: &[u8]) -> Result<Self, Self::Error> {
        Ok(Self(value.try_into().map_err(|_| AuthValueError)?))
    }
}
impl Digest {
    #[must_use]
    pub fn as_bytes(&self) -> &[u8] {
        &self.0
    }
}

#[derive(Clone, Debug)]
pub struct Actor {
    pub id: UserId,
    pub email: EmailAddress,
    pub organizer: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AccountStatus {
    Enabled,
    Disabled,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AccountRole {
    Organizer,
    Coach,
}
#[derive(Clone, Debug)]
pub struct Account {
    pub actor: Actor,
    pub status: AccountStatus,
}

pub struct Challenge {
    pub identity: OpaqueToken,
    pub digest: Digest,
    pub expires: Instant,
    pub attempts: u8,
}
impl Challenge {
    #[must_use]
    pub fn usable(&self, now: Instant) -> bool {
        now < self.expires && self.attempts < 5
    }
}

pub struct Session {
    pub actor: Actor,
    pub expires: Instant,
    pub last_seen: Instant,
}
impl Session {
    #[must_use]
    pub fn usable(&self, now: Instant) -> bool {
        now < self.expires && now < self.last_seen.after_millis(7 * 24 * 60 * 60 * 1000)
    }
}

#[cfg(test)]
#[allow(clippy::expect_used)]
mod tests {
    use super::*;
    use proptest::prelude::*;
    #[test]
    fn an_unexpired_session_remains_usable_until_exactly_seven_idle_days() {
        let start = Instant::from_epoch_millis(1_000_000);
        let idle_days = 604_800_000;
        let session = Session {
            actor: Actor {
                id: UserId::try_from(1).expect("invariant: positive id"),
                email: EmailAddress::try_from("a@example.test").expect("invariant: valid email"),
                organizer: false,
            },
            expires: start.after_millis(2_592_000_000),
            last_seen: start,
        };
        assert!(session.usable(start.after_millis(idle_days - 1)));
        assert!(!session.usable(start.after_millis(idle_days)));
    }
    proptest! {
        #[test]
        fn code_round_trips_and_accepts_only_six_ascii_digits(raw in ".{0,80}") {
            let parsed = OtpCode::try_from(raw.as_str());
            prop_assert_eq!(parsed.is_ok(), raw.len() == 6 && raw.bytes().all(|b| b.is_ascii_digit()));
            if let Ok(code) = parsed { prop_assert!(OtpCode::try_from(code.as_str()).is_ok()); }
        }
        #[test]
        fn session_expiry_and_idle_deadlines_are_exclusive(now in 0i64..10000, ttl in 1i64..10000) {
            let session = Session { actor: Actor { id: UserId::try_from(1).expect("invariant: positive id"), email: EmailAddress::try_from("a@example.test").expect("invariant: valid email"), organizer: false }, expires: Instant::from_epoch_millis(now+ttl), last_seen: Instant::from_epoch_millis(now) };
            prop_assert!(session.usable(Instant::from_epoch_millis(now)));
            prop_assert!(!session.usable(session.expires));
            prop_assert!(!session.usable(session.last_seen.after_millis(7*24*60*60*1000)));
        }
    }
}
