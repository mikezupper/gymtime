//! Organizer setup helpers; booking mutations are added through the same transaction.
use super::{
    ActionOutcome, ResourceRef, ScheduleError,
    ports::{Recipients, ScheduleTransaction},
};
use crate::{
    EmailMessage,
    auth::{AuthError, Crypto},
};
use gymtime_domain::{Instant, auth::UserId, schedule::*};

/// # Errors
/// Returns storage/entropy failures. One message per recipient is written for the action.
pub async fn notify(
    tx: &mut dyn ScheduleTransaction,
    crypto: &dyn Crypto,
    recipients: Recipients,
    subject: &str,
    text: &str,
    now: Instant,
) -> Result<(), ScheduleError> {
    let recipients = tx.recipients(&recipients).await?;
    for recipient in recipients {
        let message = EmailMessage::new(recipient.email, subject.to_owned(), text.to_owned())
            .map_err(|_| AuthError::Unavailable)?;
        tx.enqueue(recipient.id, &crypto.token()?, &message, now)
            .await?;
    }
    Ok(())
}
/// # Errors
/// Returns Forbidden if the account has lost its organizer grant or is disabled.
pub async fn organizer(
    tx: &mut dyn ScheduleTransaction,
    user: UserId,
) -> Result<(), ScheduleError> {
    if !tx
        .actor_by_id(user)
        .await?
        .is_some_and(|actor| actor.organizer)
    {
        return Err(AuthError::Forbidden.into());
    }
    Ok(())
}
/// # Errors
/// Returns Forbidden unless the account is an organizer or the team's current primary coach.
pub async fn primary(
    tx: &mut dyn ScheduleTransaction,
    user: UserId,
    team: &Team,
) -> Result<(), ScheduleError> {
    let actor = tx
        .actor_by_id(user)
        .await?
        .ok_or(AuthError::Unauthenticated)?;
    if !actor.organizer && team.primary != user {
        return Err(AuthError::Forbidden.into());
    }
    Ok(())
}
#[must_use]
pub fn outcome(resources: Vec<ResourceRef>) -> ActionOutcome {
    ActionOutcome {
        resources,
        warnings: vec![],
    }
}
/// # Errors
/// Returns Stale when a client action describes an older revision.
pub fn version(expected: Version, actual: Version) -> Result<(), ScheduleError> {
    if expected != actual {
        return Err(ScheduleError::Stale);
    }
    Ok(())
}
