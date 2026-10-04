use crate::sqlite::SqliteDatabase;
use async_trait::async_trait;
use gymtime_app::{
    StorageError,
    auth::{AuthStore, AuthTransaction, RateHistory},
};
use gymtime_domain::{
    EmailAddress, Instant,
    auth::{Actor, Challenge, Digest, OpaqueToken, Session, UserId},
};
use sqlx::{Sqlite, Transaction};

pub(crate) struct AuthWrite {
    pub(crate) tx: Transaction<'static, Sqlite>,
}
type ActorRow = (i64, String, bool);
fn actor(row: ActorRow) -> Result<Actor, StorageError> {
    Ok(Actor {
        id: UserId::try_from(row.0).map_err(|_| StorageError::InvalidData)?,
        email: EmailAddress::try_from(row.1.as_str()).map_err(|_| StorageError::InvalidData)?,
        organizer: row.2,
    })
}
#[async_trait]
impl AuthStore for SqliteDatabase {
    async fn begin_auth(&self) -> Result<Box<dyn AuthTransaction>, StorageError> {
        let tx = self
            .pool
            .begin_with("BEGIN IMMEDIATE")
            .await
            .map_err(|_| StorageError::Unavailable)?;
        Ok(Box::new(AuthWrite { tx }))
    }
}
#[async_trait]
impl AuthTransaction for AuthWrite {
    async fn actor_by_id(&mut self, id: UserId) -> Result<Option<Actor>, StorageError> {
        sqlx::query_as::<_,ActorRow>("SELECT id,email,EXISTS(SELECT 1 FROM organizer_grants WHERE user_id=users.id) FROM users WHERE id=? AND status='enabled'")
            .bind(id.get()).fetch_optional(&mut *self.tx).await.map_err(|_| StorageError::Unavailable)?.map(actor).transpose()
    }
    async fn accounts(&mut self) -> Result<Vec<gymtime_domain::auth::Account>, StorageError> {
        let rows: Vec<(i64,String,bool,String)> = sqlx::query_as("SELECT id,email,EXISTS(SELECT 1 FROM organizer_grants WHERE user_id=users.id),status FROM users ORDER BY email").fetch_all(&mut *self.tx).await.map_err(|_| StorageError::Unavailable)?;
        rows.into_iter()
            .map(|(id, email, organizer, status)| {
                Ok(gymtime_domain::auth::Account {
                    actor: actor((id, email, organizer))?,
                    status: decode_status(&status)?,
                })
            })
            .collect()
    }
    async fn account_by_email(
        &mut self,
        email: &EmailAddress,
    ) -> Result<Option<gymtime_domain::auth::Account>, StorageError> {
        let row: Option<(i64,String,bool,String)> = sqlx::query_as("SELECT id,email,EXISTS(SELECT 1 FROM organizer_grants WHERE user_id=users.id),status FROM users WHERE email=?").bind(email.as_str()).fetch_optional(&mut *self.tx).await.map_err(|_| StorageError::Unavailable)?;
        row.map(|(id, email, organizer, status)| {
            Ok(gymtime_domain::auth::Account {
                actor: actor((id, email, organizer))?,
                status: decode_status(&status)?,
            })
        })
        .transpose()
    }
    async fn invite(
        &mut self,
        email: &EmailAddress,
        role: gymtime_domain::auth::AccountRole,
    ) -> Result<Actor, StorageError> {
        let id: i64 = sqlx::query_scalar("INSERT INTO users(email,status) VALUES (?,'enabled') ON CONFLICT(email) DO UPDATE SET status='enabled' RETURNING id").bind(email.as_str()).fetch_one(&mut *self.tx).await.map_err(|_| StorageError::Unavailable)?;
        match role {
            gymtime_domain::auth::AccountRole::Organizer => {
                sqlx::query(
                    "INSERT INTO organizer_grants(user_id) VALUES (?) ON CONFLICT DO NOTHING",
                )
                .bind(id)
                .execute(&mut *self.tx)
                .await
                .map_err(|_| StorageError::Unavailable)?;
            }
            gymtime_domain::auth::AccountRole::Coach => {}
        }
        self.actor_by_id(UserId::try_from(id).map_err(|_| StorageError::InvalidData)?)
            .await?
            .ok_or(StorageError::InvalidData)
    }
    async fn set_account_status(
        &mut self,
        id: UserId,
        status: gymtime_domain::auth::AccountStatus,
    ) -> Result<(), StorageError> {
        let status = match status {
            gymtime_domain::auth::AccountStatus::Enabled => "enabled",
            gymtime_domain::auth::AccountStatus::Disabled => "disabled",
        };
        sqlx::query("UPDATE users SET status=? WHERE id=?")
            .bind(status)
            .bind(id.get())
            .execute(&mut *self.tx)
            .await
            .map_err(|_| StorageError::Unavailable)?;
        if status == "disabled" {
            sqlx::query("DELETE FROM sessions WHERE user_id=?")
                .bind(id.get())
                .execute(&mut *self.tx)
                .await
                .map_err(|_| StorageError::Unavailable)?;
            sqlx::query(
                "DELETE FROM otp_challenges WHERE email=(SELECT email FROM users WHERE id=?)",
            )
            .bind(id.get())
            .execute(&mut *self.tx)
            .await
            .map_err(|_| StorageError::Unavailable)?;
        }
        Ok(())
    }
    async fn audit_account(
        &mut self,
        actor: UserId,
        resource: UserId,
        action: &'static str,
        now: Instant,
    ) -> Result<(), StorageError> {
        sqlx::query(
            "INSERT INTO audit_events(actor_id,action,resource_id,occurred_at) VALUES (?,?,?,?)",
        )
        .bind(actor.get())
        .bind(action)
        .bind(resource.get().to_string())
        .bind(now.epoch_millis())
        .execute(&mut *self.tx)
        .await
        .map_err(|_| StorageError::Unavailable)?;
        Ok(())
    }
    async fn rate_history(
        &mut self,
        key: &Digest,
        since: Instant,
    ) -> Result<RateHistory, StorageError> {
        let (count, last): (i64, Option<i64>) = sqlx::query_as(
            "SELECT count(*),max(occurred_at) FROM auth_rate_events WHERE key=? AND occurred_at>?",
        )
        .bind(key.as_bytes())
        .bind(since.epoch_millis())
        .fetch_one(&mut *self.tx)
        .await
        .map_err(|_| StorageError::Unavailable)?;
        Ok(RateHistory {
            count: u32::try_from(count).map_err(|_| StorageError::InvalidData)?,
            last: last.map(Instant::from_epoch_millis),
        })
    }
    async fn record_rate(&mut self, key: &Digest, now: Instant) -> Result<(), StorageError> {
        sqlx::query("DELETE FROM auth_rate_events WHERE occurred_at<=?")
            .bind(now.after_millis(-15 * 60 * 1000).epoch_millis())
            .execute(&mut *self.tx)
            .await
            .map_err(|_| StorageError::Unavailable)?;
        sqlx::query("INSERT INTO auth_rate_events(key,occurred_at) VALUES (?,?)")
            .bind(key.as_bytes())
            .bind(now.epoch_millis())
            .execute(&mut *self.tx)
            .await
            .map_err(|_| StorageError::Unavailable)?;
        Ok(())
    }
    async fn actor_by_email(
        &mut self,
        email: &EmailAddress,
    ) -> Result<Option<Actor>, StorageError> {
        sqlx::query_as::<_,ActorRow>("SELECT id,email,EXISTS(SELECT 1 FROM organizer_grants WHERE user_id=users.id) FROM users WHERE email=? AND status='enabled'")
            .bind(email.as_str()).fetch_optional(&mut *self.tx).await.map_err(|_| StorageError::Unavailable)?.map(actor).transpose()
    }
    async fn challenge(&mut self, email: &EmailAddress) -> Result<Option<Challenge>, StorageError> {
        let row: Option<(String, Vec<u8>, i64, i64)> = sqlx::query_as(
            "SELECT identity,digest,expires_at,attempts FROM otp_challenges WHERE email=?",
        )
        .bind(email.as_str())
        .fetch_optional(&mut *self.tx)
        .await
        .map_err(|_| StorageError::Unavailable)?;
        row.map(|(identity, digest, expires, attempts)| {
            Ok(Challenge {
                identity: OpaqueToken::try_from(identity.as_str())
                    .map_err(|_| StorageError::InvalidData)?,
                digest: Digest::try_from(digest.as_slice())
                    .map_err(|_| StorageError::InvalidData)?,
                expires: Instant::from_epoch_millis(expires),
                attempts: u8::try_from(attempts).map_err(|_| StorageError::InvalidData)?,
            })
        })
        .transpose()
    }
    async fn save_challenge(
        &mut self,
        email: &EmailAddress,
        challenge: &Challenge,
    ) -> Result<(), StorageError> {
        sqlx::query("INSERT INTO otp_challenges(email,identity,digest,expires_at,attempts) VALUES (?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET identity=excluded.identity,digest=excluded.digest,expires_at=excluded.expires_at,attempts=excluded.attempts")
            .bind(email.as_str()).bind(challenge.identity.as_str()).bind(challenge.digest.as_bytes()).bind(challenge.expires.epoch_millis()).bind(i64::from(challenge.attempts)).execute(&mut *self.tx).await.map_err(|_| StorageError::Unavailable)?;
        Ok(())
    }
    async fn delete_challenge(
        &mut self,
        email: &EmailAddress,
        identity: &OpaqueToken,
    ) -> Result<(), StorageError> {
        sqlx::query("DELETE FROM otp_challenges WHERE email=? AND identity=?")
            .bind(email.as_str())
            .bind(identity.as_str())
            .execute(&mut *self.tx)
            .await
            .map_err(|_| StorageError::Unavailable)?;
        Ok(())
    }
    async fn save_session(
        &mut self,
        digest: &Digest,
        actor: &Actor,
        now: Instant,
        expires: Instant,
    ) -> Result<(), StorageError> {
        sqlx::query("DELETE FROM sessions WHERE expires_at<=? OR last_seen_at<=?")
            .bind(now.epoch_millis())
            .bind(now.after_millis(-7 * 24 * 60 * 60 * 1000).epoch_millis())
            .execute(&mut *self.tx)
            .await
            .map_err(|_| StorageError::Unavailable)?;
        sqlx::query("INSERT INTO sessions(digest,user_id,created_at,last_seen_at,expires_at) VALUES (?,?,?,?,?)").bind(digest.as_bytes()).bind(actor.id.get()).bind(now.epoch_millis()).bind(now.epoch_millis()).bind(expires.epoch_millis()).execute(&mut *self.tx).await.map_err(|_| StorageError::Unavailable)?;
        sqlx::query("INSERT INTO audit_events(actor_id,action,occurred_at) VALUES (?,'sign_in',?)")
            .bind(actor.id.get())
            .bind(now.epoch_millis())
            .execute(&mut *self.tx)
            .await
            .map_err(|_| StorageError::Unavailable)?;
        Ok(())
    }
    async fn session(&mut self, digest: &Digest) -> Result<Option<Session>, StorageError> {
        let row: Option<(i64,String,bool,i64,i64)> = sqlx::query_as("SELECT users.id,users.email,EXISTS(SELECT 1 FROM organizer_grants WHERE user_id=users.id),sessions.expires_at,sessions.last_seen_at FROM sessions JOIN users ON users.id=sessions.user_id WHERE digest=? AND users.status='enabled'")
            .bind(digest.as_bytes()).fetch_optional(&mut *self.tx).await.map_err(|_| StorageError::Unavailable)?;
        row.map(|(id, email, organizer, expires, last_seen)| {
            Ok(Session {
                actor: actor((id, email, organizer))?,
                expires: Instant::from_epoch_millis(expires),
                last_seen: Instant::from_epoch_millis(last_seen),
            })
        })
        .transpose()
    }
    async fn touch_session(&mut self, digest: &Digest, now: Instant) -> Result<(), StorageError> {
        sqlx::query("UPDATE sessions SET last_seen_at=? WHERE digest=?")
            .bind(now.epoch_millis())
            .bind(digest.as_bytes())
            .execute(&mut *self.tx)
            .await
            .map_err(|_| StorageError::Unavailable)?;
        Ok(())
    }
    async fn delete_session(&mut self, digest: &Digest) -> Result<(), StorageError> {
        sqlx::query("DELETE FROM sessions WHERE digest=?")
            .bind(digest.as_bytes())
            .execute(&mut *self.tx)
            .await
            .map_err(|_| StorageError::Unavailable)?;
        Ok(())
    }
    async fn commit(self: Box<Self>) -> Result<(), StorageError> {
        self.tx
            .commit()
            .await
            .map_err(|_| StorageError::Unavailable)
    }
}

fn decode_status(status: &str) -> Result<gymtime_domain::auth::AccountStatus, StorageError> {
    match status {
        "enabled" => Ok(gymtime_domain::auth::AccountStatus::Enabled),
        "disabled" => Ok(gymtime_domain::auth::AccountStatus::Disabled),
        _ => Err(StorageError::InvalidData),
    }
}
