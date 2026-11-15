//! MOBAFire's build guides, for the app's "Guides" page. MOBAFire sits behind
//! Cloudflare, which answers a plain HTTP client (`reqwest`, curl) with 403
//! whatever it sends — the answer depends on the connection, not the headers —
//! and only lets a browser through. So the shell keeps a window of its own on
//! mobafire.com, hidden — the system's webview, a real browser — and reads a
//! page there: it navigates, waits for the page to load, and takes its HTML
//! back (`eval_with_callback`), which the app's webview turns into the guide
//! list or a guide (`utils/mobafire.ts`).
//!
//! When Cloudflare asks to confirm a human is there, the window is shown for
//! the player to click it, and hidden again once the page is through; the
//! clearance stays in the webview's cookies for the next reads. The page is
//! never answered for the player: the shell only waits.
//!
//! The window gets none of the app's IPC — no capability names it — and which
//! pages it opens is the shell's rule: MOBAFire's guide list and its guides
//! (`league-of-legends/build…`), never an address the webview makes up. The
//! site's `/ajax/` and `/json/`, which its robots.txt keeps from robots, are
//! never asked for.

use std::sync::{Arc, LazyLock, Mutex};
use std::time::Duration;

use tauri::utils::config::BackgroundThrottlingPolicy;
use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Emitter, Manager, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tokio::sync::{oneshot, watch};

const ORIGIN: &str = "https://www.mobafire.com";
const LABEL: &str = "mobafire";

/// Told to the app's webview when the player has to confirm in the window, and once they did.
const CHECK_EVENT: &str = "mobafire://check";

/// A page that does not finish loading in this long is not coming.
const LOAD_TIMEOUT: Duration = Duration::from_secs(30);
/// Cloudflare's check often passes on its own in a few seconds: the window is shown only past this.
const QUIET_CHECK: Duration = Duration::from_secs(6);
/// How long the player is given to confirm in the window.
const CHECK_TIMEOUT: Duration = Duration::from_secs(180);

/// One read at a time: the window shows one page.
static READ: LazyLock<tokio::sync::Mutex<()>> = LazyLock::new(|| tokio::sync::Mutex::new(()));

/// Counts the pages the window finished loading, so a read waits for the one it asked for.
static LOADS: LazyLock<watch::Sender<u64>> = LazyLock::new(|| watch::channel(0).0);

/// What the window answers about the page it shows: its HTML, or an empty
/// string while Cloudflare's check stands in for it.
const READ_PAGE: &str = r#"(function () {
  var check = !!window._cf_chl_opt || !!document.querySelector('#challenge-form, #challenge-stage, .cf-turnstile, [name="cf-turnstile-response"]');
  return check ? '' : document.documentElement.outerHTML;
})()"#;

/// The address of a MOBAFire page the app may read: the guide list
/// (`league-of-legends/build`, then up to two words — a champion, a lane — and
/// its filters) or one guide (`league-of-legends/build/<slug>-<id>`).
fn page_url(path: &str) -> Option<String> {
    let (route, query) = path.split_once('?').unwrap_or((path, ""));
    let rest = route.strip_prefix("league-of-legends/build")?;
    let words: Vec<&str> = rest.split('/').skip(1).collect();
    let word = |word: &&str| {
        !word.is_empty()
            && word
                .chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
    };
    let route_ok =
        (rest.is_empty() || rest.starts_with('/')) && words.len() <= 2 && words.iter().all(word);
    let query_ok = query
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '=' | '&' | '-' | '_'));
    (route_ok && query_ok).then(|| {
        if query.is_empty() {
            format!("{ORIGIN}/{route}")
        } else {
            format!("{ORIGIN}/{route}?{query}")
        }
    })
}

/// The window, made the first time on `url`; the window already there otherwise.
fn window(app: &AppHandle, url: &Url) -> Result<(WebviewWindow, bool), String> {
    if let Some(window) = app.get_webview_window(LABEL) {
        return Ok((window, false));
    }
    let window = WebviewWindowBuilder::new(app, LABEL, WebviewUrl::External(url.clone()))
        .title("MOBAFire — TrueMain")
        .inner_size(480.0, 640.0)
        .center()
        .visible(false)
        .focused(false)
        // A hidden page left to load: macOS 14+ would suspend it (`tauri.macos.conf.json`).
        .background_throttling(BackgroundThrottlingPolicy::Throttle)
        .on_page_load(|_, payload| {
            if payload.event() == PageLoadEvent::Finished {
                LOADS.send_modify(|count| *count += 1);
            }
        })
        .build()
        .map_err(|error| error.to_string())?;
    Ok((window, true))
}

