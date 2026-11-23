//! The phone's end against the desktop's, frame by frame.

use std::collections::HashMap;

use phone_link::crypto::TOKEN_LEN;
use phone_link::phone::{PhoneIdentity, PhoneLink, PhoneStep, Target};
use phone_link::server::{Connection, Host, PairedPhone, Registry, Step};
use phone_link::{Error, Frame, Invite, KeyPair, PcInfo};
use serde_json::json;

#[derive(Default)]
struct Book {
    phones: HashMap<String, PairedPhone>,
    tokens: Vec<[u8; TOKEN_LEN]>,
}

impl Registry for Book {
    fn phone_key(&self, phone_id: &str) -> Option<[u8; 32]> {
        self.phones.get(phone_id).map(|p| p.key)
    }
    fn spend_token(&mut self, token: &[u8; TOKEN_LEN]) -> bool {
        let before = self.tokens.len();
        self.tokens.retain(|t| t != token);
        self.tokens.len() != before
    }
    fn pair(&mut self, phone: PairedPhone) {
        self.phones.insert(phone.phone_id.clone(), phone);
    }
}

struct Desktop {
    keys: KeyPair,
    info: PcInfo,
    book: Book,
}

impl Desktop {
    fn new() -> Self {
        let info = PcInfo {
            name: "Desk".into(),
            addresses: vec!["192.168.1.20:42719".into()],
            version: "0.5.0".into(),
        };
        Self {
            keys: KeyPair::generate(),
            info,
            book: Book::default(),
        }
    }

    fn invite(&mut self) -> Invite {
        let token = phone_link::crypto::random();
        self.book.tokens.push(token);
        Invite {
            pc_key: self.keys.public(),
            token,
            addresses: self.info.addresses.clone(),
            name: "Desk".into(),
        }
    }

    fn feed(&mut self, connection: &mut Connection, frame: Frame) -> Vec<Step> {
        let mut host = Host {
            keys: &self.keys,
            info: &self.info,
            registry: &mut self.book,
        };
        connection.receive(frame, &mut host)
    }
}

fn sent(steps: &[Step]) -> Vec<Frame> {
    steps
        .iter()
        .filter_map(|s| {
            if let Step::Send(f) = s {
                Some(f.clone())
            } else {
                None
            }
        })
        .collect()
}

fn phone_sent(steps: &[PhoneStep]) -> Frame {
    steps
        .iter()
        .find_map(|s| {
            if let PhoneStep::Send(f) = s {
                Some(f.clone())
            } else {
                None
            }
        })
        .unwrap()
}

/// Runs the handshake to the end; returns both ends and the desktop's last steps.
fn connect(
    desktop: &mut Desktop,
    identity: PhoneIdentity,
    target: Target,
) -> (
    PhoneLink,
    Connection,
    Result<Vec<PhoneStep>, Error>,
    Vec<Step>,
) {
    let (mut phone, hello) = PhoneLink::start(identity, target);
    let mut connection = Connection::new();
    let steps = desktop.feed(&mut connection, hello);
    let reply = sent(&steps).remove(0);
    let after_welcome = match phone.receive(reply) {
        Ok(steps) => steps,
        Err(error) => return (phone, connection, Err(error), steps),
    };
    let steps = desktop.feed(&mut connection, phone_sent(&after_welcome));
    // A first frame the desktop cannot open gets no answer: the socket just closes.
    let opened = match sent(&steps).into_iter().next() {
        Some(reply) => phone.receive(reply),
        None => Err(Error::Broken),
    };
    (phone, connection, opened, steps)
}

