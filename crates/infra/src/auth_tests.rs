//! Real SQLite workflows, injected clock/entropy, and a local capture gateway.
#![allow(clippy::expect_used)]
use crate::{auth::SecureCrypto, sqlite::SqliteDatabase};
use async_trait::async_trait;
use gymtime_app::{
    DeliveryKey, EmailError, EmailGateway, EmailMessage, StorageError,
    auth::{AuthError, AuthService, Clock, Crypto},
    bootstrap_organizer,
};
use gymtime_domain::{
    EmailAddress, Instant,
    auth::{Digest, OpaqueToken, OtpCode},
};
use std::sync::{
    Arc, Mutex,
    atomic::{AtomicBool, AtomicI64, AtomicU64, Ordering},
};

struct TestClock(AtomicI64);
impl Clock for TestClock {
    fn now(&self) -> Result<Instant, AuthError> {
        Ok(Instant::from_epoch_millis(self.0.load(Ordering::SeqCst)))
    }
}
struct TestCrypto {
    crypto: SecureCrypto,
    sequence: AtomicU64,
}
impl Crypto for TestCrypto {
    fn token(&self) -> Result<OpaqueToken, AuthError> {
        OpaqueToken::try_from(
            format!("{:064x}", self.sequence.fetch_add(1, Ordering::SeqCst)).as_str(),
        )
        .map_err(|_| AuthError::Unavailable)
    }
    fn code(&self) -> Result<OtpCode, AuthError> {
        OtpCode::try_from(
            format!(
                "{:06}",
                self.sequence.fetch_add(1, Ordering::SeqCst) % 1_000_000
            )
            .as_str(),
        )
        .map_err(|_| AuthError::Unavailable)
    }
    fn digest(&self, s: &str, v: &str) -> Result<Digest, AuthError> {
        self.crypto.digest(s, v)
    }
    fn matches(&self, s: &str, v: &str, e: &Digest) -> Result<bool, AuthError> {
        self.crypto.matches(s, v, e)
    }
    fn csrf(&self, t: &OpaqueToken) -> Result<OpaqueToken, AuthError> {
        self.crypto.csrf(t)
    }
}
#[derive(Default)]
struct Inbox {
    messages: Mutex<Vec<String>>,
    fail: AtomicBool,
}
#[async_trait]
impl EmailGateway for Inbox {
    async fn send(&self, m: &EmailMessage, _: &DeliveryKey) -> Result<(), EmailError> {
        if self.fail.load(Ordering::SeqCst) {
            return Err(EmailError::Unavailable);
        }
        self.messages
            .lock()
            .expect("invariant: fixture mutex unpoisoned")
            .push(m.text().to_owned());
        Ok(())
    }
}
pub(super) struct Fixture {
    _dir: tempfile::TempDir,
    pub(super) db: SqliteDatabase,
    pub(super) service: AuthService,
    clock: Arc<TestClock>,
    inbox: Arc<Inbox>,
}
impl Fixture {
    pub(super) async fn new() -> Self {
        let dir = tempfile::tempdir().expect("invariant: fixture directory");
        let db = SqliteDatabase::open(&format!(
            "sqlite://{}",
            dir.path().join("auth.db").display()
        ))
        .await
        .expect("invariant: fixture database");
        bootstrap_organizer(&db, &email("owner@example.test"))
            .await
            .expect("invariant: bootstrap");
        let clock = Arc::new(TestClock(AtomicI64::new(1000000)));
        let inbox = Arc::new(Inbox::default());
        let service = AuthService {
            store: Arc::new(db.clone()),
            clock: clock.clone(),
            crypto: Arc::new(TestCrypto {
                crypto: SecureCrypto::new("a-private-fixture-key-that-is-at-least-32-bytes".into()),
                sequence: AtomicU64::new(1),
            }),
            email: inbox.clone(),
            public_url: "https://gym.example.test".to_owned(),
        };
        Self {
            _dir: dir,
            db,
            service,
            clock,
            inbox,
        }
    }
    pub(super) fn advance(&self, millis: i64) {
        self.clock.0.fetch_add(millis, Ordering::SeqCst);
    }
    fn code(&self) -> OtpCode {
        let inbox = self
            .inbox
            .messages
            .lock()
            .expect("invariant: fixture mutex unpoisoned");
        let text = inbox.last().expect("invariant: fixture email captured");
        let value = text
            .split_whitespace()
            .nth(4)
            .expect("invariant: email code position")
            .trim_end_matches('.');
        OtpCode::try_from(value).expect("invariant: captured code valid")
    }
    async fn request(&self, address: &str) -> Result<(), AuthError> {
        self.service
            .request_code(
                email(address),
                "127.0.0.1".parse().expect("invariant: fixture IP"),
            )
            .await
    }
}
fn email(v: &str) -> EmailAddress {
    EmailAddress::try_from(v).expect("invariant: fixture email")
}

