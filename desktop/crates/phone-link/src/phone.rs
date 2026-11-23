//! The phone's end of the link.
//!
//! The Android app runs a Kotlin port of this file (`mobile/…/link/PhoneLink.kt`);
//! this one is the reference both are tested against: the desktop's tests drive
//! it against `server::Connection`, and `vectors.json` pins the bytes so the
//! port cannot drift.

use serde_json::Value;

use crate::crypto::{
    b64, derive_keys, phone_exchanges, unb64, Channel, KeyPair, Transcript, KEY_LEN, NONCE_LEN,
};
use crate::message::{Frame, Mode, PcInfo, Plain, Sealed};
use crate::{Error, Invite, VERSION};

/// Who the phone is: an id and a static key, both kept for good once made.
#[derive(Debug, Clone)]
pub struct PhoneIdentity {
    pub phone_id: String,
    pub keys: KeyPair,
    pub name: String,
    pub platform: String,
}

impl PhoneIdentity {
    pub fn generate(name: &str, platform: &str) -> Self {
        Self {
            phone_id: b64(&crate::crypto::random::<16>()),
            keys: KeyPair::generate(),
            name: name.to_string(),
            platform: platform.to_string(),
        }
    }
}

pub enum Target {
    /// A QR code just scanned.
    Pair(Invite),
    /// A desktop paired before, by the key pinned then.
    Resume { pc_key: [u8; KEY_LEN] },
}

#[derive(Debug, Clone, PartialEq)]
pub enum PhoneStep {
    Send(Frame),
    Opened { paired: bool, pc: PcInfo },
    Response { id: u64, status: u16, body: Value },
    Event { uri: String, payload: Value },
}

enum State {
    Welcome {
        ephemeral: KeyPair,
        nonce: [u8; NONCE_LEN],
    },
    AwaitOpen {
        channel: Channel,
    },
    Open {
        channel: Channel,
    },
    Closed,
}

pub struct PhoneLink {
    identity: PhoneIdentity,
    mode: Mode,
    pc_key: [u8; KEY_LEN],
    token: Option<[u8; crate::crypto::TOKEN_LEN]>,
    state: State,
    next_id: u64,
}

impl PhoneLink {
    /// The link and the hello to send first.
    pub fn start(identity: PhoneIdentity, target: Target) -> (Self, Frame) {
        Self::start_with(
            identity,
            target,
            KeyPair::generate(),
            crate::crypto::random(),
        )
    }

    /// `start` with the ephemeral key and nonce given: for the test vectors.
    pub fn start_with(
        identity: PhoneIdentity,
        target: Target,
        ephemeral: KeyPair,
        nonce: [u8; NONCE_LEN],
    ) -> (Self, Frame) {
        let (mode, pc_key, token) = match target {
            Target::Pair(invite) => (Mode::Pair, invite.pc_key, Some(invite.token)),
            Target::Resume { pc_key } => (Mode::Resume, pc_key, None),
        };
        let hello = Plain::Hello {
            v: VERSION,
            mode,
            id: identity.phone_id.clone(),
            sk: (mode == Mode::Pair).then(|| b64(&identity.keys.public())),
            ek: b64(&ephemeral.public()),
            n: b64(&nonce),
        };
        let frame = Frame::Text(serde_json::to_string(&hello).expect("a hello always serializes"));
        let link = Self {
            identity,
            mode,
            pc_key,
            token,
            state: State::Welcome { ephemeral, nonce },
            next_id: 1,
        };
        (link, frame)
    }

    pub fn is_open(&self) -> bool {
        matches!(self.state, State::Open { .. })
    }

    /// Feed a frame from the desktop. An `Err` means the link is over; its
    /// code says why (`Error::Refused` carries the desktop's own).
    pub fn receive(&mut self, frame: Frame) -> Result<Vec<PhoneStep>, Error> {
        let result = self.step(frame);
        if result.is_err() {
            self.state = State::Closed;
        }
        result
    }

