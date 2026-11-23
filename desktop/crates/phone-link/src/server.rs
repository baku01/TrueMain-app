//! The desktop's end of one phone connection.
//!
//! `hello` → (`welcome`) → first sealed message → `open`. A connection is fed
//! the frames its socket receives and returns what to do: frames to send, a
//! request to run against the client, the link opening or closing. Anything
//! out of place ends it with an `error` the phone can show.

use serde_json::Value;

use crate::crypto::{
    b64, pc_exchanges, unb64, Channel, KeyPair, Transcript, KEY_LEN, NONCE_LEN, TOKEN_LEN,
};
use crate::message::{Frame, Mode, PcInfo, Plain, Sealed};
use crate::{allow, Error, VERSION};

/// Requests a phone may have waiting on the client at once.
pub const MAX_IN_FLIGHT: usize = 32;

/// A phone the desktop paired, as it remembers it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PairedPhone {
    pub phone_id: String,
    pub key: [u8; KEY_LEN],
    pub name: String,
    pub platform: String,
}

/// What the desktop keeps across connections: paired phones and the tokens on screen.
pub trait Registry {
    /// The key a phone pinned when it paired, if it is a paired phone.
    fn phone_key(&self, phone_id: &str) -> Option<[u8; KEY_LEN]>;
    /// Spend a token shown in a QR code: true once, for a live token only.
    fn spend_token(&mut self, token: &[u8; TOKEN_LEN]) -> bool;
    /// Remember a phone that just paired (replacing one with the same id).
    fn pair(&mut self, phone: PairedPhone);
}

/// What the desktop tells the phone about itself, and its static key.
pub struct Host<'a> {
    pub keys: &'a KeyPair,
    pub info: &'a PcInfo,
    pub registry: &'a mut dyn Registry,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Step {
    Send(Frame),
    /// The link is open; `paired` when this connection paired the phone.
    Opened {
        phone_id: String,
        name: Option<String>,
        paired: bool,
    },
    /// Run against the client, then answer with `Connection::respond`.
    Request {
        id: u64,
        method: String,
        path: String,
        body: Option<Value>,
    },
    /// Drop the socket.
    Close {
        code: String,
    },
}

enum State {
    Hello,
    First {
        mode: Mode,
        channel: Channel,
        phone_key: [u8; KEY_LEN],
    },
    Open {
        channel: Channel,
    },
    Closed,
}

pub struct Connection {
    state: State,
    phone_id: Option<String>,
    in_flight: usize,
}

impl Default for Connection {
    fn default() -> Self {
        Self::new()
    }
}

pub fn check_phone_id(id: &str) -> Result<(), Error> {
    let ok = (16..=43).contains(&id.len())
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_');
    if ok {
        Ok(())
    } else {
        Err(Error::PhoneId)
    }
}

impl Connection {
    pub fn new() -> Self {
        Self {
            state: State::Hello,
            phone_id: None,
            in_flight: 0,
        }
    }

    pub fn phone_id(&self) -> Option<&str> {
        self.phone_id.as_deref()
    }

    pub fn is_open(&self) -> bool {
        matches!(self.state, State::Open { .. })
    }

    pub fn receive(&mut self, frame: Frame, host: &mut Host) -> Vec<Step> {
        match self.step(frame, host) {
            Ok(steps) => steps,
            Err(error) => self.fail(error.code()),
        }
    }

    fn step(&mut self, frame: Frame, host: &mut Host) -> Result<Vec<Step>, Error> {
        match (std::mem::replace(&mut self.state, State::Closed), frame) {
            (State::Hello, Frame::Text(text)) => {
                // Back in place before the hello is read, so a refusal is
                // answered in plaintext; a valid hello moves it on.
                self.state = State::Hello;
                self.on_hello(&text, host)
            }
            (
                State::First {
                    mode,
                    mut channel,
                    phone_key,
                },
                Frame::Binary(bytes),
            ) => {
                let message = channel.open(&bytes);
                self.state = State::First {
                    mode,
                    channel,
                    phone_key,
                };
                self.on_first(message?, mode, phone_key, host)
            }
            (State::Open { mut channel }, Frame::Binary(bytes)) => {
                let message = channel.open(&bytes);
                self.state = State::Open { channel };
                Ok(self.on_open(message?))
            }
            (State::Closed, _) => Ok(Vec::new()),
            (state, _) => {
                self.state = state;
                Err(Error::Unexpected)
            }
        }
    }

    fn on_hello(&mut self, text: &str, host: &mut Host) -> Result<Vec<Step>, Error> {
        let Plain::Hello {
            v,
            mode,
            id,
            sk,
            ek,
            n,
        } = serde_json::from_str(text).map_err(|_| Error::Json)?
        else {
            return Err(Error::Unexpected);
        };
        if v != VERSION {
            return Err(Error::Version);
        }
        check_phone_id(&id)?;
        self.phone_id = Some(id.clone());
        let phone_ephemeral = unb64::<KEY_LEN>(&ek)?;
        let phone_nonce = unb64::<NONCE_LEN>(&n)?;
        let phone_key = match mode {
            Mode::Resume => host
                .registry
                .phone_key(&id)
                .ok_or_else(|| Error::Refused("unknown-phone".into()))?,
            Mode::Pair => unb64::<KEY_LEN>(sk.as_deref().ok_or(Error::Unexpected)?)?,
        };

        let ephemeral = KeyPair::generate();
        let pc_nonce: [u8; NONCE_LEN] = crate::crypto::random();
        let pc_static = host.keys.public();
        let transcript = Transcript {
            mode,
            phone_id: &id,
            phone_static: &phone_key,
            pc_static: &pc_static,
            phone_ephemeral: &phone_ephemeral,
            pc_ephemeral: &ephemeral.public(),
            phone_nonce: &phone_nonce,
            pc_nonce: &pc_nonce,
        }
        .hash();
        let exchanges = pc_exchanges(host.keys, &ephemeral, &phone_key, &phone_ephemeral)?;
        let channel = Channel::pc(&crate::crypto::derive_keys(&exchanges, &transcript));
        self.state = State::First {
            mode,
            channel,
            phone_key,
        };

        let welcome = Plain::Welcome {
            ek: b64(&ephemeral.public()),
            n: b64(&pc_nonce),
        };
        Ok(vec![Step::Send(Frame::Text(
            serde_json::to_string(&welcome).map_err(|_| Error::Json)?,
        ))])
    }