#[test]
fn pairs_by_qr_then_resumes_with_the_pinned_key() {
    let mut desktop = Desktop::new();
    let identity = PhoneIdentity::generate("Pixel 8", "android");
    let invite = desktop.invite();

    let (phone, connection, opened, steps) =
        connect(&mut desktop, identity.clone(), Target::Pair(invite.clone()));
    let opened = opened.unwrap();
    assert!(matches!(&opened[0], PhoneStep::Opened { paired: true, pc } if pc.name == "Desk"));
    assert!(steps
        .iter()
        .any(|s| matches!(s, Step::Opened { paired: true, name: Some(n), .. } if n == "Pixel 8")));
    assert!(phone.is_open() && connection.is_open());
    assert_eq!(
        desktop.book.phones[&identity.phone_id].key,
        identity.keys.public()
    );

    // The token is spent: the same QR does not pair a second time.
    let (_, _, again, _) = connect(&mut desktop, identity.clone(), Target::Pair(invite.clone()));
    assert_eq!(again.unwrap_err(), Error::Refused("bad-token".into()));

    let (_, connection, opened, _) = connect(
        &mut desktop,
        identity,
        Target::Resume {
            pc_key: invite.pc_key,
        },
    );
    assert!(matches!(
        &opened.unwrap()[0],
        PhoneStep::Opened { paired: false, .. }
    ));
    assert!(connection.is_open());
}

#[test]
fn refuses_a_phone_it_never_paired() {
    let mut desktop = Desktop::new();
    let pc_key = desktop.keys.public();
    let (_, connection, opened, _) = connect(
        &mut desktop,
        PhoneIdentity::generate("x", "android"),
        Target::Resume { pc_key },
    );
    assert_eq!(opened.unwrap_err(), Error::Refused("unknown-phone".into()));
    assert!(!connection.is_open());
}

#[test]
fn a_phone_pinning_another_desktops_key_cannot_open() {
    let mut desktop = Desktop::new();
    let mut invite = desktop.invite();
    invite.pc_key = KeyPair::generate().public();
    let (_, connection, opened, _) = connect(
        &mut desktop,
        PhoneIdentity::generate("x", "android"),
        Target::Pair(invite),
    );
    // The phone's keys and the desktop's disagree: its first sealed frame does not open.
    assert!(opened.is_err());
    assert!(!connection.is_open());
    assert!(desktop.book.phones.is_empty());
}

#[test]
fn a_stolen_phone_id_without_its_key_cannot_resume() {
    let mut desktop = Desktop::new();
    let identity = PhoneIdentity::generate("Pixel", "android");
    let invite = desktop.invite();
    connect(&mut desktop, identity.clone(), Target::Pair(invite.clone()))
        .2
        .unwrap();

    let impostor = PhoneIdentity {
        keys: KeyPair::generate(),
        ..identity
    };
    let (_, connection, opened, _) = connect(
        &mut desktop,
        impostor,
        Target::Resume {
            pc_key: invite.pc_key,
        },
    );
    assert!(opened.is_err());
    assert!(!connection.is_open());
}

fn open_pair() -> (Desktop, PhoneLink, Connection) {
    let mut desktop = Desktop::new();
    let invite = desktop.invite();
    let (phone, connection, opened, _) = connect(
        &mut desktop,
        PhoneIdentity::generate("Pixel", "android"),
        Target::Pair(invite),
    );
    opened.unwrap();
    (desktop, phone, connection)
}

#[test]
fn carries_allowed_requests_and_refuses_the_rest() {
    let (mut desktop, mut phone, mut connection) = open_pair();

    let (id, frame) = phone
        .request(
            "PATCH",
            "/lol-champ-select/v1/session/actions/3",
            Some(json!({ "championId": 103 })),
        )
        .unwrap();
    let steps = desktop.feed(&mut connection, frame);
    assert_eq!(
        steps,
        vec![Step::Request {
            id,
            method: "PATCH".into(),
            path: "/lol-champ-select/v1/session/actions/3".into(),
            body: Some(json!({ "championId": 103 }))
        }]
    );
    let answer = connection.respond(id, 204, json!({})).unwrap();
    assert_eq!(
        phone.receive(answer).unwrap(),
        vec![PhoneStep::Response {
            id,
            status: 204,
            body: json!({})
        }]
    );

    let (id, frame) = phone
        .request("GET", "/lol-chat/v1/conversations", None)
        .unwrap();
    let steps = desktop.feed(&mut connection, frame);
    let refused = phone.receive(sent(&steps).remove(0)).unwrap();
    assert!(matches!(&refused[0], PhoneStep::Response { id: i, status: 403, .. } if *i == id));
}

