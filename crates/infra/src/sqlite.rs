use async_trait::async_trait;
use gymtime_app::{StorageError, UnitOfWork, WriteStore};
use gymtime_domain::EmailAddress;
use sqlx::{
    Sqlite, SqlitePool, Transaction,
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions},
};
use std::{str::FromStr, time::Duration};

#[derive(Clone, Debug)]
pub struct SqliteDatabase {
    pub(crate) pool: SqlitePool,
}

impl SqliteDatabase {
    /// # Errors
    /// Returns a redacted storage failure for invalid options, connection, or migrations.
    pub async fn open(database_url: &str) -> Result<Self, StorageError> {
        let mut options = SqliteConnectOptions::from_str(database_url)
            .map_err(|_| StorageError::InvalidData)?
            .create_if_missing(true)
            .foreign_keys(true)
            .journal_mode(SqliteJournalMode::Wal)
            .busy_timeout(Duration::from_secs(5));
        // Resolve file locations before SQLx turns them into SQLite URI filenames.
        if !options.get_filename().is_absolute()
            && !options
                .get_filename()
                .to_string_lossy()
                .starts_with("file:")
        {
            let filename = std::env::current_dir()
                .map_err(|_| StorageError::Unavailable)?
                .join(options.get_filename());
            options = options.filename(filename);
        }
        let pool = SqlitePoolOptions::new()
            .max_connections(4)
            .acquire_timeout(Duration::from_secs(60))
            .connect_with(options)
            .await
            .map_err(|_| StorageError::Unavailable)?;
        sqlx::migrate!("../../migrations")
            .run(&pool)
            .await
            .map_err(|_| StorageError::InvalidData)?;
        Ok(Self { pool })
    }

    pub async fn close(&self) {
        self.pool.close().await;
    }
}

struct SqliteWriteStore {
    transaction: Transaction<'static, Sqlite>,
}

#[async_trait]
impl UnitOfWork for SqliteDatabase {
    async fn begin_write(&self) -> Result<Box<dyn WriteStore>, StorageError> {
        let transaction = self
            .pool
            .begin_with("BEGIN IMMEDIATE")
            .await
            .map_err(|_| StorageError::Unavailable)?;
        Ok(Box::new(SqliteWriteStore { transaction }))
    }
    async fn check_ready(&self) -> Result<(), StorageError> {
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM organizer_grants")
            .fetch_one(&self.pool)
            .await
            .map_err(|_| StorageError::Unavailable)
            .map(|_| ())
    }
}

#[async_trait]
impl WriteStore for SqliteWriteStore {
    async fn has_organizer(&mut self) -> Result<bool, StorageError> {
        sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM organizer_grants)")
            .fetch_one(&mut *self.transaction)
            .await
            .map_err(|_| StorageError::Unavailable)
    }
    async fn insert_organizer(&mut self, email: &EmailAddress) -> Result<(), StorageError> {
        let id = sqlx::query_scalar::<_, i64>("INSERT INTO users(email) VALUES (?) RETURNING id")
            .bind(email.as_str())
            .fetch_one(&mut *self.transaction)
            .await
            .map_err(|_| StorageError::Unavailable)?;
        sqlx::query("INSERT INTO organizer_grants(user_id) VALUES (?)")
            .bind(id)
            .execute(&mut *self.transaction)
            .await
            .map_err(|_| StorageError::Unavailable)?;
        Ok(())
    }
    async fn commit(self: Box<Self>) -> Result<(), StorageError> {
        self.transaction
            .commit()
            .await
            .map_err(|_| StorageError::Unavailable)
    }
    async fn rollback(self: Box<Self>) -> Result<(), StorageError> {
        self.transaction
            .rollback()
            .await
            .map_err(|_| StorageError::Unavailable)
    }
}

#[cfg(test)]
#[allow(clippy::expect_used)]
mod tests {
    use super::*;
    use gymtime_app::bootstrap_organizer;

    async fn database() -> (tempfile::TempDir, SqliteDatabase) {
        let dir = tempfile::tempdir().expect("invariant: temp directory available");
        let db = SqliteDatabase::open(&format!(
            "sqlite://{}",
            dir.path().join("gymtime.db").display()
        ))
        .await
        .expect("invariant: temporary SQLite opens");
        (dir, db)
    }
    fn email(value: &str) -> EmailAddress {
        EmailAddress::try_from(value).expect("invariant: test email is valid")
    }

    #[tokio::test]
    async fn dropped_and_explicitly_rolled_back_writes_leave_no_account() {
        let (_dir, db) = database().await;
        let mut tx = db.begin_write().await.expect("invariant: write starts");
        tx.insert_organizer(&email("coach@example.test"))
            .await
            .expect("invariant: insert succeeds");
        drop(tx);
        let mut tx = db
            .begin_write()
            .await
            .expect("invariant: write restarts after drop");
        assert!(!tx.has_organizer().await.expect("invariant: query succeeds"));
        tx.insert_organizer(&email("coach@example.test"))
            .await
            .expect("invariant: rolled back email is reusable");
        tx.rollback()
            .await
            .expect("invariant: explicit rollback succeeds");
        let count: i64 = sqlx::query_scalar("SELECT count(*) FROM users")
            .fetch_one(&db.pool)
            .await
            .expect("invariant: query succeeds");
        assert_eq!(count, 0);
        db.close().await;
    }

    #[tokio::test]
    async fn bootstrap_failure_after_user_insert_rolls_back_the_whole_workflow() {
        let (_dir, db) = database().await;
        sqlx::query("CREATE TRIGGER reject_grant BEFORE INSERT ON organizer_grants BEGIN SELECT RAISE(FAIL, 'fixture rejection'); END")
            .execute(&db.pool).await.expect("invariant: failure trigger is created");
        let result = bootstrap_organizer(&db, &email("coach@example.test")).await;
        assert!(matches!(result, Err(StorageError::Unavailable)));
        let mut tx = db
            .begin_write()
            .await
            .expect("invariant: failed write is released");
        assert!(!tx.has_organizer().await.expect("invariant: query succeeds"));
        tx.rollback()
            .await
            .expect("invariant: read transaction releases");
        let users: i64 = sqlx::query_scalar("SELECT count(*) FROM users")
            .fetch_one(&db.pool)
            .await
            .expect("invariant: query succeeds");
        assert_eq!(users, 0);
        db.close().await;
    }

    #[tokio::test]
    async fn simultaneous_bootstraps_create_one_organizer_and_restart_preserves_it() {
        let (dir, first) = database().await;
        let second = SqliteDatabase::open(&format!(
            "sqlite://{}",
            dir.path().join("gymtime.db").display()
        ))
        .await
        .expect("invariant: second pool opens");
        let a = email("one@example.test");
        let b = email("two@example.test");
        let (left, right) = tokio::join!(
            bootstrap_organizer(&first, &a),
            bootstrap_organizer(&second, &b)
        );
        assert!(left.is_ok() && right.is_ok());
        let count: i64 = sqlx::query_scalar("SELECT count(*) FROM organizer_grants")
            .fetch_one(&first.pool)
            .await
            .expect("invariant: query succeeds");
        assert_eq!(count, 1);
        bootstrap_organizer(&first, &email("new@example.test"))
            .await
            .expect("invariant: restart succeeds");
        let users: i64 = sqlx::query_scalar("SELECT count(*) FROM users")
            .fetch_one(&second.pool)
            .await
            .expect("invariant: query succeeds");
        assert_eq!(users, 1);
        first.close().await;
        second.close().await;
    }
}