#[tokio::test]
async fn one_time_consumption_is_atomic_and_sessions_are_revocable() {
    let f = Fixture::new().await;
    f.request("owner@example.test")
        .await
        .expect("invariant: request succeeds");
    let code = f.code();
    let (left, right) = tokio::join!(
        f.service
            .verify_code(email("owner@example.test"), code.clone()),
        f.service.verify_code(email("owner@example.test"), code)
    );
    assert_ne!(left.is_ok(), right.is_ok());
    let signed = left
        .or(right)
        .expect("invariant: exactly one verification succeeds");
    assert!(signed.actor.organizer);
    assert!(f.service.authenticate(&signed.token).await.is_ok());
    assert!(f.service.verify_csrf(&signed.token, &signed.csrf).is_ok());
    let other = f.service.crypto.token().expect("invariant: fixture token");
    assert!(matches!(
        f.service.verify_csrf(&signed.token, &other),
        Err(AuthError::Forbidden)
    ));
    f.service
        .logout(&signed.token)
        .await
        .expect("invariant: logout commits");
    assert!(matches!(
        f.service.authenticate(&signed.token).await,
        Err(AuthError::Unauthenticated)
    ));
    f.db.close().await;
}

#[tokio::test]
async fn incorrect_attempts_expiry_resend_and_rate_limits_are_persisted() {
    let f = Fixture::new().await;
    f.request("owner@example.test")
        .await
        .expect("invariant: request succeeds");
    let first = f.code();
    assert!(matches!(
        f.request("owner@example.test").await,
        Err(AuthError::RateLimited)
    ));
    for _ in 0..5 {
        assert!(matches!(
            f.service
                .verify_code(
                    email("owner@example.test"),
                    OtpCode::try_from("999999").expect("invariant: fixture code")
                )
                .await,
            Err(AuthError::InvalidCode)
        ));
    }
    assert!(matches!(
        f.service
            .verify_code(email("owner@example.test"), first.clone())
            .await,
        Err(AuthError::InvalidCode)
    ));
    f.advance(60_000);
    f.request("owner@example.test")
        .await
        .expect("invariant: cooldown boundary permits resend");
    assert!(matches!(
        f.service
            .verify_code(email("owner@example.test"), first)
            .await,
        Err(AuthError::InvalidCode)
    ));
    let second = f.code();
    f.advance(600_000);
    assert!(matches!(
        f.service
            .verify_code(email("owner@example.test"), second)
            .await,
        Err(AuthError::InvalidCode)
    ));
    for _ in 0..3 {
        f.request("owner@example.test")
            .await
            .expect("invariant: within email quota");
        f.advance(60_000);
    }
    assert!(matches!(
        f.request("owner@example.test").await,
        Err(AuthError::RateLimited)
    ));
    f.advance(900_000);
    assert!(f.request("owner@example.test").await.is_ok());
    f.db.close().await;
}

