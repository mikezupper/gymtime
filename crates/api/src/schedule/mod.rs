pub mod input;
pub mod output;
pub mod preview;
use crate::{
    AppState,
    auth::{CurrentUser, MutatingUser},
    errors::ApiError,
};
use axum::{
    Json, Router,
    extract::{State, rejection::JsonRejection},
    http::{HeaderMap, StatusCode},
    routing::get,
};
use gymtime_app::{
    auth::AuthError,
    schedule::{MutationIdentity, ScheduleError},
};
use gymtime_domain::{auth::OpaqueToken, schedule::ScheduleValueError};
use input::ActionBody;
use output::{OutcomeView, ScheduleView};
impl From<ScheduleError> for ApiError {
    fn from(e: ScheduleError) -> Self {
        match e {
            ScheduleError::Auth(e) => e.into(),
            ScheduleError::Storage(gymtime_app::StorageError::ConcurrentChange)
            | ScheduleError::Stale => Self::new(
                StatusCode::CONFLICT,
                "stale_record",
                "The schedule changed. Refresh and try again.",
            ),
            ScheduleError::Storage(_) => AuthError::Unavailable.into(),
            ScheduleError::Value(v) => map_value(v),
            ScheduleError::NotFound => Self::new(
                StatusCode::NOT_FOUND,
                "not_found",
                "This schedule item does not exist.",
            ),
            ScheduleError::Inactive => Self::new(
                StatusCode::CONFLICT,
                "inactive_season",
                "This action requires an active season.",
            ),
            ScheduleError::Past => Self::new(
                StatusCode::CONFLICT,
                "completed_date",
                "Completed dates remain in history.",
            ),
            ScheduleError::Unavailable => Self::new(
                StatusCode::CONFLICT,
                "unavailable",
                "This gym space and time are unavailable.",
            ),
            ScheduleError::CompetingReason => {
                Self::field("reason", "Include a reason for the competing request.")
            }
            ScheduleError::OutsideHours => {
                Self::field("time", "Choose times within the gym's opening hours.")
            }
            ScheduleError::SplitDisabled => {
                Self::field("space", "Enable gym halves before creating half-gym slots.")
            }
            ScheduleError::OccupiedSlot => Self::new(
                StatusCode::CONFLICT,
                "occupied_slot",
                "Reschedule or cancel affected bookings and requests first. Use a closure to block occupied gym time.",
            ),
            ScheduleError::ActiveSeasonExists => Self::new(
                StatusCode::CONFLICT,
                "active_season_exists",
                "Close the active season before activating another.",
            ),
            ScheduleError::IdempotencyMismatch => Self::new(
                StatusCode::CONFLICT,
                "idempotency_mismatch",
                "This retry key belongs to a different action.",
            ),
            ScheduleError::InvalidTransition => Self::new(
                StatusCode::CONFLICT,
                "invalid_transition",
                "This action is no longer available. Refresh the schedule.",
            ),
            ScheduleError::LastOrganizer => Self::new(
                StatusCode::CONFLICT,
                "last_organizer",
                "Keep at least one enabled organizer.",
            ),
            ScheduleError::ClosureReason => {
                Self::field("reason", "Explain why the gym is unavailable.")
            }
        }
    }
}
pub(super) fn map_value(v: ScheduleValueError) -> ApiError {
    match v {
        ScheduleValueError::NonexistentTime => ApiError::field(
            "time",
            "This local time does not exist because the clocks change.",
        ),
        ScheduleValueError::AmbiguousTime => ApiError::field(
            "time",
            "This local time occurs twice because the clocks change. Choose an unambiguous time.",
        ),
        ScheduleValueError::Identifier
        | ScheduleValueError::Name
        | ScheduleValueError::Date
        | ScheduleValueError::Time
        | ScheduleValueError::Timezone
        | ScheduleValueError::Range
        | ScheduleValueError::Weekdays
        | ScheduleValueError::Note
        | ScheduleValueError::Selection => {
            ApiError::field("request", "Check dates, times, selections, and notes.")
        }
    }
}
/// # Errors
/// Returns authentication, storage, or safe decoding errors.
#[utoipa::path(get,operation_id="readSchedule",path="/api/v1/schedule",responses((status=200,body=ScheduleView)),tag="schedule")]
pub async fn read(
    State(state): State<AppState>,
    user: CurrentUser,
) -> Result<Json<ScheduleView>, ApiError> {
    let now = state.auth.clock.now()?;
    let (actor, s) = state.schedule.authorized_snapshot(user.actor.id).await?;
    Ok(Json(output::view(&s, actor.id, actor.organizer, now)?))
}
/// # Errors
/// Requires current permissions, CSRF, an idempotency key and validated action data.
#[utoipa::path(post,path="/api/v1/schedule/actions",request_body=ActionBody,params(("Idempotency-Key"=String,Header,description="64 lowercase hex characters; reuse only for the same action")),responses((status=200,body=OutcomeView),(status=409,body=crate::ErrorResponse)),tag="schedule")]
pub async fn mutate(
    State(state): State<AppState>,
    MutatingUser(user): MutatingUser,
    headers: HeaderMap,
    raw: Result<Json<ActionBody>, JsonRejection>,
) -> Result<Json<OutcomeView>, ApiError> {
    let Json(raw) = raw.map_err(|_| {
        ApiError::field(
            "request",
            "Provide a supported scheduling action and its required fields.",
        )
    })?;
    let key = key(&headers)?;
    let canonical_input =
        serde_json::to_string(&raw).map_err(|_| ApiError::from(AuthError::Unavailable))?;
    let snapshot = state.schedule.snapshot(user.actor.id).await?;
    let command = raw.parse(snapshot.gym.timezone)?;
    tracing::Span::current().record("action", command.operation());
    Ok(Json(
        state
            .schedule
            .mutate(
                user.actor.id,
                command,
                MutationIdentity {
                    key,
                    canonical_input,
                },
            )
            .await?
            .into(),
    ))
}
pub(crate) fn key(headers: &HeaderMap) -> Result<OpaqueToken, ApiError> {
    headers
        .get("idempotency-key")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| OpaqueToken::try_from(v).ok())
        .ok_or_else(|| {
            ApiError::field(
                "idempotency_key",
                "Provide a 64-character lowercase hex retry key.",
            )
        })
}
pub fn routes(_state: AppState) -> Router<AppState> {
    Router::new()
        .route("/api/v1/schedule", get(read))
        .route(
            "/api/v1/schedule/preview",
            axum::routing::post(preview::preview),
        )
        .route("/api/v1/schedule/actions", axum::routing::post(mutate))
}
