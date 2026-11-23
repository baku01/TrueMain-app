//! The pairing QR code.
//!
//! `truemain://link?v=1&k=<desktop key>&t=<token>&a=<ip:port,…>&n=<name>`.
//! Short on purpose: the fewer the characters, the coarser the QR modules and
//! the easier a phone camera reads it off a monitor.

use crate::crypto::{b64, unb64, KEY_LEN, TOKEN_LEN};
use crate::VERSION;

pub const PREFIX: &str = "truemain://link?";
/// Addresses carried at most: a desktop with more (VPN, virtual adapters) keeps its best.
pub const MAX_ADDRESSES: usize = 4;
pub const MAX_NAME_LEN: usize = 40;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Invite {
    /// The desktop's static key, which the phone pins.
    pub pc_key: [u8; KEY_LEN],
    /// Single use, short-lived: proves the phone saw this screen.
    pub token: [u8; TOKEN_LEN],
    pub addresses: Vec<String>,
    pub name: String,
}

impl Invite {
    pub fn encode(&self) -> String {
        let mut uri = format!(
            "{PREFIX}v={VERSION}&k={}&t={}",
            b64(&self.pc_key),
            b64(&self.token)
        );
        let addresses: Vec<&str> = self
            .addresses
            .iter()
            .map(String::as_str)
            .filter(|a| is_address(a))
            .take(MAX_ADDRESSES)
            .collect();
        if !addresses.is_empty() {
            uri.push_str("&a=");
            uri.push_str(&addresses.join(","));
        }
        let name = clean_name(&self.name);
        if !name.is_empty() {
            uri.push_str("&n=");
            uri.push_str(&percent_encode(&name));
        }
        uri
    }

    /// `None` for anything that is not a version-1 invite.
    pub fn parse(text: &str) -> Option<Self> {
        let query = text.trim().strip_prefix(PREFIX)?;
        let (mut version, mut key, mut token, mut addresses, mut name) =
            (None, None, None, Vec::new(), String::new());
        for part in query.split('&') {
            let (field, value) = part.split_once('=')?;
            match field {
                "v" => version = value.parse::<u32>().ok(),
                "k" => key = unb64::<KEY_LEN>(value).ok(),
                "t" => token = unb64::<TOKEN_LEN>(value).ok(),
                "a" => {
                    addresses = value
                        .split(',')
                        .filter(|a| is_address(a))
                        .take(MAX_ADDRESSES)
                        .map(str::to_string)
                        .collect()
                }
                "n" => {
                    name = percent_decode(value)
                        .map(|n| clean_name(&n))
                        .unwrap_or_default()
                }
                _ => {}
            }
        }
        if version? != VERSION {
            return None;
        }
        Some(Self {
            pc_key: key?,
            token: token?,
            addresses,
            name,
        })
    }
}

/// `a.b.c.d:port`, nothing else: the phone connects to exactly what it reads.
pub fn is_address(text: &str) -> bool {
    let Some((ip, port)) = text.rsplit_once(':') else {
        return false;
    };
    ip.parse::<std::net::Ipv4Addr>().is_ok() && port.parse::<u16>().is_ok_and(|p| p > 0)
}

/// Shown on the other side's screen: control characters out, length capped.
pub fn clean_name(name: &str) -> String {
    name.chars()
        .filter(|c| !c.is_control())
        .collect::<String>()
        .trim()
        .chars()
        .take(MAX_NAME_LEN)
        .collect()
}

fn percent_encode(text: &str) -> String {
    let mut out = String::new();
    for byte in text.bytes() {
        if byte.is_ascii_alphanumeric() || b"-_.~".contains(&byte) {
            out.push(byte as char);
        } else {
            out.push_str(&format!("%{byte:02X}"));
        }
    }
    out
}

fn percent_decode(text: &str) -> Option<String> {
    let bytes = text.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            let hex = std::str::from_utf8(bytes.get(index + 1..index + 3)?).ok()?;
            out.push(u8::from_str_radix(hex, 16).ok()?);
            index += 3;
        } else {
            out.push(bytes[index]);
            index += 1;
        }
    }
    String::from_utf8(out).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn invite() -> Invite {
        Invite {
            pc_key: [7; 32],
            token: [9; 16],
            addresses: vec!["192.168.1.20:42719".into(), "10.0.0.5:42719".into()],
            name: "Gabriel's PC".into(),
        }
    }

    #[test]
    fn round_trips() {
        let uri = invite().encode();
        assert!(uri.starts_with("truemain://link?v=1&k="));
        assert!(uri.contains("&a=192.168.1.20:42719,10.0.0.5:42719"));
        assert!(uri.contains("&n=Gabriel%27s%20PC"));
        assert_eq!(Invite::parse(&uri), Some(invite()));
    }

    #[test]
    fn refuses_other_versions_and_schemes() {
        let uri = invite().encode();
        assert_eq!(Invite::parse(&uri.replace("v=1", "v=2")), None);
        assert_eq!(Invite::parse(&uri.replace("truemain://", "https://")), None);
        assert_eq!(Invite::parse("192.168.1.20:42719"), None);
    }

    #[test]
    fn needs_key_and_token() {
        assert_eq!(Invite::parse("truemain://link?v=1&k=AAAA"), None);
        let uri = invite().encode();
        let without_token: String = uri
            .split('&')
            .filter(|p| !p.starts_with("t="))
            .collect::<Vec<_>>()
            .join("&");
        assert_eq!(Invite::parse(&without_token), None);
    }

    #[test]
    fn drops_anything_that_is_not_an_ipv4_address() {
        let mut invite = invite();
        invite.addresses = vec![
            "evil.example:80".into(),
            "192.168.1.20:42719".into(),
            "[::1]:1".into(),
        ];
        let parsed = Invite::parse(&invite.encode()).unwrap();
        assert_eq!(parsed.addresses, vec!["192.168.1.20:42719".to_string()]);
    }

    #[test]
    fn cleans_the_name() {
        assert_eq!(clean_name("  a\u{0}b\nc  "), "abc");
        assert_eq!(clean_name(&"x".repeat(80)).len(), MAX_NAME_LEN);
    }
}
