//! "Check for Updates…" where each platform puts it: in the application menu
//! on macOS, right under "About TrueMain"; in the menu of the tray icon on
//! both, where the app lives while its window is closed (`lib.rs`: closing it
//! hides it, as Blitz's does). Choosing it brings the window forward and asks
//! the webview to check (`useAppUpdate`), which owns the updater and says how
//! the check went.
//!
//! The tray's icon is TrueMain's mark alone, with no tile (`icons/tray.svg`):
//! in the brand's colours in the Windows tray, as Blitz's bolt is there; a
//! template image on macOS, which the menu bar tints for its light or dark
//! look, as every icon there is.
//!
//! On macOS the application menu also opens Settings on ⌘, (`app://navigate`).
//!
//! The texts follow the language the player chose in the app: the webview
//! tells the shell at launch and on every change (`set_menu_language`), which
//! rewrites each item in place. Until it does, they read in English.

use std::sync::Mutex;

use tauri::menu::{Menu, MenuEvent, MenuItem, MenuItemKind, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{include_image, App, AppHandle, Emitter, Manager, Runtime};

const CHECK_FOR_UPDATES: &str = "check-for-updates";
const SHOW: &str = "show";
const QUIT: &str = "quit";
const SETTINGS: &str = "settings";
/// Listened to by `app.vue`: the payload is the route to open.
const NAVIGATE_EVENT: &str = "app://navigate";
/// Listened to by `useAppUpdate` in the webview.
const CHECK_EVENT: &str = "app://check-for-updates";

/// The texts of the menu and the tray, in one language.
struct Labels {
    check_for_updates: &'static str,
    settings: &'static str,
    open: &'static str,
    quit: &'static str,
    tooltip: &'static str,
}

const ENGLISH: Labels = Labels {
    check_for_updates: "Check for Updates…",
    settings: "Settings…",
    open: "Open TrueMain",
    quit: "Quit TrueMain",
    tooltip: "TrueMain",
};

const PORTUGUESE: Labels = Labels {
    check_for_updates: "Verificar atualizações…",
    settings: "Configurações…",
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
    }
    tray(app)?;
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
        // ⌘, opens Settings, where every Mac app keeps it.
        let settings =
            MenuItem::with_id(app, SETTINGS, ENGLISH.settings, true, Some("CmdOrCtrl+,"))?;
        register_text(app, &settings, |labels| labels.settings);
        app_submenu.insert(&PredefinedMenuItem::separator(app)?, 2)?;
        app_submenu.insert(&settings, 3)?;
    }
    app.set_menu(menu)?;
    Ok(())
}

/// A tray icon whose menu opens the window, checks for updates, or quits. On
/// Windows a left click opens the window, the menu on a right click; on macOS
/// a click opens the menu, as the menu bar's icons do.
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
            &PredefinedMenuItem::separator(app)?,
            &quit_item,
        ],
    )?;
    let macos = cfg!(target_os = "macos");
    let icon = if macos {
        include_image!("icons/tray-template.png")
    } else {
        include_image!("icons/tray.png")
    };
    let tray = TrayIconBuilder::with_id("main")
        .icon(icon)
        .icon_as_template(macos)
        .tooltip(ENGLISH.tooltip)
        .menu(&menu)
        .show_menu_on_left_click(macos)
        .on_tray_icon_event(move |tray, event| {
            // On macOS the click opens the menu, whose first item opens the window.
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if !macos {
                    show_window(tray.app_handle());
                }
            }
        })
        .build(app)?;
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

fn on_menu_event<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    match event.id().as_ref() {
        CHECK_FOR_UPDATES => {
            show_window(app);
            if let Err(error) = app.emit(CHECK_EVENT, ()) {
                tracing::warn!(%error, "could not ask the webview to check for updates");
            }
        }
        SETTINGS => {
            show_window(app);
            let _ = app.emit(NAVIGATE_EVENT, "/settings");
        }
        SHOW => show_window(app),
        QUIT => app.exit(0),
        _ => {}
    }
}

pub fn show_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        crate::chrome::set_in_sight(&window, true);
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}
