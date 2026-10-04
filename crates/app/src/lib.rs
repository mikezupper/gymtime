//! Workflows and consumer-owned ports. Drivers remain outside this crate.
#![forbid(unsafe_code)]
pub mod accounts;
pub mod auth;
pub mod notifications;
pub mod schedule;

use async_trait::async_trait;
use gymtime_domain::EmailAddress;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum StorageError {
    #[error("the record changed; refresh before retrying")]
    ConcurrentChange,
    #[error("storage is temporarily unavailable")]
    Unavailable,
    #[error("persisted data is invalid")]
    InvalidData,
}

#[async_trait]
pub trait WriteStore: Send {
    /// # Errors
    /// Returns a storage error when the transaction cannot read grants.
    async fn has_organizer(&mut self) -> Result<bool, StorageError>;
    /// # Errors
    /// Returns a storage error if the account and grant cannot be saved.
    async fn insert_organizer(&mut self, email: &EmailAddress) -> Result<(), StorageError>;
    /// # Errors
    /// Returns a storage error when commit fails; the guard retains rollback protection.
    async fn commit(self: Box<Self>) -> Result<(), StorageError>;
    /// # Errors
    /// Returns a storage error when rollback fails.
    async fn rollback(self: Box<Self>) -> Result<(), StorageError>;
}

#[async_trait]
pub trait UnitOfWork: Send + Sync {
    /// # Errors
    /// Returns a storage error when the immediate write lock cannot be acquired.
    async fn begin_write(&self) -> Result<Box<dyn WriteStore>, StorageError>;
    /// # Errors
    /// Returns a storage error when schema or database access is unavailable.
    async fn check_ready(&self) -> Result<(), StorageError>;
}

/// Bootstrap only when there are no organizers; restart cannot reset permissions.
/// # Errors
/// Returns a storage error with no partially saved account or grant.
pub async fn bootstrap_organizer(
    store: &dyn UnitOfWork,
    email: &EmailAddress,
) -> Result<(), StorageError> {
    let mut transaction = store.begin_write().await?;
    if !transaction.has_organizer().await? {
        transaction.insert_organizer(email).await?;
    }
    transaction.commit().await
}

#[derive(Clone, Debug)]
pub struct EmailMessage {
    recipient: EmailAddress,
    subject: String,
    text: String,
}

#[derive(Debug, Error)]
pub enum MessageError {
    #[error("email subject and text must be nonempty and bounded")]
    Invalid,
}

impl EmailMessage {
    /// # Errors
    /// Returns `Invalid` for empty, oversized, or multiline subjects.
    pub fn new(
        recipient: EmailAddress,
        subject: String,
        text: String,
    ) -> Result<Self, MessageError> {
        if subject.trim().is_empty()
            || subject.len() > 200
            || subject.contains(['\r', '\n'])
            || text.trim().is_empty()
            || text.len() > 100_000
        {
            return Err(MessageError::Invalid);
        }
        Ok(Self {
            recipient,
            subject,
            text,
        })
    }
    #[must_use]
    pub fn recipient(&self) -> &EmailAddress {
        &self.recipient
    }
    #[must_use]
    pub fn subject(&self) -> &str {
        &self.subject
    }
    #[must_use]
    pub fn text(&self) -> &str {
        &self.text
    }
}

#[derive(Clone, Debug)]
pub struct DeliveryKey(String);

impl TryFrom<&str> for DeliveryKey {
    type Error = MessageError;
    fn try_from(value: &str) -> Result<Self, Self::Error> {
        if value.is_empty()
            || value.len() > 200
            || !value.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
        {
            return Err(MessageError::Invalid);
        }
        Ok(Self(value.to_owned()))
    }
}

impl DeliveryKey {
    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, Error)]
pub enum EmailError {
    #[error("email service is temporarily unavailable")]
    Unavailable,
    #[error("email service rejected the request")]
    Rejected,
    #[error("email service returned an invalid response")]
    InvalidResponse,
}

#[async_trait]
pub trait EmailGateway: Send + Sync {
    /// # Errors
    /// Returns a typed delivery failure. The caller owns retries and their stable key.
    async fn send(&self, message: &EmailMessage, key: &DeliveryKey) -> Result<(), EmailError>;
}
