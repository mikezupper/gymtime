use crate::{
    AppState,
    auth::{CurrentUser, MutatingUser},
    errors::ApiError,
};
use axum::{
    Json, Router,
    extract::{Path, State, rejection::JsonRejection},
    http::{HeaderMap, StatusCode},
    routing::{get, patch},
};
use gymtime_app::accounts::AccountError;
use gymtime_domain::{
    EmailAddress,
    auth::{AccountRole, AccountStatus, UserId},
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

impl From<AccountError> for ApiError {
    fn from(error: AccountError) -> Self {
        match error {
            AccountError::Auth(error) => error.into(),
            AccountError::Storage(_) => gymtime_app::auth::AuthError::Unavailable.into(),
            AccountError::LastOrganizer => Self::new(
                StatusCode::CONFLICT,
                "last_organizer",
                "Keep at least one enabled organizer.",
            ),
            AccountError::NotFound => Self::new(
                StatusCode::NOT_FOUND,
                "not_found",
                "This account does not exist.",
            ),
        }
    }
}
#[derive(Serialize, ToSchema)]
pub struct AccountResponse {
    pub user_id: i64,
    pub email: String,
    pub organizer: bool,
    pub enabled: bool,
}
#[derive(Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum InvitationRole {
    Organizer,
    Coach,
}
#[derive(Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct InviteBody {
    pub email: String,
    pub role: InvitationRole,
}
#[derive(Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct StatusBody {
    pub enabled: bool,
}
#[utoipa::path(get,path="/api/v1/accounts",responses((status=200,body=[AccountResponse]),(status=403,body=crate::errors::ErrorResponse)),tag="accounts")]
/// # Errors
/// Returns safe authentication, organizer permission, or storage errors.
pub async fn list(
    State(state): State<AppState>,
    user: CurrentUser,
) -> Result<Json<Vec<AccountResponse>>, ApiError> {
    Ok(Json(
        state
            .auth
            .list_accounts(user.actor.id)
            .await?
            .into_iter()
            .map(|account| AccountResponse {
                user_id: account.actor.id.get(),
                email: account.actor.email.as_str().to_owned(),
                organizer: account.actor.organizer,
                enabled: account.status == AccountStatus::Enabled,
            })
            .collect(),
    ))
}
#[utoipa::path(post,path="/api/v1/accounts",request_body=InviteBody,responses((status=200,body=AccountResponse)),tag="accounts")]
/// # Errors
/// Returns safe authentication, input, organizer permission, or storage errors.
pub async fn invite(
    State(state): State<AppState>,
    MutatingUser(user): MutatingUser,
    headers: HeaderMap,
    raw: Result<Json<InviteBody>, JsonRejection>,
) -> Result<Json<AccountResponse>, ApiError> {
    let Json(raw) = raw
        .map_err(|_| ApiError::field("request", "Provide an email address and invitation role."))?;
    let email = EmailAddress::try_from(raw.email.as_str())
        .map_err(|_| ApiError::field("email", "Enter a valid email address."))?;
    let role = match raw.role {
        InvitationRole::Organizer => AccountRole::Organizer,
        InvitationRole::Coach => AccountRole::Coach,
    };
    let canonical_input = serde_json::to_string(&raw)
        .map_err(|_| ApiError::from(gymtime_app::auth::AuthError::Unavailable))?;
    state
        .schedule
        .mutate(
            user.actor.id,
            gymtime_app::schedule::commands::ScheduleAction::InviteAccount {
                email: email.clone(),
                role,
            },
            gymtime_app::schedule::MutationIdentity {
                key: crate::schedule::key(&headers)?,
                canonical_input,
            },
        )
        .await?;
    let actor = state
        .auth
        .list_accounts(user.actor.id)
        .await?
        .into_iter()
        .find(|a| a.actor.email == email)
        .ok_or_else(|| ApiError::from(gymtime_app::auth::AuthError::Unavailable))?
        .actor;
    Ok(Json(AccountResponse {
        user_id: actor.id.get(),
        email: actor.email.as_str().to_owned(),
        organizer: actor.organizer,
        enabled: true,
    }))
}
#[utoipa::path(patch,path="/api/v1/accounts/{id}",params(("id"=i64,Path)),request_body=StatusBody,responses((status=204),(status=409,body=crate::errors::ErrorResponse)),tag="accounts")]
/// # Errors
/// Returns safe authentication, input, last-organizer, permission, or storage errors.
pub async fn status(
    State(state): State<AppState>,
    MutatingUser(user): MutatingUser,
    path: Result<Path<i64>, axum::extract::rejection::PathRejection>,
    headers: HeaderMap,
    raw: Result<Json<StatusBody>, JsonRejection>,
) -> Result<StatusCode, ApiError> {
    let Path(id) = path.map_err(|_| ApiError::field("user_id", "Choose an invited account."))?;
    let id = UserId::try_from(id)
        .map_err(|_| ApiError::field("user_id", "Choose an invited account."))?;
    let Json(raw) =
        raw.map_err(|_| ApiError::field("enabled", "Choose whether this account is enabled."))?;
    state
        .schedule
        .mutate(
            user.actor.id,
            gymtime_app::schedule::commands::ScheduleAction::SetAccountStatus {
                user: id,
                status: if raw.enabled {
                    AccountStatus::Enabled
                } else {
                    AccountStatus::Disabled
                },
            },
            gymtime_app::schedule::MutationIdentity {
                key: crate::schedule::key(&headers)?,
                canonical_input: format!("{}:{}", id.get(), raw.enabled),
            },
        )
        .await?;
    Ok(StatusCode::NO_CONTENT)
}
pub fn routes(_state: AppState) -> Router<AppState> {
    Router::new()
        .route("/api/v1/accounts", get(list).post(invite))
        .route("/api/v1/accounts/{id}", patch(status))
}