    fn on_first(
        &mut self,
        message: Sealed,
        mode: Mode,
        phone_key: [u8; KEY_LEN],
        host: &mut Host,
    ) -> Result<Vec<Step>, Error> {
        let phone_id = self.phone_id.clone().ok_or(Error::Unexpected)?;
        let (paired, name) = match (mode, message) {
            (Mode::Resume, Sealed::Resume) => (false, None),
            (
                Mode::Pair,
                Sealed::Pair {
                    token,
                    name,
                    platform,
                },
            ) => {
                let token =
                    unb64::<TOKEN_LEN>(&token).map_err(|_| Error::Refused("bad-token".into()))?;
                if !host.registry.spend_token(&token) {
                    return Err(Error::Refused("bad-token".into()));
                }
                let name = crate::invite::clean_name(&name);
                let name = if name.is_empty() {
                    "Phone".to_string()
                } else {
                    name
                };
                let platform = if platform == "android" || platform == "ios" {
                    platform
                } else {
                    "unknown".into()
                };
                host.registry.pair(PairedPhone {
                    phone_id: phone_id.clone(),
                    key: phone_key,
                    name: name.clone(),
                    platform,
                });
                (true, Some(name))
            }
            _ => return Err(Error::Unexpected),
        };

        let State::First { channel, .. } = std::mem::replace(&mut self.state, State::Closed) else {
            return Err(Error::Unexpected);
        };
        self.state = State::Open { channel };
        let open = self.seal(&Sealed::Open {
            paired,
            pc: host.info.clone(),
        })?;
        Ok(vec![
            Step::Send(open),
            Step::Opened {
                phone_id,
                name,
                paired,
            },
        ])
    }

    fn on_open(&mut self, message: Sealed) -> Vec<Step> {
        match message {
            Sealed::Ping => self
                .seal(&Sealed::Pong)
                .map(|f| vec![Step::Send(f)])
                .unwrap_or_default(),
            Sealed::Req { id, m, p, b } => {
                if !allow::is_allowed_request(&m, &p) {
                    return self.answer(id, 403, serde_json::json!({ "error": "not-allowed" }));
                }
                if self.in_flight >= MAX_IN_FLIGHT {
                    return self.answer(
                        id,
                        429,
                        serde_json::json!({ "error": "too-many-requests" }),
                    );
                }
                self.in_flight += 1;
                vec![Step::Request {
                    id,
                    method: m.to_ascii_uppercase(),
                    path: p,
                    body: b,
                }]
            }
            // A phone has nothing else to say once open; ignored rather than
            // fatal, so a newer phone's extra message does not drop the link.
            _ => Vec::new(),
        }
    }

    fn answer(&mut self, id: u64, status: u16, body: Value) -> Vec<Step> {
        self.seal(&Sealed::Res {
            id,
            s: status,
            b: body,
        })
        .map(|f| vec![Step::Send(f)])
        .unwrap_or_default()
    }

    /// The client's answer to a `Step::Request`.
    pub fn respond(&mut self, id: u64, status: u16, body: Value) -> Option<Frame> {
        self.in_flight = self.in_flight.saturating_sub(1);
        self.seal(&Sealed::Res {
            id,
            s: status,
            b: body,
        })
        .ok()
    }

    /// An event for this phone, if the link is open and the phone may follow it.
    pub fn event(&mut self, uri: &str, payload: &Value) -> Option<Frame> {
        if !self.is_open() || !allow::is_allowed_event(uri) {
            return None;
        }
        self.seal(&Sealed::Evt {
            u: uri.to_string(),
            p: payload.clone(),
        })
        .ok()
    }

    /// End the connection from the desktop's side (phone removed, app quitting).
    pub fn close(&mut self, code: &str) -> Vec<Step> {
        self.fail(code)
    }

    fn seal(&mut self, message: &Sealed) -> Result<Frame, Error> {
        match &mut self.state {
            State::Open { channel } | State::First { channel, .. } => {
                channel.seal(message).map(Frame::Binary)
            }
            _ => Err(Error::Unexpected),
        }
    }

    /// Sealed once the channel exists, plaintext before it, so the phone can
    /// always read why; nothing when the channel itself failed.
    fn fail(&mut self, code: &str) -> Vec<Step> {
        let frame = match &mut self.state {
            State::Open { channel } | State::First { channel, .. } => channel
                .seal(&Sealed::Error {
                    code: code.to_string(),
                })
                .ok()
                .map(Frame::Binary),
            State::Hello => serde_json::to_string(&Plain::Error {
                code: code.to_string(),
            })
            .ok()
            .map(Frame::Text),
            State::Closed => return Vec::new(),
        };
        self.state = State::Closed;
        let mut steps: Vec<Step> = frame.map(Step::Send).into_iter().collect();
        steps.push(Step::Close {
            code: code.to_string(),
        });
        steps
    }
}
