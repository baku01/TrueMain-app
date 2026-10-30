//! Hardware acceleration: whether the app's webviews draw with the GPU.
//!
//! On Windows, WebView2 takes Chromium switches, and `--disable-gpu
//! --disable-gpu-compositing` makes it draw in software. They must be known
//! before the first webview exists, and the main window is created from the
//! config before `setup` runs — so the setting is read at the very start of
//! `run()`, from the app's config folder, and handed to WebView2 through
//! `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`. The variable is process-wide, so the
//! overlay's windows, created later, start with the same switches: WebView2
//! refuses a second webview on one data folder with different ones. A change
//! applies on the next launch.
//!
//! WKWebView (macOS) has no switch for it: it always composites with the GPU.
//! There, as on Windows, turning acceleration off also turns off the GPU-heavy
//! effects (blurs, endless animations) — the frontend's part, applied at once.

use std::{
    path::{Path, PathBuf},
    sync::Mutex,
};

use serde::{Deserialize, Serialize};
use tauri::State;

const SETTINGS_FILE: &str = "graphics.json";

/// wry's own WebView2 switches. The environment variable replaces the ones the
/// app would pass, so they are restated next to ours.
#[cfg(windows)]
const WRY_DEFAULT_ARGS: &str =
    "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection";
#[cfg(windows)]
const SOFTWARE_ARGS: &str = "--disable-gpu --disable-gpu-compositing";
#[cfg(windows)]
const WEBVIEW2_ARGS_VAR: &str = "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Settings {
    #[serde(default = "on")]
    hardware_acceleration: bool,
}

fn on() -> bool {
    true
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            hardware_acceleration: true,
        }
    }
}

/// What the settings page shows.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GraphicsView {
    /// The saved choice.
    pub hardware_acceleration: bool,
    /// Whether this platform's webview can actually be told to draw without the GPU (Windows).
    pub gpu_switchable: bool,
    /// The saved choice differs from the one the webviews started with: it applies after a restart.
    pub restart_required: bool,
}

pub struct Graphics {
    path: PathBuf,
    settings: Mutex<Settings>,
    /// What the webviews of this run started with.
    started_with: bool,
}

impl Graphics {
    /// Reads the setting and, on Windows, sets WebView2's switches. Call before the app is built.
    pub fn load_before_webviews(identifier: &str) -> Self {
        let path = dirs::config_dir()
            .unwrap_or_else(|| std::env::temp_dir().join("truemain"))
            .join(identifier)
            .join(SETTINGS_FILE);
        let settings = load(&path).unwrap_or_default();
        #[cfg(windows)]
        if !settings.hardware_acceleration {
            let args = match std::env::var(WEBVIEW2_ARGS_VAR) {
                Ok(existing) if !existing.trim().is_empty() => {
                    format!("{existing} {SOFTWARE_ARGS}")
                }
                _ => format!("{WRY_DEFAULT_ARGS} {SOFTWARE_ARGS}"),
            };
            // Nothing else runs yet: the app is not built, no thread reads the environment.
            std::env::set_var(WEBVIEW2_ARGS_VAR, args);
        }
        tracing::info!(
            hardware_acceleration = settings.hardware_acceleration,
            "graphics settings"
        );
        Self {
            path,
            started_with: settings.hardware_acceleration,
            settings: Mutex::new(settings),
        }
    }

    fn view(&self) -> GraphicsView {
        let saved = self
            .settings
            .lock()
            .expect("graphics settings poisoned")
            .hardware_acceleration;
        GraphicsView {
            hardware_acceleration: saved,
            gpu_switchable: cfg!(windows),
            restart_required: cfg!(windows) && saved != self.started_with,
        }
    }

    fn set(&self, hardware_acceleration: bool) -> Result<GraphicsView, String> {
        let settings = Settings {
            hardware_acceleration,
        };
        save(&self.path, &settings).map_err(|error| error.to_string())?;
        *self.settings.lock().expect("graphics settings poisoned") = settings;
        Ok(self.view())
    }
}

fn load(path: &Path) -> Option<Settings> {
    serde_json::from_str(&std::fs::read_to_string(path).ok()?).ok()
}

fn save(path: &Path, settings: &Settings) -> std::io::Result<()> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    let text = serde_json::to_string_pretty(settings).map_err(std::io::Error::other)?;
    std::fs::write(path, text)
}

#[tauri::command]
pub fn graphics_settings(graphics: State<'_, Graphics>) -> GraphicsView {
    graphics.view()
}

#[tauri::command]
pub fn set_graphics_settings(
    graphics: State<'_, Graphics>,
    hardware_acceleration: bool,
) -> Result<GraphicsView, String> {
    graphics.set(hardware_acceleration)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn acceleration_is_on_unless_saved_off() {
        assert!(Settings::default().hardware_acceleration);
        let parsed: Settings = serde_json::from_str("{}").unwrap();
        assert!(parsed.hardware_acceleration);
        let parsed: Settings = serde_json::from_str(r#"{"hardwareAcceleration":false}"#).unwrap();
        assert!(!parsed.hardware_acceleration);
    }

    #[test]
    fn a_saved_choice_is_read_back_and_a_change_waits_for_a_restart_on_windows() {
        let path = std::env::temp_dir()
            .join(format!("truemain-graphics-{}", std::process::id()))
            .join(SETTINGS_FILE);
        let graphics = Graphics {
            path: path.clone(),
            settings: Mutex::new(Settings::default()),
            started_with: true,
        };
        let view = graphics.set(false).unwrap();
        assert!(!view.hardware_acceleration);
        assert_eq!(view.restart_required, cfg!(windows));
        assert_eq!(load(&path), Some(Settings { hardware_acceleration: false }));
        assert!(!graphics.set(true).unwrap().restart_required);
        let _ = std::fs::remove_dir_all(path.parent().unwrap());
    }
}
