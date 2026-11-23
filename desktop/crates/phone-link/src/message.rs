//! What the two sides say to each other.
//!
//! The handshake is plaintext JSON in text frames (`Plain`): it carries only
//! public keys and nonces. Everything after it is a `Sealed` message, JSON
//! encrypted into a binary frame.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// One WebSocket message.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Frame {
    Text(String),
    Binary(Vec<u8>),
}

/// How the phone opens a connection.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Mode {
    /// First contact after scanning the QR code: the phone sends its static key.
    Pair,
    /// A paired phone coming back: the desktop already knows its key.
    Resume,
}

impl Mode {
    pub fn as_str(self) -> &'static str {
        match self {
            Mode::Pair => "pair",
            Mode::Resume => "resume",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "t", rename_all = "lowercase")]
pub enum Plain {
    /// Phone → desktop, always first. `sk` (the phone's static key) only when pairing.
    Hello {
        v: u32,
        mode: Mode,
        id: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        sk: Option<String>,
        ek: String,
        n: String,
    },
    /// Desktop → phone: its ephemeral key and nonce.
    Welcome { ek: String, n: String },
    /// Either side, before the channel exists, so the phone can say why.
    Error { code: String },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "t", rename_all = "lowercase")]
pub enum Sealed {
    /// The phone's first sealed message when pairing: the token the QR code carried.
    Pair {
        token: String,
        name: String,
        platform: String,
    },
    /// The phone's first sealed message when resuming.
    Resume,
    /// The desktop's answer to either: the link is open.
    Open {
        paired: bool,
        pc: PcInfo,
    },
    /// A request for the League client (or the desktop's own `/truemain/*`).
    Req {
        id: u64,
        m: String,
        p: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        b: Option<Value>,
    },
    /// Its answer: the client's status and JSON body.
    Res {
        id: u64,
        s: u16,
        b: Value,
    },
    /// A change the client pushed, on an endpoint the phone may follow.
    Evt {
        u: String,
        p: Value,
    },
    Ping,
    Pong,
    Error {
        code: String,
    },
}

/// The desktop as the phone shows and finds it again.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PcInfo {
    pub name: String,
    /// `ip:port` the phone may reconnect to, best first.
    pub addresses: Vec<String>,
    /// The desktop app's version.
    pub version: String,
}
