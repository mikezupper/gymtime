//! Concrete SQLite and email adapters; no HTTP route wiring.
#![forbid(unsafe_code)]
pub mod auth;
pub mod auth_sqlite;
#[cfg(test)]
mod auth_tests;
pub mod email;
pub mod notifications;
pub mod schedule_sqlite;
#[cfg(test)]
mod schedule_tests;
pub mod sqlite;
