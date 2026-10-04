use crate::{auth_sqlite::AuthWrite, sqlite::SqliteDatabase};
use async_trait::async_trait;
use gymtime_app::{
    DeliveryKey, EmailMessage, StorageError,
    notifications::{DeliveryStatus, EmailJob, NotificationWriter, OutboxStore, OutboxTransaction},
};
use gymtime_domain::{
    EmailAddress, Instant,
    auth::{OpaqueToken, UserId},
};
use sqlx::{Sqlite, Transaction};

pub(crate) async fn enqueue(
    tx: &mut sqlx::SqliteConnection,
    user: UserId,
    id: &OpaqueToken,
    message: &EmailMessage,
    now: Instant,
) -> Result<(), StorageError> {
    sqlx::query("INSERT INTO notifications(id,user_id,subject,text,created_at) SELECT ?,id,?,?,? FROM users WHERE id=? AND email=?")
        .bind(id.as_str()).bind(message.subject()).bind(message.text()).bind(now.epoch_millis()).bind(user.get()).bind(message.recipient().as_str()).execute(&mut *tx).await.map_err(|_| StorageError::Unavailable)?;
    sqlx::query("INSERT INTO email_outbox(notification_id,retry_at) VALUES (?,?)")
        .bind(id.as_str())
        .bind(now.epoch_millis())
        .execute(&mut *tx)
        .await
        .map_err(|_| StorageError::Unavailable)?;
    Ok(())
}
#[async_trait]
impl NotificationWriter for AuthWrite {
    async fn enqueue(
        &mut self,
        user: UserId,
        id: &OpaqueToken,
        message: &EmailMessage,
        now: Instant,
    ) -> Result<(), StorageError> {
        enqueue(&mut self.tx, user, id, message, now).await
    }
}
struct OutboxWrite {
    tx: Transaction<'static, Sqlite>,
}
#[async_trait]
impl OutboxStore for SqliteDatabase {
    async fn begin_outbox(&self) -> Result<Box<dyn OutboxTransaction>, StorageError> {
        Ok(Box::new(OutboxWrite {
            tx: self
                .pool
                .begin_with("BEGIN IMMEDIATE")
                .await
                .map_err(|_| StorageError::Unavailable)?,
        }))
    }
}
#[async_trait]
impl OutboxTransaction for OutboxWrite {
    async fn claim(
        &mut self,
        now: Instant,
        lease: &OpaqueToken,
    ) -> Result<Option<EmailJob>, StorageError> {
        sqlx::query("UPDATE email_outbox SET status=CASE WHEN attempts>=5 THEN 'failed' ELSE 'pending' END,lease=NULL,lease_until=NULL WHERE status='sending' AND lease_until<=?")
            .bind(now.epoch_millis()).execute(&mut *self.tx).await.map_err(|_| StorageError::Unavailable)?;
        let row: Option<(String,String,String,String,i64)> = sqlx::query_as("SELECT o.notification_id,u.email,n.subject,n.text,o.attempts FROM email_outbox o JOIN notifications n ON n.id=o.notification_id JOIN users u ON u.id=n.user_id WHERE o.status='pending' AND o.attempts<5 AND o.retry_at<=? ORDER BY o.retry_at,o.notification_id LIMIT 1")
            .bind(now.epoch_millis()).fetch_optional(&mut *self.tx).await.map_err(|_| StorageError::Unavailable)?;
        let Some((id, email, subject, text, attempts)) = row else {
            return Ok(None);
        };
        let id = OpaqueToken::try_from(id.as_str()).map_err(|_| StorageError::InvalidData)?;
        let key = DeliveryKey::try_from(id.as_str()).map_err(|_| StorageError::InvalidData)?;
        let email =
            EmailAddress::try_from(email.as_str()).map_err(|_| StorageError::InvalidData)?;
        let message =
            EmailMessage::new(email, subject, text).map_err(|_| StorageError::InvalidData)?;
        let attempt = u8::try_from(attempts + 1).map_err(|_| StorageError::InvalidData)?;
        sqlx::query("UPDATE email_outbox SET status='sending',attempts=attempts+1,lease=?,lease_until=? WHERE notification_id=?")
            .bind(lease.as_str()).bind(now.after_millis(30_000).epoch_millis()).bind(id.as_str()).execute(&mut *self.tx).await.map_err(|_| StorageError::Unavailable)?;
        Ok(Some(EmailJob {
            id,
            lease: lease.clone(),
            key,
            message,
            attempt,
        }))
    }
    async fn finish(
        &mut self,
        job: &EmailJob,
        status: DeliveryStatus,
        retry_at: Instant,
    ) -> Result<(), StorageError> {
        let value = match status {
            DeliveryStatus::Pending => "pending",
            DeliveryStatus::Sending => return Err(StorageError::InvalidData),
            DeliveryStatus::Sent => "sent",
            DeliveryStatus::Failed => "failed",
        };
        sqlx::query("UPDATE email_outbox SET status=?,retry_at=?,lease=NULL,lease_until=NULL WHERE notification_id=? AND status='sending' AND lease=?")
            .bind(value).bind(retry_at.epoch_millis()).bind(job.id.as_str()).bind(job.lease.as_str()).execute(&mut *self.tx).await.map_err(|_| StorageError::Unavailable)?;
        Ok(())
    }
    async fn commit(self: Box<Self>) -> Result<(), StorageError> {
        self.tx
            .commit()
            .await
            .map_err(|_| StorageError::Unavailable)
    }
}