#[tokio::test]
async fn uninvited_addresses_and_delivery_failures_do_not_disclose_membership() {
    let f = Fixture::new().await;
    assert!(f.request("unknown@example.test").await.is_ok());
    assert!(
        f.inbox
            .messages
            .lock()
            .expect("invariant: mutex")
            .is_empty()
    );
    assert!(matches!(
        f.service
            .verify_code(
                email("unknown@example.test"),
                OtpCode::try_from("123456").expect("invariant: code")
            )
            .await,
        Err(AuthError::InvalidCode)
    ));
    f.inbox.fail.store(true, Ordering::SeqCst);
    assert!(f.request("owner@example.test").await.is_ok());
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM otp_challenges")
        .fetch_one(&f.db.pool)
        .await
        .expect("invariant: count");
    assert_eq!(count, 0);
    f.db.close().await;
}

#[tokio::test]
async fn permissions_and_disabled_accounts_are_reread_and_idle_sessions_expire() {
    let f = Fixture::new().await;
    f.request("owner@example.test")
        .await
        .expect("invariant: request");
    let signed = f
        .service
        .verify_code(email("owner@example.test"), f.code())
        .await
        .expect("invariant: login");
    sqlx::query("DELETE FROM organizer_grants")
        .execute(&f.db.pool)
        .await
        .expect("invariant: revoke grant");
    assert!(
        !f.service
            .authenticate(&signed.token)
            .await
            .expect("invariant: enabled session")
            .organizer
    );
    sqlx::query("UPDATE users SET status='disabled'")
        .execute(&f.db.pool)
        .await
        .expect("invariant: disable");
    assert!(matches!(
        f.service.authenticate(&signed.token).await,
        Err(AuthError::Unauthenticated)
    ));
    sqlx::query("UPDATE users SET status='enabled'")
        .execute(&f.db.pool)
        .await
        .expect("invariant: enable");
    f.advance(7 * 24 * 60 * 60 * 1000);
    assert!(matches!(
        f.service.authenticate(&signed.token).await,
        Err(AuthError::Unauthenticated)
    ));
    f.db.close().await;
}

#[tokio::test]
async fn session_insert_failure_does_not_consume_the_code_or_leave_a_partial_login() {
    let f = Fixture::new().await;
    f.request("owner@example.test")
        .await
        .expect("invariant: request");
    let code = f.code();
    sqlx::query("CREATE TRIGGER reject_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(FAIL,'fixture'); END").execute(&f.db.pool).await.expect("invariant: trigger");
    assert!(matches!(
        f.service
            .verify_code(email("owner@example.test"), code.clone())
            .await,
        Err(AuthError::Storage(StorageError::Unavailable))
    ));
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM sessions")
        .fetch_one(&f.db.pool)
        .await
        .expect("invariant: query");
    assert_eq!(count, 0);
    sqlx::query("DROP TRIGGER reject_audit")
        .execute(&f.db.pool)
        .await
        .expect("invariant: remove trigger");
    assert!(
        f.service
            .verify_code(email("owner@example.test"), code)
            .await
            .is_ok()
    );
    f.db.close().await;
}

#[tokio::test]
async fn invitations_are_permission_checked_durable_and_do_not_duplicate_notifications() {
    use gymtime_app::accounts::AccountError;
    use gymtime_domain::auth::{AccountRole, AccountStatus, UserId};
    let f = Fixture::new().await;
    let owner = UserId::try_from(1).expect("invariant: bootstrap first account");
    assert!(matches!(
        f.service
            .change_account_status(owner, owner, AccountStatus::Disabled)
            .await,
        Err(AccountError::LastOrganizer)
    ));
    let coach = f
        .service
        .invite_account(owner, email("coach@example.test"), AccountRole::Coach)
        .await
        .expect("invariant: organizer invites coach");
    assert!(!coach.organizer);
    assert!(matches!(
        f.service
            .invite_account(
                coach.id,
                email("stranger@example.test"),
                AccountRole::Organizer
            )
            .await,
        Err(AccountError::Auth(AuthError::Forbidden))
    ));
    f.service
        .invite_account(owner, email("coach@example.test"), AccountRole::Coach)
        .await
        .expect("invariant: invitation retry succeeds");
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM email_outbox")
        .fetch_one(&f.db.pool)
        .await
        .expect("invariant: query");
    assert_eq!(count, 1);
    let backup = f
        .service
        .invite_account(owner, email("backup@example.test"), AccountRole::Organizer)
        .await
        .expect("invariant: invite backup");
    f.service
        .change_account_status(backup.id, owner, AccountStatus::Disabled)
        .await
        .expect("invariant: backup can administer first organizer");
    assert!(matches!(
        f.service.list_accounts(owner).await,
        Err(AccountError::Auth(AuthError::Forbidden))
    ));
    assert!(matches!(
        f.service
            .change_account_status(backup.id, backup.id, AccountStatus::Disabled)
            .await,
        Err(AccountError::LastOrganizer)
    ));
    f.db.close().await;
}

