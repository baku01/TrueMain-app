//! The player's own Riot API key: kept in the system's credential store (the
//! macOS Keychain, the Windows Credential Manager) and never in the webview —
//! its CSP could not reach Riot anyway, and a key in `localStorage` is a key
//! any page script can read. The webview sees a masked form, and asks the shell
//! to check or save a key it just typed.
//!
//! A check is one cheap call (`lol/status/v4/platform-data`) to the platform
//! the player picked. Riot answers every call with its rate limits in headers —
//! `X-App-Rate-Limit` (`20:1,100:120`: 20 requests per second, 100 per two
//! minutes) and `X-App-Rate-Limit-Count` (how many of each are spent) — which
//! is how the page shows what the key allows. Nothing in the app uses the key
//! yet; this is where it lives and where it is verified.

use std::time::Duration;

use serde::Serialize;

#[cfg(any(target_os = "macos", windows))]
const SERVICE: &str = "gg.truemain.desktop";
#[cfg(any(target_os = "macos", windows))]
const ACCOUNT: &str = "riot-api-key";

/// Riot's platform routing values — the subdomain of `api.riotgames.com` a League call goes to.
const PLATFORMS: &[&str] = &[
    "br1", "eun1", "euw1", "jp1", "kr", "la1", "la2", "me1", "na1", "oc1", "ph2", "ru", "sg2",
    "th2", "tr1", "tw2", "vn2",
];

/// One rate-limit window: `limit` requests per `seconds`, `used` of them spent when Riot said.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Window {
    pub seconds: u32,
    pub limit: u32,
    pub used: Option<u32>,
}

/// What a check found, in a word the page can show.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum CheckState {
    /// Riot accepted the key.
    Valid,
    /// 401: no key, or not a key.
    Invalid,
    /// 403: a key Riot refuses — expired (a development key lasts 24 hours) or revoked.
    Forbidden,
    /// 429: the key is valid and over its budget right now.
    RateLimited,
    /// The call did not reach Riot.
    Offline,
    /// Any other answer.
    Error,
}

