//! Invitation-only authentication. Transactions own consumption and rate limits.
use crate::{DeliveryKey, EmailGateway, EmailMessage, StorageError};
use async_trait::async_trait;
use gymtime_domain::{
    EmailAddress, Instant,
    auth::{Actor, Challenge, Digest, OpaqueToken, OtpCode, Session},
};
use std::{net::IpAddr, sync::Arc};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AuthError {
    #[error("authentication service unavailable")]
    Unavailable,
    #[error("request limit exceeded")]
    RateLimited,
    #[error("invalid or expired code")]
    InvalidCode,
    #[error("sign in is required")]
    Unauthenticated,
    #[error("permission denied")]
    Forbidden,
    #[error(transparent)]
    Storage(#[from] StorageError),
}

pub trait Clock: Send + Sync {
    /// # Errors
    /// Returns Unavailable if the system cannot represent a UTC millisecond instant.
    fn now(&self) -> Result<Instant, AuthError>;
}
pub trait Crypto: Send + Sync {
    /// # Errors
    /// Returns Unavailable if secure randomness is unavailable.
    fn token(&self) -> Result<OpaqueToken, AuthError>;
    /// # Errors
    /// Returns Unavailable if secure randomness is unavailable.
    fn code(&self) -> Result<OtpCode, AuthError>;
    /// # Errors
    /// Returns Unavailable if a keyed digest cannot be calculated.
    fn digest(&self, scope: &str, value: &str) -> Result<Digest, AuthError>;
    /// # Errors
    /// Returns Unavailable if constant-time keyed verification cannot be performed.
    fn matches(&self, scope: &str, value: &str, expected: &Digest) -> Result<bool, AuthError>;
    /// # Errors
    /// Returns Unavailable if a session-bound CSRF token cannot be derived.
    fn csrf(&self, session: &OpaqueToken) -> Result<OpaqueToken, AuthError>;
}

pub struct RateHistory {
    pub count: u32,
    pub last: Option<Instant>,
}

#[async_trait]
pub trait AuthTransaction: crate::notifications::NotificationWriter + Send {
    /// # Errors
    /// Returns enabled account permissions reread inside the mutation transaction.
    async fn actor_by_id(
        &mut self,
        id: gymtime_domain::auth::UserId,
    ) -> Result<Option<Actor>, StorageError>;
    /// # Errors
    /// Returns all invited accounts, including disabled accounts, or StorageError.
    async fn accounts(&mut self) -> Result<Vec<gymtime_domain::auth::Account>, StorageError>;
    /// # Errors
    /// Returns an enabled or disabled account, or StorageError.
    async fn account_by_email(
        &mut self,
        email: &EmailAddress,
    ) -> Result<Option<gymtime_domain::auth::Account>, StorageError>;
    /// # Errors
    /// Creates or reenables an invitation and its grant in the current transaction.
    async fn invite(
        &mut self,
        email: &EmailAddress,
        role: gymtime_domain::auth::AccountRole,
    ) -> Result<Actor, StorageError>;
    /// # Errors
    /// Updates account status; disabling also revokes every session and code.
    async fn set_account_status(
        &mut self,
        id: gymtime_domain::auth::UserId,
        status: gymtime_domain::auth::AccountStatus,
    ) -> Result<(), StorageError>;
    /// # Errors
    /// Writes a safe account audit action without email, token, or code values.
    async fn audit_account(
        &mut self,
        actor: gymtime_domain::auth::UserId,
        resource: gymtime_domain::auth::UserId,
        action: &'static str,
        now: Instant,
    ) -> Result<(), StorageError>;
    /// # Errors
    /// All persistence methods translate driver failures to StorageError.
    async fn rate_history(
        &mut self,
        key: &Digest,
        since: Instant,
    ) -> Result<RateHistory, StorageError>;
    /// # Errors
    /// Returns a storage failure with rollback protection.
    async fn record_rate(&mut self, key: &Digest, now: Instant) -> Result<(), StorageError>;
    /// # Errors
    /// Returns an enabled invited account or a storage failure.
    async fn actor_by_email(&mut self, email: &EmailAddress)
    -> Result<Option<Actor>, StorageError>;
    /// # Errors
    /// Returns a decoded challenge or a storage failure.
    async fn challenge(&mut self, email: &EmailAddress) -> Result<Option<Challenge>, StorageError>;
    /// # Errors
    /// Returns a storage failure; replacing invalidates the previous challenge.
    async fn save_challenge(
        &mut self,
        email: &EmailAddress,
        challenge: &Challenge,
    ) -> Result<(), StorageError>;
    /// # Errors
    /// Returns a storage failure. Deletes only the matching identity.
    async fn delete_challenge(
        &mut self,
        email: &EmailAddress,
        identity: &OpaqueToken,
    ) -> Result<(), StorageError>;
    /// # Errors
    /// Returns a storage failure; sessions contain only digests.
    async fn save_session(
        &mut self,
        digest: &Digest,
        actor: &Actor,
        now: Instant,
        expires: Instant,
    ) -> Result<(), StorageError>;
    /// # Errors
    /// Returns a session whose user's enabled status and grants are reread.
    async fn session(&mut self, digest: &Digest) -> Result<Option<Session>, StorageError>;
    /// # Errors
    /// Returns a storage failure without partially updating state.
    async fn touch_session(&mut self, digest: &Digest, now: Instant) -> Result<(), StorageError>;
    /// # Errors
    /// Returns a storage failure without partially updating state.
    async fn delete_session(&mut self, digest: &Digest) -> Result<(), StorageError>;
    /// # Errors
    /// Returns a storage failure if commit cannot finish.
    async fn commit(self: Box<Self>) -> Result<(), StorageError>;
}
#[async_trait]
pub trait AuthStore: Send + Sync {
    /// # Errors
    /// Returns a storage failure if the immediate write lock cannot be obtained.
    async fn begin_auth(&self) -> Result<Box<dyn AuthTransaction>, StorageError>;
}

#[derive(Clone)]
pub struct AuthService {
    pub store: Arc<dyn AuthStore>,
    pub clock: Arc<dyn Clock>,
    pub crypto: Arc<dyn Crypto>,
    pub email: Arc<dyn EmailGateway>,
    pub public_url: String,
}
pub struct SignedIn {
    pub actor: Actor,
    pub token: OpaqueToken,
    pub csrf: OpaqueToken,
}

impl AuthService {
    /// Same result and rate rules for invited and uninvited addresses.
    /// # Errors
    /// Returns rate limit or infrastructure failures, never account membership.
    pub async fn request_code(&self, email: EmailAddress, ip: IpAddr) -> Result<(), AuthError> {
        let now = self.clock.now()?;
        let email_key = self.crypto.digest("rate-email", email.as_str())?;
        let ip_key = self.crypto.digest("rate-ip", &ip.to_string())?;
        let mut tx = self.store.begin_auth().await?;
        let window = now.after_millis(-15 * 60 * 1000);
        let email_history = tx.rate_history(&email_key, window).await?;
        let ip_history = tx.rate_history(&ip_key, window).await?;
        if email_history.count >= 5
            || ip_history.count >= 30
            || email_history
                .last
                .is_some_and(|last| now < last.after_millis(60_000))
        {
            return Err(AuthError::RateLimited);
        }
        tx.record_rate(&email_key, now).await?;
        tx.record_rate(&ip_key, now).await?;
        let actor = tx.actor_by_email(&email).await?;
        // Generate the same cryptographic work for every syntactically valid address.
        let code = self.crypto.code()?;
        let identity = self.crypto.token()?;
        let digest = self
            .crypto
            .digest("otp", &otp_input(&email, &identity, &code))?;
        let challenge = Challenge {
            identity,
            digest,
            expires: now.after_millis(600_000),
            attempts: 0,
        };
        if actor.is_some() {
            tx.save_challenge(&email, &challenge).await?;
        }
        tx.commit().await?;
        if actor.is_some() {
            let message = EmailMessage::new(email.clone(), "Your Gymtime sign-in code".to_owned(), format!("Your Gymtime code is {}. It expires in 10 minutes. If you did not request this code, you can ignore this email.", code.as_str())).map_err(|_| AuthError::Unavailable)?;
            let key = DeliveryKey::try_from(challenge.identity.as_str())
                .map_err(|_| AuthError::Unavailable)?;
            if self.email.send(&message, &key).await.is_err() {
                // Do not reveal membership through provider failure responses.
                // The challenge is invalidated only if it has not already been replaced.
                let mut tx = self.store.begin_auth().await?;
                tx.delete_challenge(&email, &challenge.identity).await?;
                tx.commit().await?;
            }
        }
        Ok(())
    }

    /// # Errors
    /// Returns InvalidCode for missing, disabled, exhausted, expired or incorrect challenges.
    pub async fn verify_code(
        &self,
        email: EmailAddress,
        code: OtpCode,
    ) -> Result<SignedIn, AuthError> {
        let now = self.clock.now()?;
        let mut tx = self.store.begin_auth().await?;
        let Some(mut challenge) = tx.challenge(&email).await? else {
            return Err(AuthError::InvalidCode);
        };
        if !challenge.usable(now) {
            tx.delete_challenge(&email, &challenge.identity).await?;
            tx.commit().await?;
            return Err(AuthError::InvalidCode);
        }
        let matches = self.crypto.matches(
            "otp",
            &otp_input(&email, &challenge.identity, &code),
            &challenge.digest,
        )?;
        if !matches {
            challenge.attempts = challenge.attempts.saturating_add(1);
            tx.save_challenge(&email, &challenge).await?;
            tx.commit().await?;
            return Err(AuthError::InvalidCode);
        }
        let actor = tx
            .actor_by_email(&email)
            .await?
            .ok_or(AuthError::InvalidCode)?;
        let token = self.crypto.token()?;
        let digest = self.crypto.digest("session", token.as_str())?;
        let csrf = self.crypto.csrf(&token)?;
        tx.delete_challenge(&email, &challenge.identity).await?;
        tx.save_session(
            &digest,
            &actor,
            now,
            now.after_millis(30 * 24 * 60 * 60 * 1000),
        )
        .await?;
        tx.commit().await?;
        Ok(SignedIn { actor, token, csrf })
    }

    /// # Errors
    /// Returns Unauthenticated for unknown, disabled, idle or expired sessions.
    pub async fn authenticate(&self, token: &OpaqueToken) -> Result<Actor, AuthError> {
        let now = self.clock.now()?;
        let digest = self.crypto.digest("session", token.as_str())?;
        let mut tx = self.store.begin_auth().await?;
        let Some(session) = tx.session(&digest).await? else {
            return Err(AuthError::Unauthenticated);
        };
        if !session.usable(now) {
            tx.delete_session(&digest).await?;
            tx.commit().await?;
            return Err(AuthError::Unauthenticated);
        }
        tx.touch_session(&digest, now).await?;
        tx.commit().await?;
        Ok(session.actor)
    }

    /// # Errors
    /// Returns Forbidden for a missing or invalid session-bound CSRF token.
    pub fn verify_csrf(&self, token: &OpaqueToken, csrf: &OpaqueToken) -> Result<(), AuthError> {
        let expected = self.crypto.csrf(token)?;
        let digest = self.crypto.digest("csrf-check", expected.as_str())?;
        if !self.crypto.matches("csrf-check", csrf.as_str(), &digest)? {
            return Err(AuthError::Forbidden);
        }
        Ok(())
    }

    /// # Errors
    /// Returns a storage failure if session revocation cannot be committed.
    pub async fn logout(&self, token: &OpaqueToken) -> Result<(), AuthError> {
        let digest = self.crypto.digest("session", token.as_str())?;
        let mut tx = self.store.begin_auth().await?;
        tx.delete_session(&digest).await?;
        tx.commit().await?;
        Ok(())
    }
}

fn otp_input(email: &EmailAddress, identity: &OpaqueToken, code: &OtpCode) -> String {
    format!(
        "{}\0{}\0{}",
        email.as_str(),
        identity.as_str(),
        code.as_str()
    )
}
