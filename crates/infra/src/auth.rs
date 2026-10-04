use gymtime_app::auth::{AuthError, Clock, Crypto};
use gymtime_domain::{
    Instant,
    auth::{Digest, OpaqueToken, OtpCode},
};
use hmac::{Hmac, Mac};
use secrecy::{ExposeSecret, SecretString};
use sha2::Sha256;

pub struct SystemClock;
impl Clock for SystemClock {
    #[allow(
        clippy::disallowed_methods,
        reason = "only the injected system clock adapter reads wall time"
    )]
    fn now(&self) -> Result<Instant, AuthError> {
        let value = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|_| AuthError::Unavailable)?
            .as_millis();
        Ok(Instant::from_epoch_millis(
            i64::try_from(value).map_err(|_| AuthError::Unavailable)?,
        ))
    }
}
pub struct SecureCrypto {
    secret: SecretString,
}
impl SecureCrypto {
    #[must_use]
    pub fn new(secret: SecretString) -> Self {
        Self { secret }
    }
    fn mac(&self, scope: &str, value: &str) -> Result<Hmac<Sha256>, AuthError> {
        let mut mac = Hmac::<Sha256>::new_from_slice(self.secret.expose_secret().as_bytes())
            .map_err(|_| AuthError::Unavailable)?;
        mac.update(scope.as_bytes());
        mac.update(&[0]);
        mac.update(value.as_bytes());
        Ok(mac)
    }
}
impl Crypto for SecureCrypto {
    fn token(&self) -> Result<OpaqueToken, AuthError> {
        let mut bytes = [0u8; 32];
        getrandom::fill(&mut bytes).map_err(|_| AuthError::Unavailable)?;
        OpaqueToken::try_from(hex(&bytes).as_str()).map_err(|_| AuthError::Unavailable)
    }
    fn code(&self) -> Result<OtpCode, AuthError> {
        // Rejection sampling avoids modulo bias for each numeric digit.
        let mut value = String::with_capacity(6);
        while value.len() < 6 {
            let mut bytes = [0u8; 16];
            getrandom::fill(&mut bytes).map_err(|_| AuthError::Unavailable)?;
            for byte in bytes {
                if byte < 250 && value.len() < 6 {
                    value.push(char::from(b'0' + byte % 10));
                }
            }
        }
        OtpCode::try_from(value.as_str()).map_err(|_| AuthError::Unavailable)
    }
    fn digest(&self, scope: &str, value: &str) -> Result<Digest, AuthError> {
        let bytes = self.mac(scope, value)?.finalize().into_bytes();
        Digest::try_from(bytes.as_ref()).map_err(|_| AuthError::Unavailable)
    }
    fn matches(&self, scope: &str, value: &str, expected: &Digest) -> Result<bool, AuthError> {
        Ok(self
            .mac(scope, value)?
            .verify_slice(expected.as_bytes())
            .is_ok())
    }
    fn csrf(&self, session: &OpaqueToken) -> Result<OpaqueToken, AuthError> {
        let digest = self.digest("csrf", session.as_str())?;
        OpaqueToken::try_from(hex(digest.as_bytes()).as_str()).map_err(|_| AuthError::Unavailable)
    }
}
fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}