#[tokio::test]
async fn failed_notification_insert_rolls_back_the_entire_invitation() {
    use gymtime_domain::auth::{AccountRole, UserId};
    let f = Fixture::new().await;
    sqlx::query("CREATE TRIGGER reject_outbox BEFORE INSERT ON email_outbox BEGIN SELECT RAISE(FAIL,'fixture'); END").execute(&f.db.pool).await.expect("invariant: trigger");
    assert!(
        f.service
            .invite_account(
                UserId::try_from(1).expect("invariant: id"),
                email("coach@example.test"),
                AccountRole::Coach
            )
            .await
            .is_err()
    );
    let accounts = f
        .service
        .list_accounts(UserId::try_from(1).expect("invariant: id"))
        .await
        .expect("invariant: list");
    assert_eq!(accounts.len(), 1);
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM notifications")
        .fetch_one(&f.db.pool)
        .await
        .expect("invariant: query");
    assert_eq!(count, 0);
    f.db.close().await;
}

#[tokio::test]
async fn outbox_retries_transient_failures_and_recovers_leases_with_the_same_delivery_key() {
    use gymtime_app::notifications::{DeliveryStatus, NotificationWorker, OutboxStore};
    use gymtime_domain::auth::{AccountRole, UserId};
    let f = Fixture::new().await;
    f.service
        .invite_account(
            UserId::try_from(1).expect("invariant: id"),
            email("coach@example.test"),
            AccountRole::Coach,
        )
        .await
        .expect("invariant: invite");
    let worker = NotificationWorker {
        store: Arc::new(f.db.clone()),
        email: f.inbox.clone(),
        clock: f.clock.clone(),
        crypto: f.service.crypto.clone(),
    };
    f.inbox.fail.store(true, Ordering::SeqCst);
    assert!(
        worker
            .deliver_one()
            .await
            .expect("invariant: failed email recorded")
    );
    assert!(
        !worker
            .deliver_one()
            .await
            .expect("invariant: retry is not due")
    );
    f.advance(30_000);
    let mut tx = f.db.begin_outbox().await.expect("invariant: claim write");
    let lease = f.service.crypto.token().expect("invariant: lease");
    let original = tx
        .claim(f.clock.now().expect("invariant: clock"), &lease)
        .await
        .expect("invariant: claim")
        .expect("invariant: due job");
    tx.commit()
        .await
        .expect("invariant: persist lease before crash");
    f.advance(30_000);
    let mut tx = f.db.begin_outbox().await.expect("invariant: recover write");
    let new_lease = f.service.crypto.token().expect("invariant: lease");
    let recovered = tx
        .claim(f.clock.now().expect("invariant: clock"), &new_lease)
        .await
        .expect("invariant: recover")
        .expect("invariant: expired lease reclaims job");
    assert_eq!(original.key.as_str(), recovered.key.as_str());
    tx.commit().await.expect("invariant: recovered claim");
    let mut tx =
        f.db.begin_outbox()
            .await
            .expect("invariant: stale acknowledgment");
    tx.finish(
        &original,
        DeliveryStatus::Sent,
        f.clock.now().expect("invariant: clock"),
    )
    .await
    .expect("invariant: stale finish ignored");
    tx.commit().await.expect("invariant: commit");
    let status: String = sqlx::query_scalar("SELECT status FROM email_outbox")
        .fetch_one(&f.db.pool)
        .await
        .expect("invariant: query");
    assert_eq!(status, "sending");
    let mut tx =
        f.db.begin_outbox()
            .await
            .expect("invariant: acknowledge current lease");
    tx.finish(
        &recovered,
        DeliveryStatus::Pending,
        f.clock.now().expect("invariant: clock"),
    )
    .await
    .expect("invariant: return due");
    tx.commit().await.expect("invariant: commit");
    f.inbox.fail.store(false, Ordering::SeqCst);
    assert!(worker.deliver_one().await.expect("invariant: delivers"));
    assert!(!worker.deliver_one().await.expect("invariant: empty outbox"));
    let status: String = sqlx::query_scalar("SELECT status FROM email_outbox")
        .fetch_one(&f.db.pool)
        .await
        .expect("invariant: query");
    assert_eq!(status, "sent");
    f.db.close().await;
}

