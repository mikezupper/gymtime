use crate::{AppState, errors::ApiError};
use axum::{
    Json, Router,
    extract::{Path, State},
    http::{StatusCode, header},
    routing::get,
};
use gymtime_domain::auth::OpaqueToken;
use serde::Serialize;
use utoipa::ToSchema;
#[derive(Serialize, ToSchema)]
pub struct PublicEventView {
    pub uid: String,
    pub sequence: i64,
    pub starts_at: i64,
    pub ends_at: i64,
    pub activity: &'static str,
    pub space: &'static str,
    pub cancelled: bool,
}
#[derive(Serialize, ToSchema)]
pub struct PublicCalendarView {
    pub team: String,
    pub gym: String,
    pub timezone: String,
    pub webpage_url: String,
    pub calendar_url: String,
    pub subscription_url: String,
    pub events: Vec<PublicEventView>,
}
fn parse(token: &str) -> Result<OpaqueToken, ApiError> {
    OpaqueToken::try_from(token).map_err(|_| {
        ApiError::new(
            StatusCode::NOT_FOUND,
            "not_found",
            "This team calendar does not exist.",
        )
    })
}
/// # Errors
/// Returns NotFound for invalid/rotated links, or safe storage errors. No internal fields are projected.
#[utoipa::path(get,operation_id="readPublicCalendar",path="/api/v1/public/teams/{token}",params(("token"=String,Path)),responses((status=200,body=PublicCalendarView)),tag="public calendars")]
pub async fn read(
    State(state): State<AppState>,
    Path(token): Path<String>,
) -> Result<Json<PublicCalendarView>, ApiError> {
    let token = parse(&token)?;
    let c = state.schedule.public_calendar(&token).await?;
    let webpage_url = format!("{}/teams/{}", state.auth.public_url, token.as_str());
    let calendar_url = format!("{}/calendars/{}.ics", state.auth.public_url, token.as_str());
    let subscription_url =
        calendar_url
            .replacen("https://", "webcal://", 1)
            .replacen("http://", "webcal://", 1);
    Ok(Json(PublicCalendarView {
        team: c.team.as_str().to_owned(),
        gym: c.gym.as_str().to_owned(),
        timezone: c.timezone.as_str().to_owned(),
        webpage_url,
        calendar_url,
        subscription_url,
        events: c
            .events
            .into_iter()
            .map(|e| PublicEventView {
                uid: e.uid.as_str().to_owned(),
                sequence: e.sequence,
                starts_at: e.interval.start().epoch_millis(),
                ends_at: e.interval.end().epoch_millis(),
                activity: match e.activity {
                    gymtime_domain::schedule::Activity::Game => "game",
                    gymtime_domain::schedule::Activity::Practice => "practice",
                },
                space: match e.space {
                    gymtime_domain::GymSpace::Full => "full",
                    gymtime_domain::GymSpace::HalfA => "half_a",
                    gymtime_domain::GymSpace::HalfB => "half_b",
                },
                cancelled: e.cancelled,
            })
            .collect(),
    }))
}
/// # Errors
/// Returns NotFound for invalid/rotated links, or safe calendar/storage errors.
#[utoipa::path(get,path="/calendars/{token}.ics",params(("token"=String,Path)),responses((status=200,body=String,content_type="text/calendar")),tag="public calendars")]
pub async fn feed(
    State(state): State<AppState>,
    Path(filename): Path<String>,
) -> Result<([(axum::http::HeaderName, &'static str); 2], String), ApiError> {
    let token = parse(filename.strip_suffix(".ics").ok_or_else(|| {
        ApiError::new(
            StatusCode::NOT_FOUND,
            "not_found",
            "This calendar does not exist.",
        )
    })?)?;
    let c = state.schedule.public_calendar(&token).await?;
    Ok((
        [
            (header::CONTENT_TYPE, "text/calendar; charset=utf-8"),
            (
                header::CONTENT_DISPOSITION,
                "inline; filename=team-calendar.ics",
            ),
        ],
        c.icalendar().map_err(crate::schedule::map_value)?,
    ))
}
pub fn routes(_state: AppState) -> Router<AppState> {
    Router::new()
        .route("/api/v1/public/teams/{token}", get(read))
        .route("/calendars/{filename}", get(feed))
}
