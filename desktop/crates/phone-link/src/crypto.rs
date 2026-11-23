//! Keys, the key schedule and the sealed channel.

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use chacha20poly1305::aead::{Aead, KeyInit};
use chacha20poly1305::{ChaCha20Poly1305, Key, Nonce};
use hkdf::Hkdf;
use rand_core::{OsRng, RngCore};
use sha2::{Digest, Sha256};
use x25519_dalek::{PublicKey, StaticSecret};

use crate::message::{Mode, Sealed};
use crate::Error;

pub const KEY_LEN: usize = 32;
/// Per-connection nonce each side contributes to the transcript.
pub const NONCE_LEN: usize = 16;
pub const TOKEN_LEN: usize = 16;
/// The largest frame either side accepts; a champ select session is well under it.
pub const MAX_FRAME: usize = 1 << 20;

/// Bound into the transcript and the key derivation, so keys from another
/// protocol or version can never be confused with these.
const LABEL: &[u8] = b"truemain-link/1";
const KEYS_INFO: &[u8] = b"truemain-link/1 keys";

pub fn random<const N: usize>() -> [u8; N] {
    let mut bytes = [0u8; N];
    OsRng.fill_bytes(&mut bytes);
    bytes
}

/// Unpadded base64url, the encoding of every key, nonce and token on the wire.
pub fn b64(bytes: &[u8]) -> String {
    URL_SAFE_NO_PAD.encode(bytes)
}

pub fn unb64<const N: usize>(text: &str) -> Result<[u8; N], Error> {
    let bytes = URL_SAFE_NO_PAD.decode(text).map_err(|_| Error::Encoding)?;
    bytes.try_into().map_err(|_| Error::Encoding)
}

/// An X25519 key pair: a side's static identity, or a connection's ephemeral key.
#[derive(Clone)]
pub struct KeyPair {
    secret: StaticSecret,
    public: [u8; KEY_LEN],
}

impl KeyPair {
    pub fn generate() -> Self {
        Self::from_secret(random())
    }

    pub fn from_secret(bytes: [u8; KEY_LEN]) -> Self {
        let secret = StaticSecret::from(bytes);
        let public = PublicKey::from(&secret).to_bytes();
        Self { secret, public }
    }

    /// For storing a static key; never sent anywhere.
    pub fn secret_bytes(&self) -> [u8; KEY_LEN] {
        self.secret.to_bytes()
    }

    pub fn public(&self) -> [u8; KEY_LEN] {
        self.public
    }

    /// Refuses a peer key that yields the all-zero secret (a low-order point):
    /// it would make the exchange contribute nothing.
    pub(crate) fn dh(&self, peer: &[u8; KEY_LEN]) -> Result<[u8; KEY_LEN], Error> {
        let shared = self.secret.diffie_hellman(&PublicKey::from(*peer));
        if !shared.was_contributory() {
            return Err(Error::BadKey);
        }
        Ok(shared.to_bytes())
    }
}

impl std::fmt::Debug for KeyPair {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("KeyPair")
            .field("public", &b64(&self.public))
            .finish_non_exhaustive()
    }
}

/// Everything the handshake said, in a fixed order.
pub struct Transcript<'a> {
    pub mode: Mode,
    pub phone_id: &'a str,
    pub phone_static: &'a [u8; KEY_LEN],
    pub pc_static: &'a [u8; KEY_LEN],
    pub phone_ephemeral: &'a [u8; KEY_LEN],
    pub pc_ephemeral: &'a [u8; KEY_LEN],
    pub phone_nonce: &'a [u8; NONCE_LEN],
    pub pc_nonce: &'a [u8; NONCE_LEN],
}

impl Transcript<'_> {
    /// Each field length-prefixed (u32, big-endian), so no two different
    /// transcripts concatenate to the same bytes.
    pub fn hash(&self) -> [u8; 32] {
        let mut hasher = Sha256::new();
        let mut field = |bytes: &[u8]| {
            hasher.update((bytes.len() as u32).to_be_bytes());
            hasher.update(bytes);
        };
        field(LABEL);
        field(self.mode.as_str().as_bytes());
        field(self.phone_id.as_bytes());
        field(self.phone_static);
        field(self.pc_static);
        field(self.phone_ephemeral);
        field(self.pc_ephemeral);
        field(self.phone_nonce);
        field(self.pc_nonce);
        hasher.finalize().into()
    }
}

/// One key per direction.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SessionKeys {
    pub phone_to_pc: [u8; KEY_LEN],
    pub pc_to_phone: [u8; KEY_LEN],
}

/// The four exchanges, as both sides name them: `ee` ephemeral×ephemeral,
/// `ss` static×static, `se` phone static × desktop ephemeral, `es` phone
/// ephemeral × desktop static. `ss` makes a resumed session prove both
/// identities; the ephemeral ones give each connection fresh keys.
pub struct Exchanges {
    pub ee: [u8; KEY_LEN],
    pub ss: [u8; KEY_LEN],
    pub se: [u8; KEY_LEN],
    pub es: [u8; KEY_LEN],
}

