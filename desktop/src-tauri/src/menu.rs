//! "Check for Updates…" where each platform puts it: in the application menu
//! on macOS, right under "About TrueMain"; in the menu of a tray icon on
//! Windows, where the window has no menu bar to carry it. Choosing it brings
//! the window forward and asks the webview to check (`useAppUpdate`), which
//! owns the updater and says how the check went.
//!
//! Next to it, "Share Anonymous Usage Data" (#1805), checked by default: the
//! switch for the usage counts `telemetry.rs` sends, kept across launches.
//!
//! The texts follow the language the player chose in the app: the webview
//! tells the shell at launch and on every change (`set_menu_language`), which
//! rewrites each item in place. Until it does, they read in English.

use std::sync::Mutex;

use tauri::menu::{CheckMenuItem, Menu, MenuEvent, MenuItem, MenuItemKind, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{App, AppHandle, Emitter, Manager, Runtime};

use crate::telemetry::SharedTelemetry;

const CHECK_FOR_UPDATES: &str = "check-for-updates";
const SHOW: &str = "show";
const QUIT: &str = "quit";
const SHARE_USAGE: &str = "share-usage";
/// Listened to by `useAppUpdate` in the webview.
const CHECK_EVENT: &str = "app://check-for-updates";

/// The texts of the menu and the tray, in one language.
struct Labels {
    check_for_updates: &'static str,
    share_usage: &'static str,
    open: &'static str,
    quit: &'static str,
    tooltip: &'static str,
}

const ENGLISH: Labels = Labels {
    check_for_updates: "Check for Updates…",
    share_usage: "Share Anonymous Usage Data",
    open: "Open TrueMain",
    quit: "Quit TrueMain",
    tooltip: "TrueMain",
};

const PORTUGUESE: Labels = Labels {
    check_for_updates: "Verificar atualizações…",
    share_usage: "Compartilhar dados de uso anônimos",
    open: "Abrir o TrueMain",
    quit: "Sair do TrueMain",
    tooltip: "TrueMain",
};

/// The texts for a language code of the app (`en`, `pt-BR`); anything else reads in English.
fn labels(language: &str) -> &'static Labels {
    if language.eq_ignore_ascii_case("pt-br") {
        &PORTUGUESE
    } else {
        &ENGLISH
    }
}

type Relabel = Box<dyn Fn(&Labels) + Send + Sync>;

/// What rewrites the texts of the items built at startup, kept as state for `set_menu_language`.
#[derive(Default)]
pub struct MenuTexts(Mutex<Vec<Relabel>>);

impl MenuTexts {
    fn register(&self, relabel: impl Fn(&Labels) + Send + Sync + 'static) {
        self.0
            .lock()
            .expect("menu texts mutex poisoned")
            .push(Box::new(relabel));
    }
}

/// The player's language, from the webview: the menu and the tray follow it.
#[tauri::command]
pub fn set_menu_language(texts: tauri::State<'_, MenuTexts>, language: String) {
    let labels = labels(&language);
    for relabel in texts.0.lock().expect("menu texts mutex poisoned").iter() {
        relabel(labels);
    }
}

pub fn install<R: Runtime>(app: &App<R>) -> tauri::Result<()> {
    app.manage(MenuTexts::default());
    // Runtime checks rather than `#[cfg]`, so both paths compile, and are
    // checked, on whichever platform builds.
    if cfg!(target_os = "macos") {
        app_menu(app)?;
    } else if cfg!(windows) {
        tray(app)?;
    }
    app.on_menu_event(on_menu_event);
    Ok(())
}

/// The default macOS menu (app, edit, view, window — copy and paste need it),
/// with the item inserted under "About TrueMain", where macOS apps keep it.
fn app_menu<R: Runtime>(app: &App<R>) -> tauri::Result<()> {
    let menu = Menu::default(app.handle())?;
    if let Some(MenuItemKind::Submenu(app_submenu)) = menu.items()?.into_iter().next() {
        let check = check_for_updates(app)?;
        app_submenu.insert(&check, 1)?;
        app_submenu.insert(&share_usage(app)?, 2)?;
    }
    app.set_menu(menu)?;
    Ok(())
}

/// A tray icon whose menu opens the window, checks for updates, or quits;
/// a left click opens the window.
fn tray<R: Runtime>(app: &App<R>) -> tauri::Result<()> {
    let open_item = MenuItem::with_id(app, SHOW, ENGLISH.open, true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, QUIT, ENGLISH.quit, true, None::<&str>)?;
    register_text(app, &open_item, |labels| labels.open);
    register_text(app, &quit_item, |labels| labels.quit);
    let menu = Menu::with_items(
        app,
        &[
            &open_item,
            &check_for_updates(app)?,
            &share_usage(app)?,
            &PredefinedMenuItem::separator(app)?,
            &quit_item,
        ],
    )?;
    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip(ENGLISH.tooltip)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_window(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    let tray = tray.build(app)?;
    if let Some(texts) = app.try_state::<MenuTexts>() {
        texts.register(move |labels| {
            let _ = tray.set_tooltip(Some(labels.tooltip));
        });
    }
    Ok(())
}

/// Rewrites `item`'s text with `pick` from the language's labels, whenever the language changes.
fn register_text<R: Runtime>(app: &App<R>, item: &MenuItem<R>, pick: fn(&Labels) -> &'static str) {
    if let Some(texts) = app.try_state::<MenuTexts>() {
        let item = item.clone();
        texts.register(move |labels| {
            let _ = item.set_text(pick(labels));
        });
    }
}

fn check_for_updates<R: Runtime>(app: &App<R>) -> tauri::Result<MenuItem<R>> {
    let item = MenuItem::with_id(
        app,
        CHECK_FOR_UPDATES,
        ENGLISH.check_for_updates,
        true,
        None::<&str>,
    )?;
    register_text(app, &item, |labels| labels.check_for_updates);
    Ok(item)
}

/// Checked when the counts are sent. A click toggles the item's own check
/// mark, and the menu event flips the setting to match.
fn share_usage<R: Runtime>(app: &App<R>) -> tauri::Result<CheckMenuItem<R>> {
    let on = app
        .try_state::<SharedTelemetry>()
        .is_some_and(|telemetry| telemetry.enabled());
    let item = CheckMenuItem::with_id(
        app,
        SHARE_USAGE,
        ENGLISH.share_usage,
        true,
        on,
        None::<&str>,
    )?;
    if let Some(texts) = app.try_state::<MenuTexts>() {
        let item = item.clone();
        texts.register(move |labels| {
            let _ = item.set_text(labels.share_usage);
        });
    }
    Ok(item)
}

fn on_menu_event<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    match event.id().as_ref() {
        CHECK_FOR_UPDATES => {
            show_window(app);
            if let Err(error) = app.emit(CHECK_EVENT, ()) {
                tracing::warn!(%error, "could not ask the webview to check for updates");
            }
        }
        SHARE_USAGE => {
            if let Some(telemetry) = app.try_state::<SharedTelemetry>() {
                telemetry.set_enabled(!telemetry.enabled());
            }
        }
        SHOW => show_window(app),
        QUIT => app.exit(0),
        _ => {}
    }
}

fn show_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}
