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
//! On macOS the menu bar is TrueMain's own, as a Mac app's is: the
//! application menu (About — with the version, the build and whether the
//! binary is Apple Silicon or Intel —, Check for Updates…, Settings… on ⌘,,
//! Services, Hide, Quit), Edit, Go (the app's pages on ⌘1…⌘9, the live ones
//! on ⇧⌘, Back and Forward on ⌘[ and ⌘]), Window and Help. A page is opened
//! through `app://navigate`, history through `app://history`.
//!
//! The texts follow the language the player chose in the app: the webview
//! tells the shell at launch and on every change (`set_menu_language`), which
//! rewrites each item in place. Until it does, they read in English.

use std::sync::Mutex;

use tauri::menu::{AboutMetadata, Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu};
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
/// Listened to by `plugins/native.client.ts`: `back` or `forward`.
const HISTORY_EVENT: &str = "app://history";
/// A Go menu item's id: this prefix, then the route it opens.
const GO: &str = "go:";
const BACK: &str = "back";
const FORWARD: &str = "forward";
const WEBSITE: &str = "website";

/// The Go menu: each page, its accelerator, and the label it takes.
const PAGES: [(&str, Option<&str>, fn(&Labels) -> &'static str); 14] = [
    ("/", Some("CmdOrCtrl+1"), |l| l.dashboard),
    ("/champions", Some("CmdOrCtrl+2"), |l| l.champions),
    ("/tierlist", Some("CmdOrCtrl+3"), |l| l.tierlist),
    ("/analytics", Some("CmdOrCtrl+4"), |l| l.analytics),
    ("/matchup", Some("CmdOrCtrl+5"), |l| l.matchup),
    ("/jev", Some("CmdOrCtrl+6"), |l| l.jev),
    ("/probuild", Some("CmdOrCtrl+7"), |l| l.probuild),
    ("/items", Some("CmdOrCtrl+8"), |l| l.items),
    ("/patchnotes", Some("CmdOrCtrl+9"), |l| l.patchnotes),
    ("/draft", Some("CmdOrCtrl+Shift+D"), |l| l.champ_select),
    ("/game", Some("CmdOrCtrl+Shift+G"), |l| l.game),
    ("/overlay", Some("CmdOrCtrl+Shift+O"), |l| l.overlay),
    ("/favorites", None, |l| l.favorites),
    ("/kits", None, |l| l.kits),
];
/// Where the Go menu draws a line: after the pages to read, and after the live ones.
const PAGE_BREAKS: [usize; 2] = [9, 12];

/// The texts of the menu and the tray, in one language.
struct Labels {
    check_for_updates: &'static str,
    settings: &'static str,
    open: &'static str,
    quit: &'static str,
    tooltip: &'static str,
    about: &'static str,
    services: &'static str,
    hide: &'static str,
    hide_others: &'static str,
    show_all: &'static str,
    edit: &'static str,
    undo: &'static str,
    redo: &'static str,
    cut: &'static str,
    copy: &'static str,
    paste: &'static str,
    select_all: &'static str,
    go: &'static str,
    back: &'static str,
    forward: &'static str,
    window: &'static str,
    minimize: &'static str,
    zoom: &'static str,
    fullscreen: &'static str,
    close: &'static str,
    help: &'static str,
    website: &'static str,
    dashboard: &'static str,
    champions: &'static str,
    tierlist: &'static str,
    analytics: &'static str,
    matchup: &'static str,
    jev: &'static str,
    probuild: &'static str,
    items: &'static str,
    patchnotes: &'static str,
    champ_select: &'static str,
    game: &'static str,
    overlay: &'static str,
    favorites: &'static str,
    kits: &'static str,
}

const ENGLISH: Labels = Labels {
    check_for_updates: "Check for Updates…",
    settings: "Settings…",
    open: "Open TrueMain",
    quit: "Quit TrueMain",
    tooltip: "TrueMain",
    about: "About TrueMain",
    services: "Services",
    hide: "Hide TrueMain",
    hide_others: "Hide Others",
    show_all: "Show All",
    edit: "Edit",
    undo: "Undo",
    redo: "Redo",
    cut: "Cut",
    copy: "Copy",
    paste: "Paste",
    select_all: "Select All",
    go: "Go",
    back: "Back",
    forward: "Forward",
    window: "Window",
    minimize: "Minimize",
    zoom: "Zoom",
    fullscreen: "Enter Full Screen",
    close: "Close Window",
    help: "Help",
    website: "TrueMain Website",
    dashboard: "Dashboard",
    champions: "Champions",
    tierlist: "Tier List",
    analytics: "Analytics",
    matchup: "Matchup",
    jev: "Matchup · Jev",
    probuild: "ProBuild",
    items: "Items & Runes",
    patchnotes: "Patch Notes",
    champ_select: "Champ Select",
    game: "Game",
    overlay: "Overlay",
    favorites: "Favorites",
    kits: "My Kits",
};

const PORTUGUESE: Labels = Labels {
    check_for_updates: "Verificar atualizações…",
    settings: "Configurações…",
    open: "Abrir o TrueMain",
    quit: "Sair do TrueMain",
    tooltip: "TrueMain",
    about: "Sobre o TrueMain",
    services: "Serviços",
    hide: "Ocultar o TrueMain",
    hide_others: "Ocultar outros",
    show_all: "Mostrar tudo",
    edit: "Editar",
    undo: "Desfazer",
    redo: "Refazer",
    cut: "Recortar",
    copy: "Copiar",
    paste: "Colar",
    select_all: "Selecionar tudo",
    go: "Ir",
    back: "Voltar",
    forward: "Avançar",
    window: "Janela",
    minimize: "Minimizar",
    zoom: "Zoom",
    fullscreen: "Entrar em tela cheia",
    close: "Fechar janela",
    help: "Ajuda",
    website: "Site do TrueMain",
    dashboard: "Painel",
    champions: "Campeões",
    tierlist: "Tier list",
    analytics: "Analytics",
    matchup: "Confronto",
    jev: "Confronto · Jev",
    probuild: "ProBuild",
    items: "Itens e runas",
    patchnotes: "Notas da atualização",
    champ_select: "Seleção de campeões",
    game: "Partida",
    overlay: "Overlay",
    favorites: "Favoritos",
    kits: "Meus kits",
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

/// What the binary is: Apple Silicon or Intel, as it was compiled.
fn architecture() -> &'static str {
    if cfg!(target_arch = "aarch64") {
        "Apple Silicon (arm64)"
    } else {
        "Intel (x86_64)"
    }
}

/// The About panel's lines under the version: the binary's architecture and
/// the commit it was built from (`GITHUB_SHA`, which CI sets while it compiles).
fn build_credits() -> String {
    let commit = option_env!("GITHUB_SHA").map_or("local", |sha| &sha[..sha.len().min(8)]);
    format!("{}\nBuild {commit}", architecture())
}

/// TrueMain's own menu bar on macOS, laid out as a Mac app's: the
/// application menu, Edit (copy and paste need it), Go, Window and Help.
fn app_menu<R: Runtime>(app: &App<R>) -> tauri::Result<()> {
    let l = &ENGLISH;
    let version = app.package_info().version.to_string();
    let about = PredefinedMenuItem::about(
        app,
        Some(l.about),
        Some(AboutMetadata {
            name: Some("TrueMain".into()),
            version: Some(version),
            credits: Some(build_credits()),
            ..Default::default()
        }),
    )?;
    let settings = MenuItem::with_id(app, SETTINGS, l.settings, true, Some("CmdOrCtrl+,"))?;
    register_text(app, &settings, |labels| labels.settings);
    let services = PredefinedMenuItem::services(app, Some(l.services))?;
    let hide = PredefinedMenuItem::hide(app, Some(l.hide))?;
    let hide_others = PredefinedMenuItem::hide_others(app, Some(l.hide_others))?;
    let show_all = PredefinedMenuItem::show_all(app, Some(l.show_all))?;
    let quit = PredefinedMenuItem::quit(app, Some(l.quit))?;
    for (item, pick) in [
        (
            &about,
            (|labels| labels.about) as fn(&Labels) -> &'static str,
        ),
        (&services, |labels| labels.services),
        (&hide, |labels| labels.hide),
        (&hide_others, |labels| labels.hide_others),
        (&show_all, |labels| labels.show_all),
        (&quit, |labels| labels.quit),
    ] {
        register_predefined(app, item, pick);
    }
    let application = Submenu::with_items(
        app,
        "TrueMain",
        true,
        &[
            &about,
            &check_for_updates(app)?,
            &PredefinedMenuItem::separator(app)?,
            &settings,
            &PredefinedMenuItem::separator(app)?,
            &services,
            &PredefinedMenuItem::separator(app)?,
            &hide,
            &hide_others,
            &show_all,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;

    let undo = PredefinedMenuItem::undo(app, Some(l.undo))?;
    let redo = PredefinedMenuItem::redo(app, Some(l.redo))?;
    let cut = PredefinedMenuItem::cut(app, Some(l.cut))?;
    let copy = PredefinedMenuItem::copy(app, Some(l.copy))?;
    let paste = PredefinedMenuItem::paste(app, Some(l.paste))?;
    let select_all = PredefinedMenuItem::select_all(app, Some(l.select_all))?;
    for (item, pick) in [
        (&undo, (|labels| labels.undo) as fn(&Labels) -> &'static str),
        (&redo, |labels| labels.redo),
        (&cut, |labels| labels.cut),
        (&copy, |labels| labels.copy),
        (&paste, |labels| labels.paste),
        (&select_all, |labels| labels.select_all),
    ] {
        register_predefined(app, item, pick);
    }
    let edit = Submenu::with_items(
        app,
        l.edit,
        true,
        &[
            &undo,
            &redo,
            &PredefinedMenuItem::separator(app)?,
            &cut,
            &copy,
            &paste,
            &select_all,
        ],
    )?;
    register_submenu(app, &edit, |labels| labels.edit);

    let go = Submenu::new(app, l.go, true)?;
    register_submenu(app, &go, |labels| labels.go);
    let back = MenuItem::with_id(app, BACK, l.back, true, Some("CmdOrCtrl+["))?;
    let forward = MenuItem::with_id(app, FORWARD, l.forward, true, Some("CmdOrCtrl+]"))?;
    register_text(app, &back, |labels| labels.back);
    register_text(app, &forward, |labels| labels.forward);
    go.append(&back)?;
    go.append(&forward)?;
    go.append(&PredefinedMenuItem::separator(app)?)?;
    for (index, (route, accelerator, pick)) in PAGES.iter().enumerate() {
        if PAGE_BREAKS.contains(&index) {
            go.append(&PredefinedMenuItem::separator(app)?)?;
        }
        let item = MenuItem::with_id(app, format!("{GO}{route}"), pick(l), true, *accelerator)?;
        register_text(app, &item, *pick);
        go.append(&item)?;
    }

    let minimize = PredefinedMenuItem::minimize(app, Some(l.minimize))?;
    let zoom = PredefinedMenuItem::maximize(app, Some(l.zoom))?;
    let fullscreen = PredefinedMenuItem::fullscreen(app, Some(l.fullscreen))?;
    let close = PredefinedMenuItem::close_window(app, Some(l.close))?;
    for (item, pick) in [
        (
            &minimize,
            (|labels| labels.minimize) as fn(&Labels) -> &'static str,
        ),
        (&zoom, |labels| labels.zoom),
        (&fullscreen, |labels| labels.fullscreen),
        (&close, |labels| labels.close),
    ] {
        register_predefined(app, item, pick);
    }
    let window = Submenu::with_items(
        app,
        l.window,
        true,
        &[
            &minimize,
            &zoom,
            &fullscreen,
            &PredefinedMenuItem::separator(app)?,
            &close,
        ],
    )?;
    register_submenu(app, &window, |labels| labels.window);

    let website = MenuItem::with_id(app, WEBSITE, l.website, true, None::<&str>)?;
    register_text(app, &website, |labels| labels.website);
    let help = Submenu::with_items(app, l.help, true, &[&website])?;
    register_submenu(app, &help, |labels| labels.help);

    let menu = Menu::with_items(app, &[&application, &edit, &go, &window, &help])?;
    app.set_menu(menu)?;
    // macOS's own parts of those menus: the windows list under Window, the search field under Help.
    #[cfg(target_os = "macos")]
    {
        let _ = window.set_as_windows_menu_for_nsapp();
        let _ = help.set_as_help_menu_for_nsapp();
    }
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

/// The same for one of the system's own items (Hide, Quit, Copy…), whose text macOS does not translate.
fn register_predefined<R: Runtime>(
    app: &App<R>,
    item: &PredefinedMenuItem<R>,
    pick: fn(&Labels) -> &'static str,
) {
    if let Some(texts) = app.try_state::<MenuTexts>() {
        let item = item.clone();
        texts.register(move |labels| {
            let _ = item.set_text(pick(labels));
        });
    }
}

/// The same for a menu's title.
fn register_submenu<R: Runtime>(
    app: &App<R>,
    menu: &Submenu<R>,
    pick: fn(&Labels) -> &'static str,
) {
    if let Some(texts) = app.try_state::<MenuTexts>() {
        let menu = menu.clone();
        texts.register(move |labels| {
            let _ = menu.set_text(pick(labels));
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
        BACK | FORWARD => {
            let _ = app.emit(HISTORY_EVENT, event.id().as_ref());
        }
        WEBSITE => open_website(app),
        id => {
            if let Some(route) = id.strip_prefix(GO) {
                show_window(app);
                let _ = app.emit(NAVIGATE_EVENT, route);
            }
        }
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

/// The site this build belongs to (`site.rs`), in the player's browser.
fn open_website<R: Runtime>(app: &AppHandle<R>) {
    use tauri_plugin_shell::ShellExt;
    if let Some(url) = crate::site::page(&crate::site::base(), "/") {
        // The shell plugin's opener, as `open_on_site` uses it (`lib.rs`).
        #[allow(deprecated)]
        let _ = app.shell().open(url, None);
    }
}
