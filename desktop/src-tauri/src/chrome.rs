//! The main window's chrome, kept in step with the app's theme: the title
//! bar dark or light as the page is (`set_theme`), and on Windows 11 the
//! caption painted the top bar's own colour, so the native bar and the app's
//! read as one surface. Windows 10 ignores the caption colour and keeps the
//! dark or light bar the theme gave it. A Catppuccin theme also recolours the
//! app icon — the Dock's and the taskbar's (`set_app_icon`); the tray keeps
//! its own tile-less mark (`menu.rs`).

use tauri::image::Image;
use tauri::{AppHandle, Manager, Runtime, Theme, WebviewWindow};

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
    set_in_sight(&window, true);
    window.unminimize().map_err(|error| error.to_string())?;
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

/// Whether a window's page is in sight, told to WebView2 (Windows). Hiding the
/// window — into the tray, for a whole game — hides only the native window:
/// WebView2, told nothing, keeps drawing the page at full rate, its animations
/// and timers with it ("WebView2 as a child window does not get window
/// messages when the top window is minimized… set the IsVisible property to
/// FALSE", Microsoft's WebView2 performance guide). Out of sight it draws
/// nothing, slows its timers and lowers its memory target; Tauri's events from
/// Rust still arrive at once. Told in sight again before the window shows, so
/// the page paints before it appears. Our own webview only: nothing of the
/// game's is touched. Elsewhere nothing to do: WKWebView follows its window
/// (`backgroundThrottling`, `tauri.macos.conf.json`).
#[cfg(windows)]
pub fn set_in_sight<R: Runtime>(window: &WebviewWindow<R>, in_sight: bool) {
    let _ = window.with_webview(move |webview| {
        use webview2_com::Microsoft::Web::WebView2::Win32::{
            ICoreWebView2_19, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW,
            COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL,
        };
        use windows::core::Interface;
        let controller = webview.controller();
        // SAFETY: COM calls on the controller wry made for this webview, on the
        // main thread `with_webview` runs its closure on.
        unsafe {
            let _ = controller.SetIsVisible(in_sight);
            // WebView2 1.0.1823 and later: an older runtime keeps its target.
            if let Ok(core) = controller
                .CoreWebView2()
                .and_then(|core| core.cast::<ICoreWebView2_19>())
            {
                let _ = core.SetMemoryUsageTargetLevel(if in_sight {
                    COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL
                } else {
                    COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW
                });
            }
        }
    });
}

#[cfg(not(windows))]
pub fn set_in_sight<R: Runtime>(_window: &WebviewWindow<R>, _in_sight: bool) {}
