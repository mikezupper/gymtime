//! HTTP boundary and generated wire contract. Concrete adapters are wired by the server.
#![forbid(unsafe_code)]
pub mod accounts;
pub mod auth;
pub mod errors;
pub mod notifications;
pub mod public_calendar;
pub mod schedule;

use axum::{
    Json, Router,
    extract::{MatchedPath, State},
    http::{HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
    routing::get,
};
use gymtime_app::UnitOfWork;
use serde::Serialize;
use std::{path::PathBuf, sync::Arc};
use tower_http::{
    services::{ServeDir, ServeFile},
    set_header::SetResponseHeaderLayer,
    timeout::TimeoutLayer,
    trace::{DefaultOnResponse, TraceLayer},
};
use utoipa::{OpenApi, ToSchema};

#[derive(Clone)]
pub struct AppState {
    pub storage: Arc<dyn UnitOfWork>,
    pub auth: gymtime_app::auth::AuthService,
    pub security: auth::SecurityConfig,
    pub schedule: Arc<gymtime_app::schedule::ScheduleService>,
}

#[derive(Serialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum HealthStatus {
    Alive,
    Ready,
}

#[derive(Serialize, ToSchema)]
pub struct HealthResponse {
    pub status: HealthStatus,
}

pub use errors::ErrorResponse;

#[utoipa::path(get, path = "/health/live", responses((status = 200, body = HealthResponse)), tag = "health")]
async fn live() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: HealthStatus::Alive,
    })
}

#[utoipa::path(get, path = "/health/ready", responses((status = 200, body = HealthResponse), (status = 503, body = ErrorResponse)), tag = "health")]
async fn ready(State(state): State<AppState>) -> Response {
    match state.storage.check_ready().await {
        Ok(()) => Json(HealthResponse {
            status: HealthStatus::Ready,
        })
        .into_response(),
        Err(_) => errors::ApiError::new(
            StatusCode::SERVICE_UNAVAILABLE,
            "storage_unavailable",
            "The database is unavailable.",
        )
        .into_response(),
    }
}

async fn not_found() -> errors::ApiError {
    errors::ApiError::new(
        StatusCode::NOT_FOUND,
        "not_found",
        "This resource does not exist.",
    )
}

#[derive(OpenApi)]
#[openapi(
    paths(
        live,
        ready,
        auth::request_code,
        auth::verify_code,
        auth::session,
        auth::logout,
        accounts::list,
        accounts::invite,
        accounts::status,
        schedule::read,
        schedule::mutate,
        public_calendar::read,
        public_calendar::feed,
        schedule::preview::preview,
        notifications::inbox,
        notifications::audit
    ),
    components(schemas(HealthResponse, HealthStatus, ErrorResponse)),
    info(title = "Gymtime API", version = "0.1.0")
)]
pub struct ApiContract;

#[must_use]
pub fn openapi() -> utoipa::openapi::OpenApi {
    let mut contract = ApiContract::openapi();
    contract.info.license = None;
    contract.info.description =
        Some("Gymtime health and invitation-only sign-in workflows.".to_owned());
    contract
}

pub fn router(state: AppState, assets: PathBuf) -> Router {
    let private = SetResponseHeaderLayer::if_not_present(
        header::CACHE_CONTROL,
        HeaderValue::from_static("no-store"),
    );
    let excluded = SetResponseHeaderLayer::if_not_present(
        axum::http::HeaderName::from_static("x-robots-tag"),
        HeaderValue::from_static("noindex"),
    );
    let shell = ServeFile::new(assets.join("shell.html"));
    let interactive = Router::new()
        .route_service("/sign-in", shell.clone())
        .route_service("/app", shell.clone())
        .route_service("/app/calendar", shell.clone())
        .route_service("/teams/{token}", shell)
        .layer(excluded)
        .layer(private);
    Router::new()
        .merge(auth::routes(state.clone()))
        .merge(accounts::routes(state.clone()))
        .merge(schedule::routes(state.clone()))
        .merge(public_calendar::routes(state.clone()))
        .merge(notifications::routes(state.clone()))
        .route("/health/live", get(live))
        .route("/health/ready", get(ready))
        .route_service("/", ServeFile::new(assets.join("index.html")))
        .route_service("/robots.txt", ServeFile::new(assets.join("robots.txt")))
        .route_service("/sitemap.xml", ServeFile::new(assets.join("sitemap.xml")))
        .nest_service(
            "/assets",
            ServeDir::new(assets.join("assets"))
                .append_index_html_on_directories(false)
                .precompressed_gzip(),
        )
        .merge(interactive)
        .fallback(not_found)
        .layer(TraceLayer::new_for_http()
            .make_span_with(|request: &axum::http::Request<axum::body::Body>| {
                // Matched patterns keep team-link tokens and query strings out of logs.
                tracing::info_span!("http.request", request_id = request.extensions().get::<auth::RequestIdentity>().map_or("unavailable", |id|id.0.as_str()), action=tracing::field::Empty, method = %request.method(), route = request.extensions().get::<MatchedPath>().map_or("unmatched", MatchedPath::as_str))
            })
            .on_response(DefaultOnResponse::new().level(tracing::Level::INFO)))
        .layer(TimeoutLayer::with_status_code(StatusCode::SERVICE_UNAVAILABLE, std::time::Duration::from_secs(10)))
        .layer(axum::middleware::from_fn_with_state(state.clone(),auth::request_metadata))
        .with_state(state)
}
