use crate::{AppState, auth::CurrentUser, errors::ApiError};
use axum::{
    Json, Router,
    extract::{Query, State},
    routing::get,
};
use gymtime_app::notifications::DeliveryStatus;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
#[derive(Deserialize, Default)]
#[serde(deny_unknown_fields)]
pub struct InboxQuery {
    #[serde(default)]
    pub failed_only: bool,
}
#[derive(Serialize, ToSchema)]
pub struct NoticeView {
    pub id: String,
    pub user_id: i64,
    pub recipient: String,
    pub subject: String,
    pub text: String,
    pub created_at: i64,
    pub read: bool,
    pub delivery: &'static str,
}
#[derive(Serialize, ToSchema)]
pub struct AuditView {
    pub actor: i64,
    pub action: String,
    pub occurred_at: i64,
}
/// # Errors
/// Returns authentication or safe query/persistence errors. Only organizers can read failed deliveries for others.
#[utoipa::path(get,path="/api/v1/notifications",params(("failed_only"=Option<bool>,Query)),responses((status=200,body=[NoticeView])),tag="notifications")]
pub async fn inbox(
    State(state): State<AppState>,
    user: CurrentUser,
    query: Result<Query<InboxQuery>, axum::extract::rejection::QueryRejection>,
) -> Result<Json<Vec<NoticeView>>, ApiError> {
    let Query(query) =
        query.map_err(|_| ApiError::field("failed_only", "Choose true or false."))?;
    Ok(Json(
        state
            .schedule
            .notifications(user.actor.id, query.failed_only)
            .await?
            .into_iter()
            .map(|n| NoticeView {
                id: n.id.as_str().to_owned(),
                user_id: n.user.get(),
                recipient: n.message.recipient().as_str().to_owned(),
                subject: n.message.subject().to_owned(),
                text: n.message.text().to_owned(),
                created_at: n.created.epoch_millis(),
                read: n.read,
                delivery: match n.delivery {
                    DeliveryStatus::Pending => "pending",
                    DeliveryStatus::Sending => "sending",
                    DeliveryStatus::Sent => "sent",
                    DeliveryStatus::Failed => "failed",
                },
            })
            .collect(),
    ))
}
/// # Errors
/// Requires current organizer permissions to read safe audit summaries.
#[utoipa::path(get,path="/api/v1/audit",responses((status=200,body=[AuditView])),tag="audit")]
pub async fn audit(
    State(state): State<AppState>,
    user: CurrentUser,
) -> Result<Json<Vec<AuditView>>, ApiError> {
    Ok(Json(
        state
            .schedule
            .audit(user.actor.id)
            .await?
            .into_iter()
            .map(|e| AuditView {
                actor: e.actor.get(),
                action: e.action,
                occurred_at: e.created.epoch_millis(),
            })
            .collect(),
    ))
}
pub fn routes(_state: AppState) -> Router<AppState> {
    Router::new()
        .route("/api/v1/notifications", get(inbox))
        .route("/api/v1/audit", get(audit))
}
