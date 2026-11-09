//! The main window's chrome, kept in step with the app's theme: the title
//! bar dark or light as the page is (`set_theme`), and on Windows 11 the
//! caption painted the top bar's own colour, so the native bar and the app's
//! read as one surface. Windows 10 ignores the caption colour and keeps the
//! dark or light bar the theme gave it. A Catppuccin theme also recolours the
//! app icon — the Dock's and the taskbar's (`set_app_icon`); the tray keeps
//! its plain glyph (`menu.rs`), as the system's own icons there do.

use tauri::image::Image;
use tauri::{AppHandle, Manager, Theme, WebviewWindow};

/// The top bar's colour (`--ui-bg-elevated`), dark and light.
const DARK_CAPTION: (u8, u8, u8) = (0x13, 0x1a, 0x27);
const LIGHT_CAPTION: (u8, u8, u8) = (0xff, 0xff, 0xff);

/// `caption` is the theme's own top bar colour (`#rrggbb`, a Catppuccin
/// flavour's); without one, TrueMain's dark or light.
#[tauri::command]
pub fn set_window_theme(window: WebviewWindow, dark: bool, caption: Option<String>) {
    let _ = window.set_theme(Some(if dark { Theme::Dark } else { Theme::Light }));
    let colour = caption.as_deref().and_then(parse_hex);
    paint_caption(
        &window,
        colour.unwrap_or(if dark { DARK_CAPTION } else { LIGHT_CAPTION }),
    );
}

/// `#rrggbb` as its three channels; None for anything else.
fn parse_hex(text: &str) -> Option<(u8, u8, u8)> {
    let hex = text.strip_prefix('#')?;
    if hex.len() != 6 || !hex.bytes().all(|b| b.is_ascii_hexdigit()) {
        return None;
    }
    let channel = |at: usize| u8::from_str_radix(&hex[at..at + 2], 16).ok();
    Some((channel(0)?, channel(2)?, channel(4)?))
}

/// The app icon in the theme's colours (`useAppTheme`): `png` for the Dock on
/// macOS, `rgba` (`size` by `size` pixels) for the window and the taskbar.
/// Neither puts the bundle's own icon back (TrueMain's theme). The Dock's
/// holds while the app runs: Finder keeps the bundle's.
#[tauri::command]
pub fn set_app_icon(
    app: AppHandle,
    png: Option<Vec<u8>>,
    rgba: Option<Vec<u8>>,
    size: u32,
) -> Result<(), String> {
    let icon = match rgba {
        Some(pixels) => {
            if pixels.len() != (size as usize) * (size as usize) * 4 {
                return Err("the icon's pixels do not fill its size".to_string());
            }
            Some(Image::new_owned(pixels, size, size))
        }
        None => app.default_window_icon().cloned(),
    };
    if let Some(icon) = icon {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.set_icon(icon);
        }
    }
    #[cfg(target_os = "macos")]
    app.run_on_main_thread(move || dock_icon(png.as_deref()))
        .map_err(|error| error.to_string())?;
    #[cfg(not(target_os = "macos"))]
    let _ = png;
    Ok(())
}

/// The Dock's icon: `png` decoded by AppKit, or the bundle's own when None.
#[cfg(target_os = "macos")]
fn dock_icon(png: Option<&[u8]>) {
    use objc2::{AnyThread, MainThreadMarker};
    use objc2_app_kit::{NSApplication, NSImage};
    use objc2_foundation::NSData;

    let Some(mtm) = MainThreadMarker::new() else {
        return;
    };
    let image =
        png.and_then(|bytes| NSImage::initWithData(NSImage::alloc(), &NSData::with_bytes(bytes)));
    // SAFETY: on the main thread (`mtm`); a nil image is AppKit's own way back to the bundle's icon.
    unsafe { NSApplication::sharedApplication(mtm).setApplicationIconImage(image.as_deref()) };
}

#[cfg(windows)]
fn paint_caption(window: &WebviewWindow, (r, g, b): (u8, u8, u8)) {
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
fn paint_caption(_window: &WebviewWindow, _colour: (u8, u8, u8)) {}

/// Bring the calling window to the front: out of the dock or the taskbar,
/// shown, focused — what champion select does when the player keeps the
/// setting on (`useAutoImport`'s `focus`), as Blitz's auto pop-up does.
#[tauri::command]
pub fn focus_window(window: WebviewWindow) -> Result<(), String> {
    window.unminimize().map_err(|error| error.to_string())?;
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}
