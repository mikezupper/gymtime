use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use gymtime_app::auth::AuthError;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Clone, Serialize, ToSchema)]
pub struct FieldIssue {
    pub field: String,
    pub message: String,
}
#[derive(Clone, Serialize, ToSchema)]
pub struct ErrorResponse {
    pub code: &'static str,
    pub message: &'static str,
    pub request_id: String,
    pub issues: Vec<FieldIssue>,
}
#[derive(Clone)]
pub struct ApiError {
    pub status: StatusCode,
    pub body: ErrorResponse,
}
impl ApiError {
    #[must_use]
    pub fn new(status: StatusCode, code: &'static str, message: &'static str) -> Self {
        Self {
            status,
            body: ErrorResponse {
                code,
                message,
                request_id: String::new(),
                issues: vec![],
            },
        }
    }
    #[must_use]
    pub fn field(field: &str, message: &str) -> Self {
        let mut error = Self::new(
            StatusCode::BAD_REQUEST,
            "invalid_input",
            "Check the highlighted fields.",
        );
        error.body.issues.push(FieldIssue {
            field: field.to_owned(),
            message: message.to_owned(),
        });
        error
    }
}
impl From<AuthError> for ApiError {
    fn from(value: AuthError) -> Self {
        match value {
            AuthError::Unavailable | AuthError::Storage(_) => Self::new(
                StatusCode::SERVICE_UNAVAILABLE,
                "service_unavailable",
                "The service is temporarily unavailable. Try again.",
            ),
            AuthError::RateLimited => Self::new(
                StatusCode::TOO_MANY_REQUESTS,
                "rate_limited",
                "Please wait before requesting another code.",
            ),
            AuthError::InvalidCode => Self::new(
                StatusCode::UNAUTHORIZED,
                "invalid_code",
                "This code is incorrect or expired. Request a new code if needed.",
            ),
            AuthError::Unauthenticated => Self::new(
                StatusCode::UNAUTHORIZED,
                "sign_in_required",
                "Sign in to continue.",
            ),
            AuthError::Forbidden => Self::new(
                StatusCode::FORBIDDEN,
                "permission_denied",
                "You do not have permission to make this change.",
            ),
        }
    }
}
impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let mut response = (self.status, Json(self.body.clone())).into_response();
        response.extensions_mut().insert(self);
        response
    }
}
