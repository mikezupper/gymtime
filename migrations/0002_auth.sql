CREATE TABLE otp_challenges (
    email TEXT PRIMARY KEY REFERENCES users(email) ON DELETE CASCADE,
    identity TEXT NOT NULL UNIQUE,
    digest BLOB NOT NULL CHECK(length(digest) = 32),
    expires_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5)
);
CREATE TABLE auth_rate_events (
    id INTEGER PRIMARY KEY,
    key BLOB NOT NULL CHECK(length(key) = 32),
    occurred_at INTEGER NOT NULL
);
CREATE INDEX auth_rate_key_time ON auth_rate_events(key, occurred_at);
CREATE TABLE sessions (
    digest BLOB PRIMARY KEY CHECK(length(digest) = 32),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE audit_events (
    id INTEGER PRIMARY KEY,
    actor_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    resource_id TEXT,
    occurred_at INTEGER NOT NULL
);
