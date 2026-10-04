use crate::{AppState, auth::CurrentUser, errors::ApiError};
use axum::{
    Json,
    extract::{State, rejection::JsonRejection},
};
use serde::Serialize;
use utoipa::ToSchema;
#[derive(Serialize, ToSchema)]
pub struct PreviewItem {
    pub date: String,
    pub start: Option<String>,
    pub end: Option<String>,
    pub space: Option<&'static str>,
    pub error: Option<crate::errors::ErrorResponse>,
}
#[derive(Serialize, ToSchema)]
pub struct PreviewView {
    pub occurrences: Vec<PreviewItem>,
    pub affected_bookings: Vec<i64>,
    pub affected_requests: Vec<i64>,
}
/// # Errors
/// Requires organizer permissions; validates template/closure data without saving it.
#[utoipa::path(post,path="/api/v1/schedule/preview",request_body=super::input::ActionBody,responses((status=200,body=PreviewView)),tag="schedule")]
pub async fn preview(
    State(state): State<AppState>,
    user: CurrentUser,
    raw: Result<Json<super::input::ActionBody>, JsonRejection>,
) -> Result<Json<PreviewView>, ApiError> {
    let Json(raw) =
        raw.map_err(|_| ApiError::field("request", "Provide a slot template or closure."))?;
    let s = state.schedule.snapshot(user.actor.id).await?;
    let preview = state
        .schedule
        .preview(user.actor.id, raw.parse(s.gym.timezone)?)
        .await?;
    Ok(Json(PreviewView {
        occurrences: preview
            .occurrences
            .into_iter()
            .map(|p| match p.slot {
                Ok(s) => PreviewItem {
                    date: p.date.as_string(),
                    start: Some(s.hours.start().as_string()),
                    end: Some(s.hours.end().as_string()),
                    space: Some(super::output::space(s.space)),
                    error: None,
                },
                Err(e) => PreviewItem {
                    date: p.date.as_string(),
                    start: None,
                    end: None,
                    space: None,
                    error: Some(ApiError::from(e).body),
                },
            })
            .collect(),
        affected_bookings: preview.bookings.into_iter().map(|id| id.get()).collect(),
        affected_requests: preview.requests.into_iter().map(|id| id.get()).collect(),
    }))
}
