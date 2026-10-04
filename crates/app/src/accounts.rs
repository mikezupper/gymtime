use crate::{
    EmailMessage,
    auth::{AuthError, AuthService},
};
use gymtime_domain::{
    EmailAddress,
    auth::{Account, AccountRole, AccountStatus, Actor, UserId},
};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AccountError {
    #[error(transparent)]
    Auth(#[from] AuthError),
    #[error(transparent)]
    Storage(#[from] crate::StorageError),
    #[error("the last enabled organizer cannot be disabled")]
    LastOrganizer,
    #[error("account does not exist")]
    NotFound,
}
impl AuthService {
    /// # Errors
    /// Returns Forbidden unless the requester is still an enabled organizer.
    pub async fn list_accounts(&self, actor: UserId) -> Result<Vec<Account>, AccountError> {
        let mut tx = self.store.begin_auth().await?;
        if !tx.actor_by_id(actor).await?.is_some_and(|a| a.organizer) {
            return Err(AuthError::Forbidden.into());
        }
        let accounts = tx.accounts().await?;
        tx.commit().await?;
        Ok(accounts)
    }
    /// An existing organizer invitation retains its organizer grant when invited as a coach.
    /// # Errors
    /// Returns permission or infrastructure errors; invitation and notification commit together.
    pub async fn invite_account(
        &self,
        actor: UserId,
        email: EmailAddress,
        role: AccountRole,
    ) -> Result<Actor, AccountError> {
        let now = self.clock.now()?;
        let mut tx = self.store.begin_auth().await?;
        if !tx.actor_by_id(actor).await?.is_some_and(|a| a.organizer) {
            return Err(AuthError::Forbidden.into());
        }
        let existing = tx.account_by_email(&email).await?;
        let changed = existing.as_ref().is_none_or(|account| {
            account.status == AccountStatus::Disabled
                || role == AccountRole::Organizer && !account.actor.organizer
        });
        let invited = tx.invite(&email, role).await?;
        if changed {
            tx.audit_account(actor, invited.id, "invite_account", now)
                .await?;
            let message = EmailMessage::new(email,"You’re invited to Gymtime".to_owned(),format!("Your gym organizer has invited you to Gymtime. Sign in at {}/sign-in with this email address. You’ll receive a six-digit sign-in code. Your team assignment determines which bookings you can change.",self.public_url)).map_err(|_| AuthError::Unavailable)?;
            tx.enqueue(invited.id, &self.crypto.token()?, &message, now)
                .await?;
        }
        tx.commit().await?;
        Ok(invited)
    }
    /// # Errors
    /// Returns Forbidden, NotFound, LastOrganizer, or infrastructure errors.
    pub async fn change_account_status(
        &self,
        actor: UserId,
        user: UserId,
        status: AccountStatus,
    ) -> Result<(), AccountError> {
        let now = self.clock.now()?;
        let mut tx = self.store.begin_auth().await?;
        if !tx.actor_by_id(actor).await?.is_some_and(|a| a.organizer) {
            return Err(AuthError::Forbidden.into());
        }
        let accounts = tx.accounts().await?;
        let account = accounts
            .iter()
            .find(|account| account.actor.id == user)
            .ok_or(AccountError::NotFound)?;
        if status == AccountStatus::Disabled
            && account.actor.organizer
            && account.status == AccountStatus::Enabled
            && accounts
                .iter()
                .filter(|a| a.actor.organizer && a.status == AccountStatus::Enabled)
                .count()
                <= 1
        {
            return Err(AccountError::LastOrganizer);
        }
        tx.set_account_status(user, status).await?;
        tx.audit_account(
            actor,
            user,
            match status {
                AccountStatus::Enabled => "enable_account",
                AccountStatus::Disabled => "disable_account",
            },
            now,
        )
        .await?;
        tx.commit().await?;
        Ok(())
    }
}
