//! Accepting a found match for the player, as Blitz did: off until the player
//! turns it on in the settings. When the phase turns to `ReadyCheck` the
//! match is accepted after a short wait — the player's time to answer the
//! client first, or to decline — and only if it is still open and unanswered
//! (`lcu::model::ReadyCheck::awaits_answer`): a match the player declined, or
//! that the others already settled, is left alone. Live sessions only: a tape
//! or the simulator has no match to accept.

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use lcu::LcuClient;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

const SETTINGS_FILE: &str = "ready-check.json";

/// The longest wait before accepting: the client gives the players about ten
/// seconds, and the accept must land inside them.
pub const MAX_DELAY_SECONDS: u8 = 8;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ReadyCheckSettings {
    /// Accept a found match without the player's click.
    pub auto_accept: bool,
    /// Seconds to wait first, 0 to `MAX_DELAY_SECONDS`.
    pub delay_seconds: u8,
}

impl Default for ReadyCheckSettings {
    fn default() -> Self {
        Self {
            auto_accept: false,
            delay_seconds: 3,
        }
    }
}

pub struct ReadyCheck {
    path: PathBuf,
    settings: Mutex<ReadyCheckSettings>,
}

impl ReadyCheck {
    pub fn load(app: &AppHandle) -> Self {
        let path = app
            .path()
            .app_config_dir()
            .unwrap_or_else(|_| std::env::temp_dir().join("truemain"))
            .join(SETTINGS_FILE);
        let settings = load(&path).unwrap_or_default();
        Self {
            path,
            settings: Mutex::new(settings),
        }
    }

    fn settings(&self) -> ReadyCheckSettings {
        *self.settings.lock().expect("ready check settings poisoned")
    }

    fn set(&self, settings: ReadyCheckSettings) -> Result<ReadyCheckSettings, String> {
        let settings = ReadyCheckSettings {
            delay_seconds: settings.delay_seconds.min(MAX_DELAY_SECONDS),
            ..settings
        };
        save(&self.path, &settings).map_err(|error| error.to_string())?;
        *self.settings.lock().expect("ready check settings poisoned") = settings;
        Ok(settings)
    }
}

fn load(path: &Path) -> Option<ReadyCheckSettings> {
    serde_json::from_str(&std::fs::read_to_string(path).ok()?).ok()
}

fn save(path: &Path, settings: &ReadyCheckSettings) -> std::io::Result<()> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    let text = serde_json::to_string_pretty(settings).map_err(std::io::Error::other)?;
    std::fs::write(path, text)
}

#[tauri::command]
pub fn ready_check_settings(ready_check: State<'_, ReadyCheck>) -> ReadyCheckSettings {
    ready_check.settings()
}

#[tauri::command]
pub fn set_ready_check_settings(
    ready_check: State<'_, ReadyCheck>,
    auto_accept: bool,
    delay_seconds: u8,
) -> Result<ReadyCheckSettings, String> {
    ready_check.set(ReadyCheckSettings {
        auto_accept,
        delay_seconds,
    })
}

/// A match was found: accept it after the player's wait, if the player still
/// wants that and the match still waits for their answer.
pub async fn follow(app: AppHandle, client: Arc<LcuClient>) {
    let settings = app.state::<ReadyCheck>().settings();
    if !settings.auto_accept {
        return;
    }
    tokio::time::sleep(Duration::from_secs(settings.delay_seconds.into())).await;
    // Read again: the player may have turned it off during the wait.
    if !app.state::<ReadyCheck>().settings().auto_accept {
        return;
    }
    match client.ready_check().await {
        Ok(Some(check)) if check.awaits_answer() => match client.accept_ready_check().await {
            Ok(()) => tracing::info!("accepted the match found"),
            Err(error) => tracing::warn!(%error, "could not accept the match found"),
        },
        Ok(_) => tracing::info!("the match found was answered or settled before the wait ran out"),
        Err(error) => tracing::warn!(%error, "could not read the match found"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn auto_accept_is_off_until_turned_on_and_waits_three_seconds() {
        assert_eq!(
            ReadyCheckSettings::default(),
            ReadyCheckSettings {
                auto_accept: false,
                delay_seconds: 3
            }
        );
        let parsed: ReadyCheckSettings = serde_json::from_str(r#"{"autoAccept":true}"#).unwrap();
        assert!(parsed.auto_accept);
        assert_eq!(parsed.delay_seconds, 3);
    }

    #[test]
    fn the_wait_is_kept_inside_the_clients_answer_window() {
        let dir = std::env::temp_dir().join(format!("ready-check-{}", std::process::id()));
        let check = ReadyCheck {
            path: dir.join(SETTINGS_FILE),
            settings: Mutex::new(ReadyCheckSettings::default()),
        };
        let saved = check
            .set(ReadyCheckSettings {
                auto_accept: true,
                delay_seconds: 30,
            })
            .unwrap();
        assert_eq!(saved.delay_seconds, MAX_DELAY_SECONDS);
        assert_eq!(load(&dir.join(SETTINGS_FILE)), Some(saved));
        let _ = std::fs::remove_dir_all(dir);
    }
}