/// Waits for a page load after `seen`; false past `limit`.
async fn loaded(seen: &mut watch::Receiver<u64>, limit: Duration) -> bool {
    matches!(
        tokio::time::timeout(limit, seen.changed()).await,
        Ok(Ok(()))
    )
}

/// The page the window shows: its HTML, or None while Cloudflare's check is on
/// screen — or while the page answers nothing readable (WKWebView hands back
/// an empty answer for a script that failed), which is waited out alike.
async fn read_page(window: &WebviewWindow) -> Result<Option<String>, String> {
    let (sender, receiver) = oneshot::channel::<String>();
    let sender = Arc::new(Mutex::new(Some(sender)));
    window
        .eval_with_callback(READ_PAGE, move |answer| {
            if let Some(sender) = sender.lock().ok().and_then(|mut slot| slot.take()) {
                let _ = sender.send(answer);
            }
        })
        .map_err(|error| error.to_string())?;
    let answer = tokio::time::timeout(LOAD_TIMEOUT, receiver)
        .await
        .map_err(|_| "MOBAFire's page did not answer".to_string())?
        .map_err(|_| "MOBAFire's page did not answer".to_string())?;
    Ok(serde_json::from_str::<String>(&answer)
        .ok()
        .filter(|html| !html.is_empty()))
}

/// The window put away; the app told the check is over.
fn put_away(app: &AppHandle, window: &WebviewWindow) {
    let _ = window.hide();
    let _ = app.emit(CHECK_EVENT, false);
}

/// The HTML of one MOBAFire page (`page_url`'s rule), read in the shell's
/// hidden window on mobafire.com. Cloudflare's check, when it stays, is shown
/// to the player and waited for; a window closed then ends the read.
#[tauri::command]
pub async fn mobafire_page(app: AppHandle, path: String) -> Result<String, String> {
    let url = page_url(&path).ok_or_else(|| format!("{path} is not a MOBAFire guide page"))?;
    let url = Url::parse(&url).map_err(|error| error.to_string())?;
    let _one = READ.lock().await;
    // A new receiver has seen every load before it: it waits for the next.
    let mut seen = LOADS.subscribe();
    let (window, made) = window(&app, &url)?;
    if !made {
        window.navigate(url).map_err(|error| error.to_string())?;
    }
    if !loaded(&mut seen, LOAD_TIMEOUT).await {
        return Err("MOBAFire's page did not load".to_string());
    }
    if let Some(html) = read_page(&window).await? {
        return Ok(html);
    }
    // Cloudflare's check: given a few seconds to pass on its own, then shown.
    let mut shown = false;
    let deadline = tokio::time::Instant::now() + CHECK_TIMEOUT;
    loop {
        let wait = if shown {
            Duration::from_secs(2)
        } else {
            QUIET_CHECK
        };
        loaded(&mut seen, wait).await;
        if app.get_webview_window(LABEL).is_none() {
            let _ = app.emit(CHECK_EVENT, false);
            return Err("MOBAFire's check was closed".to_string());
        }
        if let Some(html) = read_page(&window).await? {
            if shown {
                put_away(&app, &window);
            }
            return Ok(html);
        }
        if tokio::time::Instant::now() >= deadline {
            put_away(&app, &window);
            return Err("MOBAFire's check was not confirmed".to_string());
        }
        if !shown {
            shown = true;
            let _ = window.center();
            let _ = window.show();
            let _ = window.set_focus();
            let _ = app.emit(CHECK_EVENT, true);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_guide_list_and_guides_only() {
        assert_eq!(
            page_url("league-of-legends/build").as_deref(),
            Some("https://www.mobafire.com/league-of-legends/build")
        );
        assert_eq!(
            page_url("league-of-legends/build/briar/top?sort=top&author=verified&page=2").as_deref(),
            Some("https://www.mobafire.com/league-of-legends/build/briar/top?sort=top&author=verified&page=2")
        );
        assert!(page_url("league-of-legends/build/26-22-rank-1-briar-jungle-629922").is_some());
        assert!(page_url("league-of-legends/builds").is_none());
        assert!(page_url("ajax/searchSite").is_none());
        assert!(page_url("league-of-legends/build/a/b/c").is_none());
        assert!(page_url("league-of-legends/build/../ajax").is_none());
        assert!(page_url("league-of-legends/build?x=<script>").is_none());
        assert!(page_url("league-of-legends/build//").is_none());
        assert!(page_url("https://evil.example/league-of-legends/build").is_none());
    }
}
