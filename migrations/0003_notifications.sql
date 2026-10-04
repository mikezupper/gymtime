CREATE TABLE notifications (
    id TEXT PRIMARY KEY CHECK(length(id)=64),
    user_id INTEGER NOT NULL REFERENCES users(id),
    subject TEXT NOT NULL CHECK(length(subject) BETWEEN 1 AND 200),
    text TEXT NOT NULL CHECK(length(text) BETWEEN 1 AND 100000),
    created_at INTEGER NOT NULL,
    read_at INTEGER
);
CREATE INDEX notifications_user_time ON notifications(user_id,created_at DESC);
CREATE TABLE email_outbox (
    notification_id TEXT PRIMARY KEY REFERENCES notifications(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
    retry_at INTEGER NOT NULL,
    lease TEXT,
    lease_until INTEGER,
    CHECK((status='sending' AND lease IS NOT NULL AND lease_until IS NOT NULL) OR
          (status IN ('pending','sent','failed') AND lease IS NULL AND lease_until IS NULL))
);
CREATE INDEX email_outbox_due ON email_outbox(status,retry_at);
