//! Starting with the computer, as Blitz offers it: off until the player turns
//! it on in the settings. The system then launches the app at login with
//! `AUTOSTART_ARG`, and the app stays in the tray (the menu bar on macOS), its
//! window hidden until the player opens it — from there it follows the client
//! as ever: the overlay over the game, a found match accepted, champion select
//! brought forward. The choice is the system's own record (a Launch Agent on
//! macOS, the `Run` key on Windows), read and written through
//! `tauri-plugin-autostart`: nothing of ours to keep in step with it.

use tauri::AppHandle;
use tauri_plugin_autostart::ManagerExt;

/// What the system passes the app when it starts it at login.
pub const AUTOSTART_ARG: &str = "--autostart";

/// Whether this launch is the system's, at login: the window stays hidden.
pub fn launched_at_login() -> bool {
    std::env::args().any(|arg| arg == AUTOSTART_ARG)
}

/// Whether the system starts the app at login.
#[tauri::command]
pub fn autostart_enabled(app: AppHandle) -> Result<bool, String> {
    app.autolaunch()
        .is_enabled()
        .map_err(|error| error.to_string())
}

/// Start the app at login, or stop; what the system then holds.
#[tauri::command]
pub fn set_autostart(app: AppHandle, enabled: bool) -> Result<bool, String> {
    let manager = app.autolaunch();
    let changed = if enabled {
        manager.enable()
    } else {
        manager.disable()
    };
    changed.map_err(|error| error.to_string())?;
    manager.is_enabled().map_err(|error| error.to_string())
}
