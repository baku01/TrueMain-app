//! The main window's chrome, kept in step with the app's theme: the title
//! bar dark or light as the page is (`set_theme`), and on Windows 11 the
//! caption painted the top bar's own colour, so the native bar and the app's
//! read as one surface. Windows 10 ignores the caption colour and keeps the
//! dark or light bar the theme gave it.

use tauri::{Theme, WebviewWindow};

/// The top bar's colour (`--ui-bg-elevated`), dark and light.
const DARK_CAPTION: (u8, u8, u8) = (0x13, 0x1a, 0x27);
const LIGHT_CAPTION: (u8, u8, u8) = (0xff, 0xff, 0xff);

#[tauri::command]
pub fn set_window_theme(window: WebviewWindow, dark: bool) {
    let _ = window.set_theme(Some(if dark { Theme::Dark } else { Theme::Light }));
    caption(&window, if dark { DARK_CAPTION } else { LIGHT_CAPTION });
}

#[cfg(windows)]
fn caption(window: &WebviewWindow, (r, g, b): (u8, u8, u8)) {
    use windows::Win32::Foundation::COLORREF;
    use windows::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWA_CAPTION_COLOR};
    let Ok(hwnd) = window.hwnd() else {
        return;
    };
    // COLORREF is 0x00BBGGRR.
    let colour = COLORREF(u32::from(r) | (u32::from(g) << 8) | (u32::from(b) << 16));
    unsafe {
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_CAPTION_COLOR,
            &colour as *const COLORREF as *const core::ffi::c_void,
            std::mem::size_of::<COLORREF>() as u32,
        );
    }
}

#[cfg(not(windows))]
fn caption(_window: &WebviewWindow, _colour: (u8, u8, u8)) {}
