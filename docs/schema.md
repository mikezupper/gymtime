# SQLite migration reference

Generated from ordered migration files by `pnpm schema:generate`. This records the applied schema changes; it is not a second schema definition. Read [Architecture](../ARCHITECTURE.md) for transaction ownership.

## migrations/0001_bootstrap.sql

```sql
-- Account bootstrap only. Scheduling and authentication tables arrive with their workflows.
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled', 'disabled'))
);
CREATE TABLE organizer_grants (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT
);
```

## migrations/0002_auth.sql

```sql
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
```

## migrations/0003_notifications.sql

```sql
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
```

## migrations/0004_schedule.sql

```sql
CREATE TABLE gym_settings (
    id INTEGER PRIMARY KEY CHECK(id=1),
    name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
    timezone TEXT NOT NULL,
    split_enabled INTEGER NOT NULL CHECK(split_enabled IN (0,1)),
    version INTEGER NOT NULL DEFAULT 1 CHECK(version>0)
);
INSERT INTO gym_settings(id,name,timezone,split_enabled) VALUES (1,'Your gym','America/New_York',0);
CREATE TABLE gym_hours (
    weekday INTEGER PRIMARY KEY CHECK(weekday BETWEEN 0 AND 6),
    opens TEXT NOT NULL,
    closes TEXT NOT NULL CHECK(closes>opens)
);
CREATE TABLE seasons (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
    starts_on TEXT NOT NULL,
    ends_on TEXT NOT NULL CHECK(ends_on>=starts_on),
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','closed')),
    version INTEGER NOT NULL DEFAULT 1 CHECK(version>0)
);
CREATE UNIQUE INDEX seasons_single_active ON seasons(status) WHERE status='active';
CREATE TABLE teams (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
    share_token TEXT NOT NULL UNIQUE CHECK(length(share_token)=64),
    version INTEGER NOT NULL DEFAULT 1 CHECK(version>0)
);
CREATE TABLE team_grants (
    team_id INTEGER NOT NULL REFERENCES teams(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    role TEXT NOT NULL CHECK(role IN ('primary','assistant')),
    PRIMARY KEY(team_id,user_id)
);
CREATE TABLE team_seasons (
    team_id INTEGER NOT NULL REFERENCES teams(id),
    season_id INTEGER NOT NULL REFERENCES seasons(id),
    PRIMARY KEY(team_id,season_id)
);
CREATE UNIQUE INDEX teams_one_primary ON team_grants(team_id) WHERE role='primary';
CREATE TABLE slots (
    id INTEGER PRIMARY KEY,
    season_id INTEGER NOT NULL REFERENCES seasons(id),
    local_date TEXT NOT NULL,
    local_start TEXT NOT NULL,
    local_end TEXT NOT NULL CHECK(local_end>local_start),
    starts_at INTEGER NOT NULL,
    ends_at INTEGER NOT NULL CHECK(ends_at>starts_at),
    space TEXT NOT NULL CHECK(space IN ('full','half_a','half_b')),
    enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
    version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
    UNIQUE(season_id,starts_at,ends_at,space)
);
CREATE INDEX slots_season_time ON slots(season_id,starts_at);
CREATE TABLE closures (
    id INTEGER PRIMARY KEY,
    starts_at INTEGER NOT NULL,
    ends_at INTEGER NOT NULL CHECK(ends_at>starts_at),
    space TEXT NOT NULL CHECK(space IN ('full','half_a','half_b')),
    reason TEXT NOT NULL CHECK(length(reason) BETWEEN 1 AND 2000),
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
    version INTEGER NOT NULL DEFAULT 1 CHECK(version>0)
);
CREATE INDEX closures_time ON closures(active,starts_at,ends_at);
CREATE TABLE booking_series (
    id TEXT PRIMARY KEY CHECK(length(id)=64),
    team_id INTEGER NOT NULL REFERENCES teams(id),
    season_id INTEGER NOT NULL REFERENCES seasons(id)
);
CREATE TABLE bookings (
    id INTEGER PRIMARY KEY,
    calendar_uid TEXT NOT NULL UNIQUE CHECK(length(calendar_uid)=64),
    team_id INTEGER NOT NULL REFERENCES teams(id),
    slot_id INTEGER NOT NULL REFERENCES slots(id),
    series_id TEXT REFERENCES booking_series(id),
    activity TEXT NOT NULL CHECK(activity IN ('practice','game')),
    note TEXT NOT NULL DEFAULT '' CHECK(length(note)<=2000),
    status TEXT NOT NULL CHECK(status IN ('confirmed','coach_cancelled','organizer_cancelled','closure_cancelled')),
    version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
    created_at INTEGER NOT NULL,
    changed_at INTEGER NOT NULL
);
CREATE INDEX bookings_slot_status ON bookings(slot_id,status);
CREATE INDEX bookings_team ON bookings(team_id);
CREATE TABLE booking_requests (
    id INTEGER PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES teams(id),
    slot_id INTEGER NOT NULL REFERENCES slots(id),
    series_id TEXT REFERENCES booking_series(id),
    activity TEXT NOT NULL CHECK(activity IN ('practice','game')),
    note TEXT NOT NULL DEFAULT '' CHECK(length(note)<=2000),
    competing_reason TEXT NOT NULL DEFAULT '' CHECK(length(competing_reason)<=2000),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','declined','conflict_cancelled','withdrawn','closure_cancelled','invalidated')),
    replaces_booking_id INTEGER REFERENCES bookings(id),
    replaces_version INTEGER,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL,
    version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
    CHECK((replaces_booking_id IS NULL AND replaces_version IS NULL) OR (replaces_booking_id IS NOT NULL AND replaces_version>0))
);
CREATE INDEX requests_slot_status ON booking_requests(slot_id,status);
CREATE TABLE swaps (
    id INTEGER PRIMARY KEY,
    first_booking_id INTEGER NOT NULL REFERENCES bookings(id),
    second_booking_id INTEGER NOT NULL REFERENCES bookings(id) CHECK(second_booking_id!=first_booking_id),
    first_version INTEGER NOT NULL CHECK(first_version>0),
    second_version INTEGER NOT NULL CHECK(second_version>0),
    proposed_by INTEGER NOT NULL REFERENCES users(id),
    proposed_at INTEGER NOT NULL,
    deadline INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','withdrawn','expired','invalidated')),
    version INTEGER NOT NULL DEFAULT 1 CHECK(version>0)
);
CREATE INDEX swaps_deadline ON swaps(status,deadline);
CREATE TABLE mutation_receipts (
    actor_id INTEGER NOT NULL REFERENCES users(id),
    key TEXT NOT NULL CHECK(length(key)=64),
    operation TEXT NOT NULL,
    request_digest BLOB NOT NULL CHECK(length(request_digest)=32),
    result TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY(actor_id,key)
);
```