    fn step(&mut self, frame: Frame) -> Result<Vec<PhoneStep>, Error> {
        match (std::mem::replace(&mut self.state, State::Closed), frame) {
            (State::Welcome { ephemeral, nonce }, Frame::Text(text)) => {
                let (ek, n) = match serde_json::from_str::<Plain>(&text).map_err(|_| Error::Json)? {
                    Plain::Welcome { ek, n } => (ek, n),
                    Plain::Error { code } => return Err(Error::Refused(code)),
                    Plain::Hello { .. } => return Err(Error::Unexpected),
                };
                let pc_ephemeral = unb64::<KEY_LEN>(&ek)?;
                let pc_nonce = unb64::<NONCE_LEN>(&n)?;
                let transcript = Transcript {
                    mode: self.mode,
                    phone_id: &self.identity.phone_id,
                    phone_static: &self.identity.keys.public(),
                    pc_static: &self.pc_key,
                    phone_ephemeral: &ephemeral.public(),
                    pc_ephemeral: &pc_ephemeral,
                    phone_nonce: &nonce,
                    pc_nonce: &pc_nonce,
                }
                .hash();
                let exchanges =
                    phone_exchanges(&self.identity.keys, &ephemeral, &self.pc_key, &pc_ephemeral)?;
                let mut channel = Channel::phone(&derive_keys(&exchanges, &transcript));
                let first = match self.token {
                    Some(token) => Sealed::Pair {
                        token: b64(&token),
                        name: self.identity.name.clone(),
                        platform: self.identity.platform.clone(),
                    },
                    None => Sealed::Resume,
                };
                let frame = Frame::Binary(channel.seal(&first)?);
                self.state = State::AwaitOpen { channel };
                Ok(vec![PhoneStep::Send(frame)])
            }
            (State::AwaitOpen { mut channel }, Frame::Binary(bytes)) => {
                match channel.open(&bytes)? {
                    Sealed::Open { paired, pc } => {
                        self.state = State::Open { channel };
                        // Spent: a reconnect resumes with the key, never the token again.
                        self.token = None;
                        self.mode = Mode::Resume;
                        Ok(vec![PhoneStep::Opened { paired, pc }])
                    }
                    Sealed::Error { code } => Err(Error::Refused(code)),
                    _ => Err(Error::Unexpected),
                }
            }
            (State::Open { mut channel }, Frame::Binary(bytes)) => {
                let message = channel.open(&bytes)?;
                self.state = State::Open { channel };
                Ok(match message {
                    Sealed::Res { id, s, b } => vec![PhoneStep::Response {
                        id,
                        status: s,
                        body: b,
                    }],
                    Sealed::Evt { u, p } => vec![PhoneStep::Event { uri: u, payload: p }],
                    Sealed::Error { code } => return Err(Error::Refused(code)),
                    _ => Vec::new(),
                })
            }
            // The desktop refused in plaintext before the channel opened.
            (State::AwaitOpen { .. }, Frame::Text(text)) => {
                match serde_json::from_str::<Plain>(&text) {
                    Ok(Plain::Error { code }) => Err(Error::Refused(code)),
                    _ => Err(Error::Unexpected),
                }
            }
            (State::Closed, _) => Err(Error::Broken),
            _ => Err(Error::Unexpected),
        }
    }

    /// A request for the client: its id (echoed by the response) and the frame to send.
    pub fn request(
        &mut self,
        method: &str,
        path: &str,
        body: Option<Value>,
    ) -> Result<(u64, Frame), Error> {
        let id = self.next_id;
        let State::Open { channel } = &mut self.state else {
            return Err(Error::Unexpected);
        };
        let frame = channel.seal(&Sealed::Req {
            id,
            m: method.to_string(),
            p: path.to_string(),
            b: body,
        })?;
        self.next_id += 1;
        Ok((id, Frame::Binary(frame)))
    }

    pub fn ping(&mut self) -> Result<Frame, Error> {
        let State::Open { channel } = &mut self.state else {
            return Err(Error::Unexpected);
        };
        Ok(Frame::Binary(channel.seal(&Sealed::Ping)?))
    }
}
