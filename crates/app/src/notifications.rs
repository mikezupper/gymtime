//! Notification writes join the schedule/account transaction; delivery follows commit.
use crate::{
    DeliveryKey, EmailError, EmailGateway, EmailMessage, StorageError,
    auth::{AuthError, Clock, Crypto},
};
use async_trait::async_trait;
use gymtime_domain::{
    Instant,
    auth::{OpaqueToken, UserId},
};
use std::sync::Arc;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum NotificationError {
    #[error(transparent)]
    Storage(#[from] StorageError),
    #[error(transparent)]
    Auth(#[from] AuthError),
}
#[derive(Clone, Copy, Debug)]
pub enum DeliveryStatus {
    Pending,
    Sending,
    Sent,
    Failed,
}
pub struct Notification {
    pub user: UserId,
    pub id: OpaqueToken,
    pub message: EmailMessage,
    pub created: Instant,
    pub read: bool,
    pub delivery: DeliveryStatus,
}
pub struct EmailJob {
    pub id: OpaqueToken,
    pub lease: OpaqueToken,
    pub key: DeliveryKey,
    pub message: EmailMessage,
    pub attempt: u8,
}
#[async_trait]
pub trait NotificationWriter: Send {
    /// # Errors
    /// Inserts the in-app notice and durable email job together, or returns StorageError.
    async fn enqueue(
        &mut self,
        user: UserId,
        id: &OpaqueToken,
        message: &EmailMessage,
        now: Instant,
    ) -> Result<(), StorageError>;
}
#[async_trait]
pub trait OutboxTransaction: Send {
    /// # Errors
    /// Returns a storage failure; expired leases are recovered before claiming one due job.
    async fn claim(
        &mut self,
        now: Instant,
        lease: &OpaqueToken,
    ) -> Result<Option<EmailJob>, StorageError>;
    /// # Errors
    /// Returns a storage failure; only the matching lease may acknowledge the job.
    async fn finish(
        &mut self,
        job: &EmailJob,
        status: DeliveryStatus,
        retry_at: Instant,
    ) -> Result<(), StorageError>;
    /// # Errors
    /// Returns a storage failure if commit cannot finish.
    async fn commit(self: Box<Self>) -> Result<(), StorageError>;
}
#[async_trait]
pub trait OutboxStore: Send + Sync {
    /// # Errors
    /// Returns a storage failure if the immediate write lock cannot be obtained.
    async fn begin_outbox(&self) -> Result<Box<dyn OutboxTransaction>, StorageError>;
}
#[derive(Clone)]
pub struct NotificationWorker {
    pub store: Arc<dyn OutboxStore>,
    pub email: Arc<dyn EmailGateway>,
    pub clock: Arc<dyn Clock>,
    pub crypto: Arc<dyn Crypto>,
}
impl NotificationWorker {
    /// Deliver at most one job; the email call runs outside SQLite's write lock.
    /// # Errors
    /// Returns storage/clock/entropy failures. Provider errors become durable retry states.
    pub async fn deliver_one(&self) -> Result<bool, NotificationError> {
        let now = self.clock.now()?;
        let lease = self.crypto.token()?;
        let mut tx = self.store.begin_outbox().await?;
        let job = tx.claim(now, &lease).await?;
        tx.commit().await?;
        let Some(job) = job else {
            return Ok(false);
        };
        let result = self.email.send(&job.message, &job.key).await;
        let status = match result {
            Ok(()) => DeliveryStatus::Sent,
            Err(EmailError::Unavailable) if job.attempt < 5 => DeliveryStatus::Pending,
            Err(EmailError::Unavailable | EmailError::Rejected | EmailError::InvalidResponse) => {
                DeliveryStatus::Failed
            }
        };
        let retry = self
            .clock
            .now()?
            .after_millis(30_000 * 2i64.pow(u32::from(job.attempt.saturating_sub(1))));
        let mut tx = self.store.begin_outbox().await?;
        tx.finish(&job, status, retry).await?;
        tx.commit().await?;
        Ok(true)
    }
}
