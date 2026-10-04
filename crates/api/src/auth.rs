use crate::{AppState, errors::ApiError};
use axum::{
    Json, Router,
    extract::{ConnectInfo, FromRequestParts, State, rejection::JsonRejection},
    http::{HeaderMap, HeaderValue, StatusCode, header, request::Parts},
    middleware::Next,
    response::{IntoResponse, Response},
    routing::{get, post},
};
use gymtime_domain::{
    EmailAddress,
    auth::{Actor, OpaqueToken, OtpCode},
};
use ipnet::IpNet;
use serde::{Deserialize, Serialize};
use std::net::{IpAddr, SocketAddr};
use utoipa::ToSchema;

#[derive(Clone)]
pub struct SecurityConfig {
    pub origins: Vec<String>,
    pub secure_cookie: bool,
    pub trusted_proxies: Vec<IpNet>,
}

#[derive(Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct RequestCodeBody {
    pub email: String,
}
#[derive(Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct VerifyCodeBody {
    pub email: String,
    pub code: String,
}
#[derive(Serialize, ToSchema)]
pub struct CodeResponse {
    pub message: &'static str,
    pub resend_after_seconds: u32,
}
#[derive(Serialize, ToSchema)]
pub struct SessionResponse {
    pub user_id: i64,
    pub email: String,
    pub organizer: bool,
    pub csrf_token: String,
}

pub struct CurrentUser {
    pub actor: Actor,
    pub token: OpaqueToken,
}
impl FromRequestParts<AppState> for CurrentUser {
    type Rejection = ApiError;
    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, ApiError> {
        let token = cookie_token(&parts.headers)
            .ok_or_else(|| ApiError::from(gymtime_app::auth::AuthError::Unauthenticated))?;
        let actor = state.auth.authenticate(&token).await?;
        Ok(Self { actor, token })
    }
}
pub struct MutatingUser(pub CurrentUser);
impl FromRequestParts<AppState> for MutatingUser {
    type Rejection = ApiError;
    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, ApiError> {
        require_origin(&parts.headers, &state.security)?;
        let user = CurrentUser::from_request_parts(parts, state).await?;
        let csrf = parts
            .headers
            .get("x-csrf-token")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| OpaqueToken::try_from(v).ok())
            .ok_or_else(|| ApiError::from(gymtime_app::auth::AuthError::Forbidden))?;
        state.auth.verify_csrf(&user.token, &csrf)?;
        Ok(Self(user))
    }
}
fn cookie_token(headers: &HeaderMap) -> Option<OpaqueToken> {
    headers
        .get(header::COOKIE)?
        .to_str()
        .ok()?
        .split(';')
        .map(str::trim)
        .find_map(|part| {
            part.strip_prefix("gymtime_session=")
                .and_then(|v| OpaqueToken::try_from(v).ok())
        })
}
fn require_origin(headers: &HeaderMap, security: &SecurityConfig) -> Result<(), ApiError> {
    let origin = headers.get(header::ORIGIN).and_then(|v| v.to_str().ok());
    if !origin.is_some_and(|origin| security.origins.iter().any(|allowed| allowed == origin)) {
        return Err(ApiError::from(gymtime_app::auth::AuthError::Forbidden));
    }
    Ok(())
}
#[must_use]
pub fn client_ip(peer: IpAddr, headers: &HeaderMap, trusted: &[IpNet]) -> IpAddr {
    if !trusted.iter().any(|range| range.contains(&peer)) {
        return peer;
    }
    let Some(raw) = headers.get("x-forwarded-for").and_then(|v| v.to_str().ok()) else {
        return peer;
    };
    let parts: Vec<_> = raw.split(',').collect();
    if parts.len() > 16 {
        return peer;
    }
    let Ok(chain) = parts
        .into_iter()
        .map(|s| s.trim().parse::<IpAddr>())
        .collect::<Result<Vec<_>, _>>()
    else {
        return peer;
    };
    let mut address = peer;
    for next in chain.into_iter().rev() {
        if !trusted.iter().any(|range| range.contains(&address)) {
            break;
        }
        address = next;
    }
    address
}
fn body<T>(raw: Result<Json<T>, JsonRejection>) -> Result<T, ApiError> {
    raw.map(|Json(value)| value).map_err(|_| {
        ApiError::new(
            StatusCode::BAD_REQUEST,
            "invalid_json",
            "Provide a valid JSON request with the required fields.",
        )
    })
}
fn email(raw: &str) -> Result<EmailAddress, ApiError> {
    EmailAddress::try_from(raw)
        .map_err(|_| ApiError::field("email", "Enter a valid email address."))
}

