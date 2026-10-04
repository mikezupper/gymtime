use async_trait::async_trait;
use gymtime_app::{DeliveryKey, EmailError, EmailGateway, EmailMessage};
use gymtime_domain::EmailAddress;
use resend_rs::{ConfigBuilder, Resend, types::CreateEmailBaseOptions};
use secrecy::{ExposeSecret, SecretString};
use std::time::Duration;
use url::Url;

pub struct ResendEmail {
    client: Resend,
    sender: EmailAddress,
}

impl ResendEmail {
    /// # Errors
    /// Returns a typed client failure. Uses the supplied endpoint and key without mutating environment.
    pub fn new(
        mut base_url: Url,
        api_key: &SecretString,
        sender: EmailAddress,
    ) -> Result<Self, EmailError> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .map_err(|_| EmailError::Unavailable)?;
        // SDK convenience endpoints use absolute paths. A relative raw request preserves custom prefixes.
        if !base_url.path().ends_with('/') {
            base_url.set_path(&format!("{}/", base_url.path()));
        }
        let config = ConfigBuilder::new(api_key.expose_secret())
            .base_url(base_url)
            .client(client)
            .build();
        Ok(Self {
            client: Resend::with_config(config),
            sender,
        })
    }
}

#[async_trait]
impl EmailGateway for ResendEmail {
    async fn send(&self, message: &EmailMessage, key: &DeliveryKey) -> Result<(), EmailError> {
        let options = CreateEmailBaseOptions::new(
            self.sender.as_str(),
            [message.recipient().as_str()],
            message.subject(),
        )
        .with_text(message.text());
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            "Idempotency-Key",
            reqwest::header::HeaderValue::from_str(key.as_str())
                .map_err(|_| EmailError::Rejected)?,
        );
        let result = self
            .client
            .send_raw(
                reqwest::Method::POST,
                "emails",
                None::<()>,
                Some(options),
                Some(headers),
            )
            .await
            .and_then(|value| {
                if value
                    .get("id")
                    .and_then(|id| id.as_str())
                    .is_some_and(|id| !id.is_empty())
                {
                    Ok(())
                } else {
                    Err(resend_rs::Error::Other(
                        "invalid delivery response".to_owned(),
                    ))
                }
            })
            .map_err(|error| match error {
                resend_rs::Error::Http(_) | resend_rs::Error::RateLimit { .. } => {
                    EmailError::Unavailable
                }
                resend_rs::Error::Resend(response) => {
                    if response.status_code >= 500 {
                        EmailError::Unavailable
                    } else {
                        EmailError::Rejected
                    }
                }
                resend_rs::Error::Parse { .. } | resend_rs::Error::Other(_) => {
                    EmailError::InvalidResponse
                }
            });
        let outcome = match &result {
            Ok(()) => "sent",
            Err(EmailError::Unavailable) => "unavailable",
            Err(EmailError::Rejected) => "rejected",
            Err(EmailError::InvalidResponse) => "invalid_response",
        };
        tracing::info!(outcome, "email delivery finished");
        result
    }
}

#[cfg(test)]
#[allow(clippy::expect_used)]
mod tests {
    use super::*;
    use axum::{
        Json, Router,
        extract::State,
        http::{HeaderMap, StatusCode},
        routing::post,
    };
    use std::sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    };

    #[derive(Clone)]
    struct Fixture {
        attempts: Arc<AtomicUsize>,
    }

    async fn receive(
        State(fixture): State<Fixture>,
        headers: HeaderMap,
        Json(body): Json<serde_json::Value>,
    ) -> (StatusCode, Json<serde_json::Value>) {
        assert_eq!(
            headers.get("authorization").and_then(|v| v.to_str().ok()),
            Some("Bearer isolated-test-key")
        );
        assert_eq!(
            headers.get("idempotency-key").and_then(|v| v.to_str().ok()),
            Some("delivery-1")
        );
        assert_eq!(
            body.get("from"),
            Some(&serde_json::json!("gym@example.test"))
        );
        assert_eq!(
            body.get("to"),
            Some(&serde_json::json!(["coach@example.test"]))
        );
        assert_eq!(
            body.get("subject"),
            Some(&serde_json::json!("Test notification"))
        );
        assert_eq!(
            body.get("text"),
            Some(&serde_json::json!("Isolated test only."))
        );
        let attempt = fixture.attempts.fetch_add(1, Ordering::SeqCst);
        if attempt == 3 {
            return (
                StatusCode::UNPROCESSABLE_ENTITY,
                Json(
                    serde_json::json!({"statusCode":422,"name":"validation_error","message":"fixture rejection"}),
                ),
            );
        }
        if attempt == 4 {
            return (StatusCode::OK, Json(serde_json::json!({"unexpected":true})));
        }
        if attempt == 0 {
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(
                    serde_json::json!({"statusCode":503,"name":"application_error","message":"retry"}),
                ),
            )
        } else {
            (StatusCode::OK, Json(serde_json::json!({"id":"delivery-1"})))
        }
    }

    #[tokio::test]
    async fn sdk_preserves_custom_prefix_auth_body_and_key_across_retry() {
        let attempts = Arc::new(AtomicUsize::new(0));
        let router = Router::new()
            .route("/custom/resend/emails", post(receive))
            .with_state(Fixture {
                attempts: attempts.clone(),
            });
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("invariant: local test port available");
        let address = listener
            .local_addr()
            .expect("invariant: bound listener has address");
        let server = tokio::spawn(async move { axum::serve(listener, router).await });
        let gateway = ResendEmail::new(
            Url::parse(&format!("http://{address}/custom/resend"))
                .expect("invariant: fixture URL valid"),
            &SecretString::from("isolated-test-key"),
            EmailAddress::try_from("gym@example.test").expect("invariant: sender valid"),
        )
        .expect("invariant: SDK configuration valid");
        let message = EmailMessage::new(
            EmailAddress::try_from("coach@example.test").expect("invariant: recipient valid"),
            "Test notification".to_owned(),
            "Isolated test only.".to_owned(),
        )
        .expect("invariant: message valid");
        let key = DeliveryKey::try_from("delivery-1").expect("invariant: key valid");
        assert!(matches!(
            gateway.send(&message, &key).await,
            Err(EmailError::Unavailable)
        ));
        assert!(gateway.send(&message, &key).await.is_ok());
        assert!(gateway.send(&message, &key).await.is_ok());
        assert!(matches!(
            gateway.send(&message, &key).await,
            Err(EmailError::Rejected)
        ));
        assert!(matches!(
            gateway.send(&message, &key).await,
            Err(EmailError::InvalidResponse)
        ));
        assert_eq!(attempts.load(Ordering::SeqCst), 5);
        // Fixture task is owned by this test and explicitly joined after cancellation.
        server.abort();
        assert!(
            server
                .await
                .expect_err("invariant: aborted fixture is cancelled")
                .is_cancelled()
        );
    }
}
