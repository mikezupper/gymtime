//! The production composition root. No other crate connects concrete adapters.
#![forbid(unsafe_code)]
mod config;

use gymtime_api::AppState;
use gymtime_app::bootstrap_organizer;
use gymtime_infra::{
    auth::{SecureCrypto, SystemClock},
    email::ResendEmail,
    sqlite::SqliteDatabase,
};
use std::{net::SocketAddr, sync::Arc};
use thiserror::Error;

#[derive(Debug, Error)]
enum StartupError {
    #[error(transparent)]
    Config(#[from] config::ConfigError),
    #[error(transparent)]
    Storage(#[from] gymtime_app::StorageError),
    #[error(transparent)]
    Email(#[from] gymtime_app::EmailError),
    #[error("HTTP listener failed")]
    Http(#[from] std::io::Error),
    #[error("contract serialization failed")]
    Contract(#[from] serde_json::Error),
    #[error("HTTP shutdown exceeded its deadline")]
    ShutdownTimeout,
}

#[tokio::main]
async fn main() -> Result<(), StartupError> {
    if std::env::args().nth(1).as_deref() == Some("--openapi") {
        println!("{}", serde_json::to_string_pretty(&gymtime_api::openapi())?);
        return Ok(());
    }
    tracing_subscriber::fmt()
        .json()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("gymtime=info")),
        )
        .init();
    let config = config::Config::from_env()?;
    let database = SqliteDatabase::open(&config.database_url).await?;
    bootstrap_organizer(&database, &config.initial_organizer).await?;
    let email = ResendEmail::new(config.resend_url, &config.resend_key, config.sender)?;
    let auth = gymtime_app::auth::AuthService {
        store: Arc::new(database.clone()),
        clock: Arc::new(SystemClock),
        crypto: Arc::new(SecureCrypto::new(config.auth_secret)),
        email: Arc::new(email),
        public_url: config.public_url,
    };
    let schedule = Arc::new(gymtime_app::schedule::ScheduleService {
        store: Arc::new(database.clone()),
        clock: auth.clock.clone(),
        crypto: auth.crypto.clone(),
        public_url: auth.public_url.clone(),
    });
    let worker = gymtime_app::notifications::NotificationWorker {
        store: Arc::new(database.clone()),
        email: auth.email.clone(),
        clock: auth.clock.clone(),
        crypto: auth.crypto.clone(),
    };
    let app = gymtime_api::router(
        AppState {
            storage: Arc::new(database.clone()),
            auth,
            schedule: schedule.clone(),
            security: config.security,
        },
        config.assets,
    );
    let listener =
        tokio::net::TcpListener::bind(SocketAddr::new(config.bind_address, config.port)).await?;
    tracing::info!(port = config.port, "Gymtime is ready");
    let cancellation = tokio_util::sync::CancellationToken::new();
    let worker_stop = cancellation.child_token();
    let mut background = tokio::task::JoinSet::new();
    background.spawn(async move {
        let mut ticker = tokio::time::interval(std::time::Duration::from_secs(1));
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        loop {
            tokio::select! { biased; () = worker_stop.cancelled() => break, _ = ticker.tick() => {} }
            if let Err(error) = schedule.expire_swaps().await { tracing::error!(%error,"swap maintenance failed"); }
            if let Err(error) = worker.deliver_one().await { tracing::error!(%error,"notification delivery pass failed"); }
        }
    });
    let result = axum_serve(listener, app, cancellation.clone()).await;
    cancellation.cancel();
    if tokio::time::timeout(std::time::Duration::from_secs(12), async {
        while let Some(joined) = background.join_next().await {
            if let Err(error) = joined {
                tracing::error!(%error,"background worker failed");
            }
        }
    })
    .await
    .is_err()
    {
        background.shutdown().await;
    }
    database.close().await;
    result
}

async fn axum_serve(
    listener: tokio::net::TcpListener,
    app: axum::Router,
    cancellation: tokio_util::sync::CancellationToken,
) -> Result<(), StartupError> {
    use std::future::IntoFuture;
    let shutdown = cancellation.clone();
    let mut server = Box::pin(axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>()).with_graceful_shutdown(async move {
        #[cfg(unix)]
        {
            match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
                Ok(mut terminate) => { tokio::select! { _ = tokio::signal::ctrl_c() => {}, _ = terminate.recv() => {} } }
                Err(error) => { tracing::error!(%error, "termination signal registration failed"); }
            }
        }
        #[cfg(not(unix))]
        { if let Err(error) = tokio::signal::ctrl_c().await { tracing::error!(%error, "shutdown signal failed"); } }
        tracing::info!("Stopping HTTP requests");
        shutdown.cancel();
    }).into_future());
    tokio::select! {
        result = &mut server => result.map_err(StartupError::Http),
        () = cancellation.cancelled() => tokio::time::timeout(std::time::Duration::from_secs(10), server).await
            .map_err(|_| StartupError::ShutdownTimeout)?.map_err(StartupError::Http),
    }
}