#[tokio::test]
async fn exhausted_email_delivery_can_be_retried_only_by_an_organizer_with_the_same_identity() {
    use gymtime_app::{
        notifications::NotificationWorker,
        schedule::{MutationIdentity, ScheduleError, ScheduleService, commands::ScheduleAction},
    };
    use gymtime_domain::auth::{AccountRole, OpaqueToken, UserId};
    let f = Fixture::new().await;
    let owner = UserId::try_from(1).expect("invariant: owner id");
    let coach = f
        .service
        .invite_account(owner, email("coach@example.test"), AccountRole::Coach)
        .await
        .expect("invariant: invite");
    let worker = NotificationWorker {
        store: Arc::new(f.db.clone()),
        email: f.inbox.clone(),
        clock: f.clock.clone(),
        crypto: f.service.crypto.clone(),
    };
    f.inbox.fail.store(true, Ordering::SeqCst);
    for _ in 0..5 {
        assert!(
            worker
                .deliver_one()
                .await
                .expect("invariant: attempt recorded")
        );
        f.advance(1_000_000);
    }
    assert!(
        !worker
            .deliver_one()
            .await
            .expect("invariant: exhausted queue")
    );
    let s = ScheduleService {
        store: Arc::new(f.db.clone()),
        clock: f.clock.clone(),
        crypto: f.service.crypto.clone(),
        public_url: f.service.public_url.clone(),
    };
    let failed = s
        .notifications(owner, true)
        .await
        .expect("invariant: failed inbox");
    let id = failed
        .first()
        .expect("invariant: failed invitation")
        .id
        .clone();
    let identity = || MutationIdentity {
        key: OpaqueToken::try_from("f".repeat(64).as_str()).expect("invariant: retry key"),
        canonical_input: "retry email".to_owned(),
    };
    assert!(matches!(
        s.mutate(
            coach.id,
            ScheduleAction::RetryEmail { id: id.clone() },
            identity()
        )
        .await,
        Err(ScheduleError::Auth(AuthError::Forbidden))
    ));
    s.mutate(
        owner,
        ScheduleAction::RetryEmail { id: id.clone() },
        identity(),
    )
    .await
    .expect("invariant: authorized retry");
    s.mutate(
        owner,
        ScheduleAction::RetryEmail { id: id.clone() },
        identity(),
    )
    .await
    .expect("invariant: idempotent retry");
    f.inbox.fail.store(false, Ordering::SeqCst);
    assert!(
        worker
            .deliver_one()
            .await
            .expect("invariant: retry delivered")
    );
    let status: String =
        sqlx::query_scalar("SELECT status FROM email_outbox WHERE notification_id=?")
            .bind(id.as_str())
            .fetch_one(&f.db.pool)
            .await
            .expect("invariant: retained job");
    assert_eq!(status, "sent");
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM notifications")
            .fetch_one(&f.db.pool)
            .await
            .expect("invariant: count"),
        1
    );
    f.db.close().await;
}