pub fn derive_keys(exchanges: &Exchanges, transcript: &[u8; 32]) -> SessionKeys {
    let mut input = [0u8; KEY_LEN * 4];
    input[..32].copy_from_slice(&exchanges.ee);
    input[32..64].copy_from_slice(&exchanges.ss);
    input[64..96].copy_from_slice(&exchanges.se);
    input[96..].copy_from_slice(&exchanges.es);
    let mut okm = [0u8; KEY_LEN * 2];
    Hkdf::<Sha256>::new(Some(transcript), &input)
        .expand(KEYS_INFO, &mut okm)
        .expect("64 bytes is a valid HKDF-SHA256 length");
    let mut keys = SessionKeys {
        phone_to_pc: [0; KEY_LEN],
        pc_to_phone: [0; KEY_LEN],
    };
    keys.phone_to_pc.copy_from_slice(&okm[..32]);
    keys.pc_to_phone.copy_from_slice(&okm[32..]);
    keys
}

/// The phone's side of the exchanges.
pub fn phone_exchanges(
    phone_static: &KeyPair,
    phone_ephemeral: &KeyPair,
    pc_static: &[u8; KEY_LEN],
    pc_ephemeral: &[u8; KEY_LEN],
) -> Result<Exchanges, Error> {
    Ok(Exchanges {
        ee: phone_ephemeral.dh(pc_ephemeral)?,
        ss: phone_static.dh(pc_static)?,
        se: phone_static.dh(pc_ephemeral)?,
        es: phone_ephemeral.dh(pc_static)?,
    })
}

/// The desktop's side of the same exchanges.
pub fn pc_exchanges(
    pc_static: &KeyPair,
    pc_ephemeral: &KeyPair,
    phone_static: &[u8; KEY_LEN],
    phone_ephemeral: &[u8; KEY_LEN],
) -> Result<Exchanges, Error> {
    Ok(Exchanges {
        ee: pc_ephemeral.dh(phone_ephemeral)?,
        ss: pc_static.dh(phone_static)?,
        se: pc_ephemeral.dh(phone_static)?,
        es: pc_static.dh(phone_ephemeral)?,
    })
}

/// Both directions of an open connection: one key and one counter each.
pub struct Channel {
    send: ChaCha20Poly1305,
    receive: ChaCha20Poly1305,
    sent: u64,
    received: u64,
    broken: bool,
}

/// 12 bytes: four zeros, then the frame's counter big-endian.
fn counter_nonce(counter: u64) -> Nonce {
    let mut nonce = [0u8; 12];
    nonce[4..].copy_from_slice(&counter.to_be_bytes());
    Nonce::from(nonce)
}

impl Channel {
    pub fn new(send_key: &[u8; KEY_LEN], receive_key: &[u8; KEY_LEN]) -> Self {
        Self {
            send: ChaCha20Poly1305::new(Key::from_slice(send_key)),
            receive: ChaCha20Poly1305::new(Key::from_slice(receive_key)),
            sent: 0,
            received: 0,
            broken: false,
        }
    }

    pub fn phone(keys: &SessionKeys) -> Self {
        Self::new(&keys.phone_to_pc, &keys.pc_to_phone)
    }

    pub fn pc(keys: &SessionKeys) -> Self {
        Self::new(&keys.pc_to_phone, &keys.phone_to_pc)
    }

    pub fn seal_bytes(&mut self, plain: &[u8]) -> Result<Vec<u8>, Error> {
        if self.broken {
            return Err(Error::Broken);
        }
        let frame = self
            .send
            .encrypt(&counter_nonce(self.sent), plain)
            .map_err(|_| Error::TooLarge)?;
        self.sent += 1;
        Ok(frame)
    }

    /// Any failure breaks the channel for good: the caller drops the connection.
    pub fn open_bytes(&mut self, frame: &[u8]) -> Result<Vec<u8>, Error> {
        if self.broken {
            return Err(Error::Broken);
        }
        if frame.len() > MAX_FRAME {
            self.broken = true;
            return Err(Error::TooLarge);
        }
        match self.receive.decrypt(&counter_nonce(self.received), frame) {
            Ok(plain) => {
                self.received += 1;
                Ok(plain)
            }
            Err(_) => {
                self.broken = true;
                Err(Error::BadFrame)
            }
        }
    }

    pub fn seal(&mut self, message: &Sealed) -> Result<Vec<u8>, Error> {
        let plain = serde_json::to_vec(message).map_err(|_| Error::Json)?;
        self.seal_bytes(&plain)
    }

    pub fn open(&mut self, frame: &[u8]) -> Result<Sealed, Error> {
        let plain = self.open_bytes(frame)?;
        serde_json::from_slice(&plain).map_err(|_| Error::Json)
    }
}
