//! What can go wrong on the link, each with the short code sent to the other side.

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum Error {
    #[error("malformed encoding")]
    Encoding,
    #[error("malformed JSON")]
    Json,
    #[error("unsupported protocol version")]
    Version,
    #[error("malformed phone id")]
    PhoneId,
    #[error("unusable public key")]
    BadKey,
    /// A sealed frame that does not open: tampered, replayed or out of order.
    /// The channel is dead after it.
    #[error("frame failed authentication")]
    BadFrame,
    #[error("frame too large")]
    TooLarge,
    #[error("the channel already failed")]
    Broken,
    #[error("message out of place")]
    Unexpected,
    /// The other side refused, with its code.
    #[error("refused: {0}")]
    Refused(String),
}

impl Error {
    /// The code put in an `error` message.
    pub fn code(&self) -> &str {
        match self {
            Error::Encoding => "bad-encoding",
            Error::Json => "bad-json",
            Error::Version => "version",
            Error::PhoneId => "bad-phone-id",
            Error::BadKey => "bad-key",
            Error::BadFrame => "bad-frame",
            Error::TooLarge => "too-large",
            Error::Broken => "broken",
            Error::Unexpected => "unexpected",
            Error::Refused(code) => code,
        }
    }
}
