-- Account bootstrap only. Scheduling and authentication tables arrive with their workflows.
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled', 'disabled'))
);
CREATE TABLE organizer_grants (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT
);
