//! Fixed bytes in, fixed bytes out: `vectors.json`, which the Android app's
//! tests read too (a copy under `mobile/app/src/test/resources`), so the
//! Kotlin port of `phone` and this crate cannot drift apart.
//!
//! `PHONE_LINK_WRITE_VECTORS=1 cargo test -p phone-link --test vectors`
//! rewrites the file after a deliberate protocol change.

use phone_link::crypto::{
    derive_keys, pc_exchanges, phone_exchanges, Channel, KeyPair, Transcript,
};
use phone_link::phone::{PhoneIdentity, PhoneLink, Target};
use phone_link::{Frame, Invite, Mode};
use serde_json::{json, Value};

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn filled(seed: u8) -> [u8; 32] {
    std::array::from_fn(|i| seed.wrapping_add(i as u8))
}

fn vectors() -> Value {
    let phone_static = KeyPair::from_secret(filled(0x10));
    let pc_static = KeyPair::from_secret(filled(0x40));
    let phone_ephemeral = KeyPair::from_secret(filled(0x70));
    let pc_ephemeral = KeyPair::from_secret(filled(0xa0));
    let phone_nonce: [u8; 16] = std::array::from_fn(|i| 0xd0 + i as u8);
    let pc_nonce: [u8; 16] = std::array::from_fn(|i| 0xe0 + i as u8);
    let token: [u8; 16] = std::array::from_fn(|i| 0x30 + i as u8);
    let phone_id = "cGhvbmUtaWQtdmVjdG9y";

    let transcript = Transcript {
        mode: Mode::Pair,
        phone_id,
        phone_static: &phone_static.public(),
        pc_static: &pc_static.public(),
        phone_ephemeral: &phone_ephemeral.public(),
        pc_ephemeral: &pc_ephemeral.public(),
        phone_nonce: &phone_nonce,
        pc_nonce: &pc_nonce,
    }
    .hash();
    let exchanges = phone_exchanges(
        &phone_static,
        &phone_ephemeral,
        &pc_static.public(),
        &pc_ephemeral.public(),
    )
    .unwrap();
    let keys = derive_keys(&exchanges, &transcript);
    let desktop_side = derive_keys(
        &pc_exchanges(
            &pc_static,
            &pc_ephemeral,
            &phone_static.public(),
            &phone_ephemeral.public(),
        )
        .unwrap(),
        &transcript,
    );
    assert_eq!(keys, desktop_side);

    let mut phone_channel = Channel::phone(&keys);
    let mut pc_channel = Channel::pc(&keys);
    let ping = br#"{"t":"ping"}"#;
    let pong = br#"{"t":"pong"}"#;
    let phone_frames = [
        phone_channel.seal_bytes(ping).unwrap(),
        phone_channel.seal_bytes(ping).unwrap(),
    ];
    let pc_frame = pc_channel.seal_bytes(pong).unwrap();

    let invite = Invite {
        pc_key: pc_static.public(),
        token,
        addresses: vec!["192.168.0.12:42719".into()],
        name: "Desk PC".into(),
    };
    let identity = PhoneIdentity {
        phone_id: phone_id.into(),
        keys: phone_static.clone(),
        name: "Pixel".into(),
        platform: "android".into(),
    };
    let (_, Frame::Text(hello)) = PhoneLink::start_with(
        identity,
        Target::Pair(invite.clone()),
        phone_ephemeral.clone(),
        phone_nonce,
    ) else {
        panic!("a hello is text")
    };

    json!({
        "phoneId": phone_id,
        "mode": "pair",
        "phoneStaticSecret": hex(&phone_static.secret_bytes()),
        "phoneStaticPublic": hex(&phone_static.public()),
        "pcStaticSecret": hex(&pc_static.secret_bytes()),
        "pcStaticPublic": hex(&pc_static.public()),
        "phoneEphemeralSecret": hex(&phone_ephemeral.secret_bytes()),
        "phoneEphemeralPublic": hex(&phone_ephemeral.public()),
        "pcEphemeralSecret": hex(&pc_ephemeral.secret_bytes()),
        "pcEphemeralPublic": hex(&pc_ephemeral.public()),
        "phoneNonce": hex(&phone_nonce),
        "pcNonce": hex(&pc_nonce),
        "transcript": hex(&transcript),
        "phoneToPc": hex(&keys.phone_to_pc),
        "pcToPhone": hex(&keys.pc_to_phone),
        "pingPlain": String::from_utf8_lossy(ping),
        "pingSealed0": hex(&phone_frames[0]),
        "pingSealed1": hex(&phone_frames[1]),
        "pongPlain": String::from_utf8_lossy(pong),
        "pongSealed0": hex(&pc_frame),
        "token": hex(&token),
        "invite": invite.encode(),
        "hello": hello,
    })
}

const FILE: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/vectors.json");
const MOBILE_COPY: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../../mobile/app/src/test/resources/link-vectors.json"
);

#[test]
fn the_protocol_still_produces_the_pinned_bytes() {
    let computed = serde_json::to_string_pretty(&vectors()).unwrap() + "\n";
    if std::env::var_os("PHONE_LINK_WRITE_VECTORS").is_some() {
        std::fs::write(FILE, &computed).unwrap();
    }
    let pinned =
        std::fs::read_to_string(FILE).expect("vectors.json is committed next to Cargo.toml");
    assert_eq!(
        pinned, computed,
        "the protocol changed: rewrite the vectors (see this file's doc) and the Android port"
    );
}

#[test]
fn the_android_app_tests_the_same_bytes() {
    // Absent in a checkout without the Android app; present, it must match.
    if let Ok(copy) = std::fs::read_to_string(MOBILE_COPY) {
        assert_eq!(
            copy,
            std::fs::read_to_string(FILE).unwrap(),
            "copy vectors.json to {MOBILE_COPY}"
        );
    }
}
