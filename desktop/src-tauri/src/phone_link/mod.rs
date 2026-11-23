//! The phone link: the player's phone, paired once by a QR code, drives the
//! client through this app over the local network — queue, lobby, ready
//! check, champion select, runes — and follows the game (`phone_link` crate
//! for the protocol, `mobile/` for the Android app).
//!
//! Off until the player turns it on in the settings: listening on the network
//! makes the system ask about incoming connections, which nobody without a
//! phone to pair should be asked.

mod relay;
mod server;
mod store;

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use phone_link::server::Connection;
use phone_link::{Frame, Invite, PcInfo};
use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::{mpsc, watch};

use store::Store;

/// Pushed to the window whenever a phone pairs, connects, leaves or is forgotten.
pub const CHANGED_EVENT: &str = "phone-link://changed";

pub enum Outgoing {
    Frame(Frame),
    /// Close the socket, its reason the link's code, so the phone can say why.
    Close(String),
}

struct Session {
    connection: Arc<Mutex<Connection>>,
    outbox: mpsc::UnboundedSender<Outgoing>,
}

#[derive(Default)]
struct Listening {
    stop: Option<watch::Sender<bool>>,
    error: Option<String>,
}

pub struct Inner {
    app: AppHandle,
    store: Mutex<Store>,
    sessions: Mutex<HashMap<u64, Session>>,
    next_session: AtomicU64,
    listening: Mutex<Listening>,
    version: String,
    /// The app's theme as the main window resolved it (`utils/phone-theme.ts`):
    /// what phones draw in. `Null` until the window has sent it.
    theme: Mutex<Value>,
}