#[derive(Debug, Clone, Serialize)]
pub struct KeyCheck {
    pub state: CheckState,
    pub status: Option<u16>,
    pub platform: String,
    /// The key's budget across every endpoint (`X-App-Rate-Limit`).
    pub app_limits: Vec<Window>,
    /// The budget of the endpoint asked (`X-Method-Rate-Limit`).
    pub method_limits: Vec<Window>,
    /// Seconds to wait, when Riot said (`Retry-After`).
    pub retry_after: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct KeyStatus {
    pub saved: bool,
    /// The saved key with its middle hidden — never the key.
    pub masked: Option<String>,
}

/// Parses Riot's `limit:seconds,limit:seconds` header, joined with the matching `count:seconds` one.
fn parse_windows(limits: Option<&str>, counts: Option<&str>) -> Vec<Window> {
    let pair = |item: &str| {
        let (value, seconds) = item.trim().split_once(':')?;
        Some((
            value.trim().parse::<u32>().ok()?,
            seconds.trim().parse::<u32>().ok()?,
        ))
    };
    let used: Vec<(u32, u32)> = counts
        .unwrap_or_default()
        .split(',')
        .filter_map(pair)
        .collect();
    let mut windows: Vec<Window> = limits
        .unwrap_or_default()
        .split(',')
        .filter_map(pair)
        .map(|(limit, seconds)| Window {
            seconds,
            limit,
            used: used
                .iter()
                .find(|(_, s)| *s == seconds)
                .map(|(count, _)| *count),
        })
        .collect();
    windows.sort_by_key(|window| window.seconds);
    windows
}

/// `RGAPI-abcd…wxyz`: enough to recognise the key, not to use it.
fn mask(key: &str) -> String {
    let chars: Vec<char> = key.chars().collect();
    if chars.len() <= 14 {
        return "•".repeat(chars.len());
    }
    let head: String = chars[..10].iter().collect();
    let tail: String = chars[chars.len() - 4..].iter().collect();
    format!("{head}…{tail}")
}

/// A key as Riot issues them: `RGAPI-` and a UUID, no spaces.
fn looks_like_key(key: &str) -> bool {
    key.starts_with("RGAPI-")
        && key.len() >= 20
        && key.len() <= 80
        && key.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

fn state_of(status: u16) -> CheckState {
    match status {
        200..=299 => CheckState::Valid,
        401 => CheckState::Invalid,
        403 => CheckState::Forbidden,
        429 => CheckState::RateLimited,
        _ => CheckState::Error,
    }
}

async fn check(key: &str, platform: &str) -> Result<KeyCheck, String> {
    if !PLATFORMS.contains(&platform) {
        return Err(format!("{platform} is not a Riot platform"));
    }
    if !looks_like_key(key) {
        return Err("That does not look like a Riot API key (RGAPI-…).".to_string());
    }
    let url = format!("https://{platform}.api.riotgames.com/lol/status/v4/platform-data");
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent(concat!("TrueMain-Desktop/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|error| error.to_string())?;
    let response = match client.get(url).header("X-Riot-Token", key).send().await {
        Ok(response) => response,
        Err(_) => {
            return Ok(KeyCheck {
                state: CheckState::Offline,
                status: None,
                platform: platform.to_string(),
                app_limits: Vec::new(),
                method_limits: Vec::new(),
                retry_after: None,
            });
        }
    };
    let status = response.status().as_u16();
    let headers = response.headers();
    let header = |name: &str| headers.get(name).and_then(|value| value.to_str().ok());
    Ok(KeyCheck {
        state: state_of(status),
        status: Some(status),
        platform: platform.to_string(),
        app_limits: parse_windows(header("x-app-rate-limit"), header("x-app-rate-limit-count")),
        method_limits: parse_windows(
            header("x-method-rate-limit"),
            header("x-method-rate-limit-count"),
        ),
        retry_after: header("retry-after").and_then(|value| value.trim().parse().ok()),
    })
}

#[cfg(any(target_os = "macos", windows))]
fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, ACCOUNT).map_err(|error| error.to_string())
}

#[cfg(any(target_os = "macos", windows))]
pub(crate) fn read_saved() -> Option<String> {
    entry().ok()?.get_password().ok()
}

#[cfg(not(any(target_os = "macos", windows)))]
pub(crate) fn read_saved() -> Option<String> {
    None
}

#[cfg(any(target_os = "macos", windows))]
fn write_saved(key: &str) -> Result<(), String> {
    entry()?
        .set_password(key)
        .map_err(|error| error.to_string())
}

#[cfg(not(any(target_os = "macos", windows)))]
fn write_saved(_key: &str) -> Result<(), String> {
    Err("Saving a key is not supported on this system.".to_string())
}

#[cfg(any(target_os = "macos", windows))]
fn delete_saved() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

#[cfg(not(any(target_os = "macos", windows)))]
fn delete_saved() -> Result<(), String> {
    Ok(())
}

/// Whether a key is saved, and its masked form. No network.
#[tauri::command]
pub fn riot_key_status() -> KeyStatus {
    let key = read_saved();
    KeyStatus {
        saved: key.is_some(),
        masked: key.as_deref().map(mask),
    }
}

/// Checks a key against Riot: the one typed (`key`), or the saved one when none is given.
#[tauri::command]
pub async fn riot_key_check(key: Option<String>, platform: String) -> Result<KeyCheck, String> {
    let key = key
        .map(|value| value.trim().to_string())
        .or_else(read_saved)
        .ok_or_else(|| "No key to check.".to_string())?;
    check(&key, &platform).await
}

/// Checks a key and, unless Riot refuses it, saves it. A key Riot says is invalid or forbidden is never kept.
#[tauri::command]
pub async fn riot_key_save(key: String, platform: String) -> Result<KeyCheck, String> {
    let key = key.trim().to_string();
    let result = check(&key, &platform).await?;
    if matches!(
        result.state,
        CheckState::Valid | CheckState::RateLimited | CheckState::Offline
    ) {
        write_saved(&key)?;
    }
    Ok(result)
}

/// Forgets the saved key.
#[tauri::command]
pub fn riot_key_clear() -> Result<(), String> {
    delete_saved()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Against the real API: `RIOT_KEY=RGAPI-… cargo test --lib live_key_check -- --ignored --nocapture`.
    #[tokio::test]
    #[ignore = "spends the Riot key"]
    async fn live_key_check() {
        let key = std::env::var("RIOT_KEY").expect("RIOT_KEY");
        let result = check(&key, "br1").await.expect("a check");
        println!("{result:?}");
        assert_eq!(result.state, CheckState::Valid);
        assert!(
            !result.app_limits.is_empty(),
            "no limits read from the headers"
        );
    }

    #[test]
    fn riots_rate_limit_headers_become_windows_with_their_counts() {
        let windows = parse_windows(Some("100:120,20:1"), Some("3:1,41:120"));
        assert_eq!(
            windows,
            vec![
                Window {
                    seconds: 1,
                    limit: 20,
                    used: Some(3)
                },
                Window {
                    seconds: 120,
                    limit: 100,
                    used: Some(41)
                },
            ]
        );
    }

    #[test]
    fn a_missing_or_malformed_header_gives_no_windows() {
        assert!(parse_windows(None, None).is_empty());
        assert!(parse_windows(Some("nonsense"), None).is_empty());
        assert_eq!(parse_windows(Some("20:1"), None)[0].used, None);
    }

    #[test]
    fn a_key_is_masked_to_its_ends() {
        assert_eq!(
            mask("RGAPI-12345678-aaaa-bbbb-cccc-1234567890ab"),
            "RGAPI-1234…90ab"
        );
        assert_eq!(mask("short"), "•••••");
    }

    #[test]
    fn only_a_key_shaped_string_is_sent_to_riot() {
        assert!(looks_like_key("RGAPI-12345678-aaaa-bbbb-cccc-1234567890ab"));
        assert!(!looks_like_key("12345678-aaaa-bbbb-cccc-1234567890ab"));
        assert!(!looks_like_key(
            "RGAPI-1234 5678-aaaa-bbbb-cccc-1234567890ab"
        ));
        assert!(!looks_like_key("RGAPI-x"));
    }

    #[test]
    fn the_status_names_the_state() {
        assert_eq!(state_of(200), CheckState::Valid);
        assert_eq!(state_of(401), CheckState::Invalid);
        assert_eq!(state_of(403), CheckState::Forbidden);
        assert_eq!(state_of(429), CheckState::RateLimited);
        assert_eq!(state_of(503), CheckState::Error);
    }
}
