//! What a paired phone's requests reach, and the events it is sent.
//!
//! Requests have already passed `phone_link::allow`: the desktop's own
//! `/truemain/*` answer from the app's state, `/liveclientdata/*` from the
//! game, everything else from the attached client. Events come from a client
//! socket of the link's own (open only while a phone is), from the state the
//! supervisor publishes, and from the game page's feed.

use std::sync::Arc;
use std::time::{Duration, Instant};

use serde_json::{json, Value};
use tauri::{AppHandle, Listener, Manager};
use tokio::sync::mpsc;

use super::Inner;
use crate::game::SharedGame;
use crate::record::SharedClient;
use crate::supervisor::SharedState;

/// The game's state at most this often: the phone draws a scoreboard, not frames.
const GAME_EVERY: Duration = Duration::from_millis(1000);

pub async fn run(app: &AppHandle, method: &str, path: &str, body: Option<&Value>) -> (u16, Value) {
    let route = path.split('?').next().unwrap_or(path);
    match route {
        "/truemain/state" => (200, app_state(app)),
        "/truemain/game" => (200, game_state(app)),
        super::THEME_URI => (200, app.state::<super::PhoneLink>().theme()),
        "/truemain/runes" => import_runes(app, body).await,
        _ if route.starts_with("/liveclientdata/") => {
            let result = match lcu::LiveClient::new() {
                Ok(live) => live.raw(&path["/liveclientdata".len()..]).await,
                Err(error) => Err(error),
            };
            // The port refuses until a game is loading: "no game" rather than an error.
            result
                .map(|body| (200, body))
                .unwrap_or_else(|_| (404, json!({ "error": "no-game" })))
        }
        _ => {
            let client = app
                .state::<SharedClient>()
                .read()
                .expect("client lock poisoned")
                .clone();
            let Some(client) = client else {
                return (503, json!({ "error": "client-not-running" }));
            };
            match client.request(method, path, body).await {
                Ok(answer) => answer,
                Err(error) => (502, json!({ "error": error.to_string() })),
            }
        }
    }
}

fn attached(app: &AppHandle) -> Option<Arc<lcu::LcuClient>> {
    app.state::<SharedClient>()
        .read()
        .expect("client lock poisoned")
        .clone()
}

async fn import_runes(app: &AppHandle, body: Option<&Value>) -> (u16, Value) {
    let Some(draft) =
        body.and_then(|b| serde_json::from_value::<lcu::RunePageDraft>(b.clone()).ok())
    else {
        return (400, json!({ "error": "bad-rune-page" }));
    };
    let Some(client) = attached(app) else {
        return (503, json!({ "error": "client-not-running" }));
    };
    match client.import_rune_page(&draft).await {
        Ok(page_id) => (200, json!({ "id": page_id })),
        Err(lcu::Error::NoRunePageSlot) => (409, json!({ "error": "no-rune-page-slot" })),
        Err(error) => (502, json!({ "error": error.to_string() })),
    }
}

fn app_state(app: &AppHandle) -> Value {
    let state = app.state::<SharedState>();
    let state = state.lock().expect("state mutex poisoned");
    serde_json::to_value(&*state).unwrap_or(Value::Null)
}

fn game_state(app: &AppHandle) -> Value {
    let game = app.state::<SharedGame>();
    let game = game.lock().expect("game mutex poisoned");
    game.current()
        .and_then(|state| serde_json::to_value(state).ok())
        .unwrap_or(Value::Null)
}

/// The app's state and the game's, as the windows get them, to every open phone.
pub fn bridge_app_events(app: &AppHandle, inner: Arc<Inner>) {
    let state_inner = inner.clone();
    let state_app = app.clone();
    app.listen(crate::supervisor::STATE_EVENT, move |_| {
        if state_inner.open_count() > 0 {
            state_inner.broadcast("/truemain/state", &app_state(&state_app));
        }
    });

    let last = Arc::new(std::sync::Mutex::new(Instant::now() - GAME_EVERY));
    for event in [crate::game::SNAPSHOT_EVENT, crate::game::UPDATE_EVENT] {
        let (inner, app_handle, last) = (inner.clone(), app.clone(), last.clone());
        app.listen(event, move |_| {
            if inner.open_count() == 0 {
                return;
            }
            {
                let mut last = last.lock().expect("game throttle poisoned");
                if last.elapsed() < GAME_EVERY {
                    return;
                }
                *last = Instant::now();
            }
            inner.broadcast("/truemain/game", &game_state(&app_handle));
        });
    }
}

/// Follows the client's events for as long as the app runs, subscribed only
/// while a phone is open: a desktop nobody's phone is reaching keeps no
/// second socket to the client.
pub async fn follow_client(app: AppHandle, inner: Arc<Inner>) {
    let uris: Vec<&'static str> = phone_link::allow::client_events().collect();
    loop {
        tokio::time::sleep(Duration::from_secs(2)).await;
        if inner.open_count() == 0 {
            continue;
        }
        let client = app
            .state::<SharedClient>()
            .read()
            .expect("client lock poisoned")
            .clone();
        let Some(client) = client else { continue };

        let (sender, mut receiver) = mpsc::channel(64);
        let credentials = client.credentials().clone();
        let subscribed = uris.clone();
        let stream =
            tokio::spawn(
                async move { lcu::stream_endpoints(credentials, &subscribed, sender).await },
            );
        let mut check = tokio::time::interval(Duration::from_secs(5));
        loop {
            tokio::select! {
                event = receiver.recv() => match event {
                    Some(event) => inner.broadcast(&event.uri, &event.data),
                    None => break,
                },
                _ = check.tick() => {
                    if inner.open_count() == 0 {
                        break;
                    }
                }
            }
        }
        stream.abort();
    }
}