/// Managed by the app; the commands below are the settings' view of it.
pub struct PhoneLink(Arc<Inner>);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PhoneView {
    phone_id: String,
    name: String,
    platform: String,
    paired_at: u64,
    last_seen_at: u64,
    online: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkStatus {
    enabled: bool,
    listening: bool,
    /// Why the port could not be opened (another program on it, the system refused).
    error: Option<String>,
    port: u16,
    addresses: Vec<String>,
    phones: Vec<PhoneView>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InviteView {
    uri: String,
    /// The QR code, an SVG document.
    svg: String,
    expires_in_seconds: u64,
    addresses: Vec<String>,
}

impl Inner {
    fn info(&self) -> PcInfo {
        PcInfo {
            name: pc_name(),
            addresses: lan_addresses(),
            version: self.version.clone(),
        }
    }

    fn register(
        &self,
        connection: Arc<Mutex<Connection>>,
        outbox: mpsc::UnboundedSender<Outgoing>,
    ) -> u64 {
        let id = self.next_session.fetch_add(1, Ordering::Relaxed);
        self.sessions
            .lock()
            .expect("sessions poisoned")
            .insert(id, Session { connection, outbox });
        id
    }

    fn unregister(&self, id: u64) {
        let removed = self.sessions.lock().expect("sessions poisoned").remove(&id);
        if removed.is_some_and(|s| {
            s.connection
                .lock()
                .expect("connection poisoned")
                .phone_id()
                .is_some()
        }) {
            self.changed();
        }
    }

    fn opened(&self, session: u64, phone_id: &str, paired: bool) {
        // One connection per phone: a reconnect replaces the one it left behind.
        let stale: Vec<u64> = {
            let sessions = self.sessions.lock().expect("sessions poisoned");
            sessions
                .iter()
                .filter(|(id, s)| {
                    **id != session
                        && s.connection.lock().expect("connection poisoned").phone_id()
                            == Some(phone_id)
                })
                .map(|(id, _)| *id)
                .collect()
        };
        for id in stale {
            self.close_session(id, "replaced");
        }
        self.store
            .lock()
            .expect("phone store poisoned")
            .touch(phone_id);
        tracing::info!(paired, "phone link opened");
        self.changed();
    }

    fn close_session(&self, id: u64, code: &str) {
        let sessions = self.sessions.lock().expect("sessions poisoned");
        let Some(session) = sessions.get(&id) else {
            return;
        };
        let steps = session
            .connection
            .lock()
            .expect("connection poisoned")
            .close(code);
        for step in steps {
            if let phone_link::server::Step::Send(frame) = step {
                let _ = session.outbox.send(Outgoing::Frame(frame));
            }
        }
        let _ = session.outbox.send(Outgoing::Close(code.to_string()));
    }

    fn open_count(&self) -> usize {
        let sessions = self.sessions.lock().expect("sessions poisoned");
        sessions
            .values()
            .filter(|s| s.connection.lock().expect("connection poisoned").is_open())
            .count()
    }

    /// To every open phone that may follow `uri`, each sealed under its own keys.
    fn broadcast(&self, uri: &str, payload: &Value) {
        let sessions = self.sessions.lock().expect("sessions poisoned");
        for session in sessions.values() {
            let mut connection = session.connection.lock().expect("connection poisoned");
            if let Some(frame) = connection.event(uri, payload) {
                let _ = session.outbox.send(Outgoing::Frame(frame));
            }
        }
    }

    fn status(&self) -> LinkStatus {
        let online: Vec<String> = {
            let sessions = self.sessions.lock().expect("sessions poisoned");
            sessions
                .values()
                .filter_map(|s| {
                    let connection = s.connection.lock().expect("connection poisoned");
                    connection
                        .is_open()
                        .then(|| connection.phone_id().map(str::to_string))
                        .flatten()
                })
                .collect()
        };
        let store = self.store.lock().expect("phone store poisoned");
        let listening = self.listening.lock().expect("listening poisoned");
        LinkStatus {
            enabled: store.enabled(),
            listening: listening.stop.is_some(),
            error: listening.error.clone(),
            port: phone_link::PORT,
            addresses: lan_addresses(),
            phones: store
                .phones()
                .iter()
                .map(|p| PhoneView {
                    phone_id: p.phone_id.clone(),
                    name: p.name.clone(),
                    platform: p.platform.clone(),
                    paired_at: p.paired_at,
                    last_seen_at: p.last_seen_at,
                    online: online.contains(&p.phone_id),
                })
                .collect(),
        }
    }

    fn changed(&self) {
        let _ = self.app.emit(CHANGED_EVENT, self.status());
    }

    async fn start(self: &Arc<Self>) {
        if self
            .listening
            .lock()
            .expect("listening poisoned")
            .stop
            .is_some()
        {
            return;
        }
        let result = tokio::net::TcpListener::bind(("0.0.0.0", phone_link::PORT)).await;
        let mut listening = self.listening.lock().expect("listening poisoned");
        match result {
            Ok(listener) => {
                let (stop, stopped) = watch::channel(false);
                listening.stop = Some(stop);
                listening.error = None;
                tauri::async_runtime::spawn(server::listen(
                    self.app.clone(),
                    self.clone(),
                    listener,
                    stopped,
                ));
                tracing::info!(port = phone_link::PORT, "phone link listening");
            }
            Err(error) => {
                tracing::warn!(%error, "phone link could not listen");
                listening.error = Some(error.to_string());
            }
        }
    }

    fn stop(&self) {
        if let Some(stop) = self
            .listening
            .lock()
            .expect("listening poisoned")
            .stop
            .take()
        {
            let _ = stop.send(true);
        }
        let ids: Vec<u64> = self
            .sessions
            .lock()
            .expect("sessions poisoned")
            .keys()
            .copied()
            .collect();
        for id in ids {
            self.close_session(id, "link-off");
        }
    }

    fn disconnect_phone(&self, phone_id: &str, code: &str) {
        let ids: Vec<u64> = {
            let sessions = self.sessions.lock().expect("sessions poisoned");
            sessions
                .iter()
                .filter(|(_, s)| {
                    s.connection.lock().expect("connection poisoned").phone_id() == Some(phone_id)
                })
                .map(|(id, _)| *id)
                .collect()
        };
        for id in ids {
            self.close_session(id, code);
        }
    }
}

/// Called once from the app's setup.
pub fn setup(app: &AppHandle) {
    let dir = app
        .path()
        .app_config_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("truemain"));
    let inner = Arc::new(Inner {
        app: app.clone(),
        store: Mutex::new(Store::load(&dir)),
        sessions: Mutex::new(HashMap::new()),
        next_session: AtomicU64::new(1),
        listening: Mutex::new(Listening::default()),
        version: app.package_info().version.to_string(),
        theme: Mutex::new(Value::Null),
    });
    relay::bridge_app_events(app, inner.clone());
    tauri::async_runtime::spawn(relay::follow_client(app.clone(), inner.clone()));
    if inner.store.lock().expect("phone store poisoned").enabled() {
        let starting = inner.clone();
        tauri::async_runtime::spawn(async move { starting.start().await });
    }
    app.manage(PhoneLink(inner));
}

/// The main window's theme, sent whenever the player changes it (and at
/// launch), passed on to every open phone.
#[tauri::command]
pub fn phone_link_set_theme(theme: Value, link: State<'_, PhoneLink>) {
    if !theme.is_object() {
        return;
    }
    let changed = {
        let mut current = link.0.theme.lock().expect("theme poisoned");
        let changed = *current != theme;
        *current = theme.clone();
        changed
    };
    if changed {
        link.0.broadcast(THEME_URI, &theme);
    }
}

/// Where a phone reads the theme, and the event it follows.
pub const THEME_URI: &str = "/truemain/theme";

impl PhoneLink {
    pub fn theme(&self) -> Value {
        self.0.theme.lock().expect("theme poisoned").clone()
    }
}

#[tauri::command]
pub fn phone_link_status(link: State<'_, PhoneLink>) -> LinkStatus {
    link.0.status()
}

#[tauri::command]
pub async fn phone_link_set_enabled(
    enabled: bool,
    link: State<'_, PhoneLink>,
) -> Result<LinkStatus, String> {
    link.0
        .store
        .lock()
        .expect("phone store poisoned")
        .set_enabled(enabled);
    if enabled {
        link.0.start().await;
    } else {
        link.0.stop();
    }
    link.0.changed();
    Ok(link.0.status())
}

#[tauri::command]
pub fn phone_link_invite(link: State<'_, PhoneLink>) -> Result<InviteView, String> {
    let (pc_key, token) = {
        let mut store = link.0.store.lock().expect("phone store poisoned");
        if !store.enabled() {
            return Err("the phone link is off".into());
        }
        (store.keys().public(), store.issue_token())
    };
    let addresses = lan_addresses();
    let uri = Invite {
        pc_key,
        token,
        addresses: addresses.clone(),
        name: pc_name(),
    }
    .encode();
    let svg = qrcode::QrCode::with_error_correction_level(&uri, qrcode::EcLevel::M)
        .map_err(|error| error.to_string())?
        .render::<qrcode::render::svg::Color>()
        .min_dimensions(256, 256)
        .quiet_zone(true)
        .dark_color(qrcode::render::svg::Color("#000000"))
        .light_color(qrcode::render::svg::Color("#ffffff"))
        .build();
    Ok(InviteView {
        uri,
        svg,
        expires_in_seconds: store::TOKEN_LIFETIME.as_secs(),
        addresses,
    })
}

#[tauri::command]
pub fn phone_link_forget(phone_id: String, link: State<'_, PhoneLink>) -> LinkStatus {
    link.0
        .store
        .lock()
        .expect("phone store poisoned")
        .forget(&phone_id);
    link.0.disconnect_phone(&phone_id, "forgotten");
    link.0.changed();
    link.0.status()
}

/// Forget every phone and change this desktop's key.
#[tauri::command]
pub fn phone_link_reset(link: State<'_, PhoneLink>) -> LinkStatus {
    let phones: Vec<String> = {
        let mut store = link.0.store.lock().expect("phone store poisoned");
        let phones = store.phones().iter().map(|p| p.phone_id.clone()).collect();
        store.reset();
        phones
    };
    for phone in phones {
        link.0.disconnect_phone(&phone, "forgotten");
    }
    link.0.changed();
    link.0.status()
}

fn pc_name() -> String {
    let name = gethostname::gethostname().to_string_lossy().to_string();
    let name = name.strip_suffix(".local").unwrap_or(&name);
    let name = phone_link::invite::clean_name(name);
    if name.is_empty() {
        "PC".into()
    } else {
        name
    }
}

/// This computer's private IPv4 addresses with the link's port, home networks first.
fn lan_addresses() -> Vec<String> {
    let mut addresses: Vec<std::net::Ipv4Addr> = if_addrs::get_if_addrs()
        .unwrap_or_default()
        .into_iter()
        .filter(|interface| !interface.is_loopback())
        .filter_map(|interface| match interface.ip() {
            std::net::IpAddr::V4(v4) if v4.is_private() => Some(v4),
            _ => None,
        })
        .collect();
    addresses.sort_by_key(|ip| match ip.octets() {
        [192, 168, ..] => 0,
        [10, ..] => 1,
        _ => 2,
    });
    addresses.dedup();
    addresses
        .into_iter()
        .take(phone_link::invite::MAX_ADDRESSES)
        .map(|ip| format!("{ip}:{}", phone_link::PORT))
        .collect()
}
