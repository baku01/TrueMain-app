//! Jev (TypeSafe's System One model), asked by the Jev matchup page for its
//! build and rune picks: the request goes out from here, with the player's API
//! key, so the key never reaches the webview once saved. It is kept in the
//! app's config folder, readable by the user alone, and the frontend only ever
//! learns whether one is set and its last four characters.

use std::path::PathBuf;
use std::sync::LazyLock;
use std::time::Duration;

use serde::Serialize;

const KEY_FILE: &str = "jev-key";
const ENDPOINT: &str = "https://api.typesafe.ai/v1/systemone";
/// A draft's questions answer in well under a second; a stalled call must not hold the page.
const TIMEOUT: Duration = Duration::from_secs(15);

static CLIENT: LazyLock<Result<reqwest::Client, String>> = LazyLock::new(|| {
    reqwest::Client::builder()
        .timeout(TIMEOUT)
        .user_agent(concat!("TrueMain-Desktop/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|error| error.to_string())
});

fn key_path(identifier: &str) -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| std::env::temp_dir().join("truemain"))
        .join(identifier)
        .join(KEY_FILE)
}

fn read_key(identifier: &str) -> Option<String> {
    std::fs::read_to_string(key_path(identifier))
        .ok()
        .map(|key| key.trim().to_string())
        .filter(|key| !key.is_empty())
}

/// Whether a key is saved, and its last four characters to recognise it by.
#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct KeyStatus {
    pub set: bool,
    pub hint: Option<String>,
}

fn status_of(key: Option<&str>) -> KeyStatus {
    KeyStatus {
        set: key.is_some(),
        hint: key.map(|key| {
            let tail: String = key.chars().rev().take(4).collect();
            tail.chars().rev().collect()
        }),
    }
}

#[tauri::command]
pub fn jev_key_status(app: tauri::AppHandle) -> KeyStatus {
    status_of(read_key(&app.config().identifier).as_deref())
}

/// Save the key, or forget it with `None` or an empty one.
#[tauri::command]
pub fn jev_set_key(app: tauri::AppHandle, key: Option<String>) -> Result<KeyStatus, String> {
    let path = key_path(&app.config().identifier);
    let key = key
        .map(|key| key.trim().to_string())
        .filter(|key| !key.is_empty());
    match &key {
        None => {
            if path.exists() {
                std::fs::remove_file(&path).map_err(|error| error.to_string())?;
            }
        }
        Some(key) => {
            if let Some(folder) = path.parent() {
                std::fs::create_dir_all(folder).map_err(|error| error.to_string())?;
            }
            std::fs::write(&path, key).map_err(|error| error.to_string())?;
            restrict(&path)?;
        }
    }
    Ok(status_of(key.as_deref()))
}

/// The key's file readable and writable by its owner alone.
#[cfg(unix)]
fn restrict(path: &std::path::Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))
        .map_err(|error| error.to_string())
}

#[cfg(not(unix))]
fn restrict(_path: &std::path::Path) -> Result<(), String> {
    Ok(())
}

/// One System One call: `body` is the request as TypeSafe documents it
/// (`model`, `state`, `questions`), the answer handed back as it came.
#[tauri::command]
pub async fn jev_system_one(
    app: tauri::AppHandle,
    body: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let key = read_key(&app.config().identifier).ok_or("no Jev API key is set")?;
    let response = CLIENT
        .clone()?
        .post(ENDPOINT)
        .bearer_auth(key)
        .json(&body)
        .send()
        .await
        .map_err(|error| format!("Jev unreachable: {error}"))?;
    let status = response.status();
    let text = response.text().await.map_err(|error| error.to_string())?;
    if !status.is_success() {
        return Err(format!("Jev answered {status}: {text}"));
    }
    serde_json::from_str(&text).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_status_shows_the_last_four_characters_only() {
        assert_eq!(
            status_of(Some("ts-secret-1234")),
            KeyStatus {
                set: true,
                hint: Some("1234".into())
            }
        );
        assert_eq!(
            status_of(None),
            KeyStatus {
                set: false,
                hint: None
            }
        );
    }
}
