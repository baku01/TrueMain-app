//! The link between the app and the player's phone.
//!
//! The phone app drives the League client through the desktop app — queue,
//! lobby, ready check, champion select, runes — so whoever reaches the
//! desktop's port reaches the client. Everything here exists so that only a
//! phone the player paired can, and only for what the phone app needs.
//!
//! - **Pairing** (`invite`): the desktop shows a QR code carrying its public
//!   key, a one-time token and its LAN addresses. The phone pins the key and
//!   spends the token; from then on it resumes with its own key, no token.
//! - **Handshake** (`crypto`): both sides hold a static X25519 key and draw an
//!   ephemeral one per connection; four Diffie-Hellmans, bound to a hash of
//!   everything either side said, feed HKDF-SHA256 one key per direction.
//! - **Channel**: every frame after the handshake is ChaCha20-Poly1305 under a
//!   counter nonce, so a frame dropped, replayed or reordered ends the
//!   connection instead of being accepted.
//! - **What a phone may ask** (`allow`): an allow-list of LCU requests and
//!   events. A phone cannot read chat, touch the account or call anything the
//!   phone app does not use, even once paired.
//!
//! No I/O: `server::Connection` (the desktop's end) and `phone::PhoneLink`
//! (the phone's) are state machines fed frames and returning the frames to
//! send. The desktop's connector carries them over a WebSocket; the Android app
//! ports `phone` to Kotlin and checks itself against `vectors.json`.

pub mod allow;
pub mod crypto;
pub mod error;
pub mod invite;
pub mod message;
pub mod phone;
pub mod server;

pub use crypto::{Channel, KeyPair};
pub use error::Error;
pub use invite::Invite;
pub use message::{Frame, Mode, PcInfo, Plain, Sealed};

/// The protocol's version, carried in the QR code and the hello.
pub const VERSION: u32 = 1;

/// The port the desktop listens on. Fixed, never random: a phone that lost the
/// desktop's address (a new DHCP lease) finds it again by trying this port on
/// every address of its own network.
pub const PORT: u16 = 42719;

/// The WebSocket path of the link.
pub const PATH: &str = "/link/v1";
