use gymtime_domain::EmailAddress;
use secrecy::SecretString;
use std::{env, path::PathBuf};
use thiserror::Error;
use url::Url;

#[derive(Debug, Error)]
#[error("invalid or missing configuration: {field}")]
pub struct ConfigError {
    field: &'static str,
}

pub struct Config {
    pub port: u16,
    pub bind_address: std::net::IpAddr,
    pub database_url: String,
    pub initial_organizer: EmailAddress,
    pub resend_url: Url,
    pub resend_key: SecretString,
    pub sender: EmailAddress,
    pub assets: PathBuf,
    pub auth_secret: SecretString,
    pub security: gymtime_api::auth::SecurityConfig,
    pub public_url: String,
}

fn value(field: &'static str, default: Option<&str>) -> Result<String, ConfigError> {
    match env::var(field) {
        Ok(value) if !value.is_empty() => Ok(value),
        Ok(_) | Err(env::VarError::NotPresent) => {
            default.map(str::to_owned).ok_or(ConfigError { field })
        }
        Err(env::VarError::NotUnicode(_)) => Err(ConfigError { field }),
    }
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        let mode = value("APP_ENV", Some("production"))?;
        if mode != "production" && mode != "development" {
            return Err(ConfigError { field: "APP_ENV" });
        }
        let development = mode == "development";
        let origin = Url::parse(&value(
            "APP_PUBLIC_URL",
            if development {
                Some("http://localhost:5177")
            } else {
                None
            },
        )?)
        .map_err(|_| ConfigError {
            field: "APP_PUBLIC_URL",
        })?;
        if origin.host_str().is_none()
            || !origin.username().is_empty()
            || origin.password().is_some()
            || origin.query().is_some()
            || origin.fragment().is_some()
            || origin.path() != "/"
            || !(origin.scheme() == "https" || development && origin.scheme() == "http")
        {
            return Err(ConfigError {
                field: "APP_PUBLIC_URL",
            });
        }
        if !development && value("APP_HOST", None)? != origin.host_str().unwrap_or_default() {
            return Err(ConfigError { field: "APP_HOST" });
        }
        let auth = value(
            "AUTH_SECRET",
            if development {
                Some("local-development-only-secret-32-bytes")
            } else {
                None
            },
        )?;
        if auth.len() < 32 {
            return Err(ConfigError {
                field: "AUTH_SECRET",
            });
        }
        let port = value("APP_PORT", Some("3000"))?
            .parse::<u16>()
            .map_err(|_| ConfigError { field: "APP_PORT" })?;
        if port == 0 {
            return Err(ConfigError { field: "APP_PORT" });
        }
        let initial_organizer = EmailAddress::try_from(
            value(
                "INITIAL_ORGANIZER_EMAIL",
                if development {
                    Some("organizer@example.test")
                } else {
                    None
                },
            )?
            .as_str(),
        )
        .map_err(|_| ConfigError {
            field: "INITIAL_ORGANIZER_EMAIL",
        })?;
        let sender = EmailAddress::try_from(
            value(
                "EMAIL_FROM",
                if development {
                    Some("gymtime@example.test")
                } else {
                    None
                },
            )?
            .as_str(),
        )
        .map_err(|_| ConfigError {
            field: "EMAIL_FROM",
        })?;
        let resend_url = Url::parse(&value(
            "RESEND_BASE_URL",
            if development {
                Some("http://localhost:8027")
            } else {
                None
            },
        )?)
        .map_err(|_| ConfigError {
            field: "RESEND_BASE_URL",
        })?;
        if resend_url.host_str().is_none()
            || !resend_url.username().is_empty()
            || resend_url.password().is_some()
            || resend_url.query().is_some()
            || resend_url.fragment().is_some()
            || !(resend_url.scheme() == "https" || development && resend_url.scheme() == "http")
        {
            return Err(ConfigError {
                field: "RESEND_BASE_URL",
            });
        }
        // The SDK reads this optional environment setting even with explicit client configuration.
        if let Ok(limit) = env::var("RESEND_RATE_LIMIT")
            && !limit.parse::<u32>().is_ok_and(|limit| limit > 0)
        {
            return Err(ConfigError {
                field: "RESEND_RATE_LIMIT",
            });
        }
        let bind_address = value(
            "APP_BIND_ADDRESS",
            Some(if development { "127.0.0.1" } else { "0.0.0.0" }),
        )?
        .parse()
        .map_err(|_| ConfigError {
            field: "APP_BIND_ADDRESS",
        })?;
        let trusted_proxies = value("TRUSTED_PROXY_CIDRS", Some(""))?
            .split(',')
            .filter(|part| !part.trim().is_empty())
            .map(|part| {
                part.trim().parse().map_err(|_| ConfigError {
                    field: "TRUSTED_PROXY_CIDRS",
                })
            })
            .collect::<Result<Vec<_>, _>>()?;
        let mut origins = vec![origin.origin().ascii_serialization()];
        if development && matches!(origin.host_str(), Some("localhost" | "127.0.0.1")) {
            let mut alternate = origin.clone();
            alternate
                .set_host(Some(if origin.host_str() == Some("localhost") {
                    "127.0.0.1"
                } else {
                    "localhost"
                }))
                .map_err(|_| ConfigError {
                    field: "APP_PUBLIC_URL",
                })?;
            origins.push(alternate.origin().ascii_serialization());
        }
        Ok(Self {
            port,
            bind_address,
            initial_organizer,
            sender,
            resend_url,
            database_url: value("DATABASE_URL", None)?,
            resend_key: value(
                "RESEND_API_KEY",
                if development {
                    Some("local-test-key")
                } else {
                    None
                },
            )?
            .into(),
            assets: PathBuf::from(value("ASSETS_DIR", Some("apps/web/dist"))?),
            auth_secret: auth.into(),
            security: gymtime_api::auth::SecurityConfig {
                origins,
                secure_cookie: !development,
                trusted_proxies,
            },
            public_url: origin.origin().ascii_serialization(),
        })
    }
}