#[utoipa::path(post,path="/api/v1/auth/request-code",request_body=RequestCodeBody,responses((status=200,body=CodeResponse),(status=429,body=crate::errors::ErrorResponse)),tag="auth")]
/// # Errors
/// Returns safe input, origin, rate limit, or infrastructure errors.
pub async fn request_code(
    State(state): State<AppState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    raw: Result<Json<RequestCodeBody>, JsonRejection>,
) -> Result<Json<CodeResponse>, ApiError> {
    require_origin(&headers, &state.security)?;
    let command = body(raw)?;
    state
        .auth
        .request_code(
            email(&command.email)?,
            client_ip(peer.ip(), &headers, &state.security.trusted_proxies),
        )
        .await?;
    Ok(Json(CodeResponse {
        message: "If you have been invited, a sign-in code will arrive by email. Check your inbox and spam folder.",
        resend_after_seconds: 60,
    }))
}
#[utoipa::path(post,path="/api/v1/auth/verify-code",request_body=VerifyCodeBody,responses((status=200,body=SessionResponse),(status=401,body=crate::errors::ErrorResponse)),tag="auth")]
/// # Errors
/// Returns safe input, origin, code, or infrastructure errors.
pub async fn verify_code(
    State(state): State<AppState>,
    headers: HeaderMap,
    raw: Result<Json<VerifyCodeBody>, JsonRejection>,
) -> Result<Response, ApiError> {
    require_origin(&headers, &state.security)?;
    let command = body(raw)?;
    let code = OtpCode::try_from(command.code.as_str())
        .map_err(|_| ApiError::field("code", "Enter the six-digit code from your email."))?;
    let signed = state.auth.verify_code(email(&command.email)?, code).await?;
    let response = session_view(signed.actor, signed.csrf);
    let mut response = Json(response).into_response();
    let cookie = format!(
        "gymtime_session={}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000{}",
        signed.token.as_str(),
        if state.security.secure_cookie {
            "; Secure"
        } else {
            ""
        }
    );
    response.headers_mut().insert(
        header::SET_COOKIE,
        HeaderValue::from_str(&cookie)
            .map_err(|_| ApiError::from(gymtime_app::auth::AuthError::Unavailable))?,
    );
    Ok(response)
}
fn session_view(actor: Actor, csrf: OpaqueToken) -> SessionResponse {
    SessionResponse {
        user_id: actor.id.get(),
        email: actor.email.as_str().to_owned(),
        organizer: actor.organizer,
        csrf_token: csrf.as_str().to_owned(),
    }
}
#[utoipa::path(get,path="/api/v1/auth/session",responses((status=200,body=SessionResponse),(status=401,body=crate::errors::ErrorResponse)),tag="auth")]
/// # Errors
/// Returns safe session or infrastructure errors.
pub async fn session(
    State(state): State<AppState>,
    user: CurrentUser,
) -> Result<Json<SessionResponse>, ApiError> {
    Ok(Json(session_view(
        user.actor,
        state.auth.crypto.csrf(&user.token)?,
    )))
}
#[utoipa::path(post,path="/api/v1/auth/logout",responses((status=204)),tag="auth")]
/// # Errors
/// Returns safe session, CSRF, or infrastructure errors.
pub async fn logout(
    State(state): State<AppState>,
    MutatingUser(user): MutatingUser,
) -> Result<Response, ApiError> {
    state.auth.logout(&user.token).await?;
    let mut response = StatusCode::NO_CONTENT.into_response();
    response.headers_mut().insert(
        header::SET_COOKIE,
        HeaderValue::from_static("gymtime_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"),
    );
    Ok(response)
}
#[derive(Clone)]
pub(crate) struct RequestIdentity(pub String);
pub(crate) async fn request_metadata(
    State(state): State<AppState>,
    mut request: axum::extract::Request,
    next: Next,
) -> Response {
    let identity = state
        .auth
        .crypto
        .token()
        .map(|value| value.as_str().to_owned())
        .unwrap_or_else(|_| "unavailable".to_owned());
    let path = request.uri().path();
    let private = path.starts_with("/api/")
        || path.starts_with("/app")
        || path.starts_with("/teams/")
        || path.starts_with("/calendars/")
        || path == "/sign-in"
        || path.starts_with("/health/");
    request
        .extensions_mut()
        .insert(RequestIdentity(identity.clone()));
    let mut response = next.run(request).await;
    if response.status() == StatusCode::SERVICE_UNAVAILABLE
        && response.extensions().get::<ApiError>().is_none()
        && private
    {
        response = ApiError::new(
            StatusCode::SERVICE_UNAVAILABLE,
            "request_unavailable",
            "The request could not finish. Retry using the same action key.",
        )
        .into_response();
    }
    if let Some(error) = response.extensions_mut().remove::<ApiError>() {
        let mut body = error.body;
        body.request_id.clone_from(&identity);
        response = (error.status, Json(body)).into_response();
    }
    if let Ok(value) = HeaderValue::from_str(&identity) {
        response.headers_mut().insert("x-request-id", value);
    }
    if private || response.status().is_client_error() || response.status().is_server_error() {
        response
            .headers_mut()
            .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
        response
            .headers_mut()
            .insert("x-robots-tag", HeaderValue::from_static("noindex"));
    }
    response
}
pub fn routes(_state: AppState) -> Router<AppState> {
    Router::new()
        .route("/api/v1/auth/request-code", post(request_code))
        .route("/api/v1/auth/verify-code", post(verify_code))
        .route("/api/v1/auth/session", get(session))
        .route("/api/v1/auth/logout", post(logout))
}

#[cfg(test)]
#[allow(clippy::expect_used)]
mod tests {
    use super::*;
    #[test]
    fn forwarded_addresses_are_trusted_only_from_declared_proxy_ranges() {
        let peer: IpAddr = "10.0.0.2".parse().expect("invariant: fixture address");
        let ranges = vec!["10.0.0.0/8".parse().expect("invariant: fixture range")];
        let mut headers = HeaderMap::new();
        headers.insert(
            "x-forwarded-for",
            HeaderValue::from_static("203.0.113.1, 198.51.100.2, 10.0.0.3"),
        );
        assert_eq!(client_ip(peer, &headers, &[]), peer);
        assert_eq!(
            client_ip(peer, &headers, &ranges),
            "198.51.100.2"
                .parse::<IpAddr>()
                .expect("invariant: fixture address")
        );
        headers.insert(
            "x-forwarded-for",
            HeaderValue::from_static("malformed, 10.0.0.3"),
        );
        assert_eq!(client_ip(peer, &headers, &ranges), peer);
    }
}