#[test]
fn caps_the_requests_in_flight() {
    let (mut desktop, mut phone, mut connection) = open_pair();
    for _ in 0..phone_link::server::MAX_IN_FLIGHT {
        let (_, frame) = phone
            .request("GET", "/lol-gameflow/v1/session", None)
            .unwrap();
        assert!(matches!(
            desktop.feed(&mut connection, frame)[0],
            Step::Request { .. }
        ));
    }
    let (_, frame) = phone
        .request("GET", "/lol-gameflow/v1/session", None)
        .unwrap();
    let steps = desktop.feed(&mut connection, frame);
    assert!(matches!(
        &phone.receive(sent(&steps).remove(0)).unwrap()[0],
        PhoneStep::Response { status: 429, .. }
    ));
}

#[test]
fn forwards_only_the_events_a_phone_follows() {
    let (_, mut phone, mut connection) = open_pair();
    let frame = connection
        .event(
            "/lol-champ-select/v1/session",
            &json!({ "localPlayerCellId": 2 }),
        )
        .unwrap();
    assert_eq!(
        phone.receive(frame).unwrap(),
        vec![PhoneStep::Event {
            uri: "/lol-champ-select/v1/session".into(),
            payload: json!({ "localPlayerCellId": 2 })
        }]
    );
    assert!(connection
        .event("/lol-chat/v1/conversations", &json!({}))
        .is_none());
    assert!(Connection::new()
        .event("/lol-champ-select/v1/session", &json!({}))
        .is_none());
}

#[test]
fn a_replayed_frame_ends_the_link() {
    let (mut desktop, mut phone, mut connection) = open_pair();
    let (_, frame) = phone
        .request("GET", "/lol-gameflow/v1/session", None)
        .unwrap();
    assert!(matches!(
        desktop.feed(&mut connection, frame.clone())[0],
        Step::Request { .. }
    ));
    // The counter has moved on: the same bytes no longer open.
    let steps = desktop.feed(&mut connection, frame);
    assert_eq!(
        steps,
        vec![Step::Close {
            code: "bad-frame".into()
        }]
    );
    assert!(!connection.is_open());
}

#[test]
fn a_tampered_frame_ends_the_link() {
    let (mut desktop, mut phone, mut connection) = open_pair();
    let (_, Frame::Binary(mut bytes)) = phone
        .request("GET", "/lol-gameflow/v1/session", None)
        .unwrap()
    else {
        panic!()
    };
    bytes[0] ^= 1;
    let steps = desktop.feed(&mut connection, Frame::Binary(bytes));
    assert_eq!(
        steps,
        vec![Step::Close {
            code: "bad-frame".into()
        }]
    );
    assert!(!connection.is_open());
}

#[test]
fn answers_a_bad_hello_in_plaintext() {
    let mut desktop = Desktop::new();
    let mut connection = Connection::new();
    let steps = desktop.feed(
        &mut connection,
        Frame::Text(
            r#"{"t":"hello","v":9,"mode":"pair","id":"AAAAAAAAAAAAAAAAAAAAAA","ek":"","n":""}"#
                .into(),
        ),
    );
    assert_eq!(
        sent(&steps),
        vec![Frame::Text(r#"{"t":"error","code":"version"}"#.into())]
    );
    assert!(matches!(steps.last(), Some(Step::Close { code }) if code == "version"));

    let mut connection = Connection::new();
    let steps = desktop.feed(&mut connection, Frame::Binary(vec![1, 2, 3]));
    assert!(matches!(steps.last(), Some(Step::Close { code }) if code == "unexpected"));
}
