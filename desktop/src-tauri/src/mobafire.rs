//! MOBAFire's build guides, for the app's "Guides" page. MOBAFire sits behind
//! Cloudflare, which answers a plain HTTP client (`reqwest`, curl) with 403
//! whatever it sends — the answer depends on the connection, not the headers —
//! and only lets a browser through. The site has no API either: its pages are
//! drawn on its server. So the shell keeps a window of its own on
//! mobafire.com, hidden — the system's webview, a real browser — and has it
//! fetch each page the way the site's own pages fetch theirs, from the site's
//! origin with its cookies; the HTML comes back (`eval_with_callback`),
//! stripped of what the app never reads (scripts, styles, drawings), and the
//! app's webview turns it into the guide list or a guide (`utils/mobafire.ts`).
//!
//! Kept as light as a browser can be: between reads the window rests on the
//! site's `robots.txt`, a page with no script or advert to run, so a read
//! costs one request and never a page with its adverts; and a window left
//! unused for a few minutes is closed, its webview's memory given back — the
//! cookies stay, the next read opens it again. Only when Cloudflare stands in
//! front of a page — no clearance yet, or it ran out — is the page itself
//! opened in the window, where the check runs; when it asks to confirm a
//! human is there, the window is shown for the player to click it, and put
//! back at rest once the page is through. The clearance stays in the
//! webview's cookies for the next reads. The check is never answered for the
//! player: the shell only waits. (On macOS, WebKit may answer it by itself
//! with Apple's Private Access Tokens, as Safari does, for a signed app.)
//!
//! The window gets none of the app's IPC — no capability names it — and which
//! pages it reads is the shell's rule: MOBAFire's guide list and its guides
//! (`league-of-legends/build…`), never an address the webview makes up. The
//! site's `/ajax/` and `/json/`, which its robots.txt keeps from robots, are
//! never asked for.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, LazyLock, Mutex};
use std::time::Duration;

use tauri::utils::config::BackgroundThrottlingPolicy;
use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Emitter, Manager, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tokio::sync::{oneshot, watch};

const ORIGIN: &str = "https://www.mobafire.com";
const LABEL: &str = "mobafire";

/// Where the window rests between reads: the site's own origin, nothing on it to run.
const IDLE: &str = "https://www.mobafire.com/robots.txt";

/// Told to the app's webview when the player has to confirm in the window, and once they did.
const CHECK_EVENT: &str = "mobafire://check";

/// A page that does not finish loading in this long is not coming.
const LOAD_TIMEOUT: Duration = Duration::from_secs(30);
/// How often a fetch the window was given is looked in on.
const POLL: Duration = Duration::from_millis(100);
/// Cloudflare's check often passes on its own in a few seconds: the window is shown only past this.
const QUIET_CHECK: Duration = Duration::from_secs(6);
/// How long the player is given to confirm in the window.
const CHECK_TIMEOUT: Duration = Duration::from_secs(180);
/// A window unused this long is closed: its webview's memory back, its cookies kept.
const IDLE_CLOSE: Duration = Duration::from_secs(180);

/// One read at a time: the window has one page.
static READ: LazyLock<tokio::sync::Mutex<()>> = LazyLock::new(|| tokio::sync::Mutex::new(()));

/// Counts the pages the window finished loading, so a read waits for the one it asked for.
static LOADS: LazyLock<watch::Sender<u64>> = LazyLock::new(|| watch::channel(0).0);

/// Names each fetch the window is given, so its answer is told from another's.
static FETCHES: AtomicU64 = AtomicU64::new(0);

/// Counts the reads: the window is closed only when none came after the one that left it idle.
static READS: AtomicU64 = AtomicU64::new(0);

/// What the app never reads of a page, taken out in the window before it
/// crosses over: scripts, styles, drawings and comments — most of its weight.
const STRIP: &str = r#"function (html) {
    return html
      .replace(/<script\b[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[\s\S]*?<\/style>/gi, '')
      .replace(/<svg\b[\s\S]*?<\/svg>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');
  }"#;

/// What the window answers about the page it shows: its HTML, or an empty
/// string while Cloudflare's check stands in for it.
fn read_page() -> String {
    format!(
        r#"(function () {{
  var strip = {STRIP};
  var check = !!window._cf_chl_opt || !!document.querySelector('#challenge-form, #challenge-stage, .cf-turnstile, [name="cf-turnstile-response"]');
  return check ? '' : strip(document.documentElement.outerHTML);
}})()"#
    )
}

/// Starts fetching `url` from the window's page; its answer is kept under `id` (`take_fetch`).
fn start_fetch(id: u64, url: &str) -> String {
    let url = serde_json::to_string(url).unwrap_or_default();
    format!(
        r#"(function () {{
  var strip = {STRIP};
  var reads = window.__truemainReads || (window.__truemainReads = {{}});
  fetch({url}, {{ credentials: 'include' }})
    .then(function (response) {{
      return response.text().then(function (html) {{
        reads[{id}] = {{ status: response.status, check: html.indexOf('_cf_chl_opt') >= 0, html: strip(html) }};
      }});
    }})
    .catch(function () {{ reads[{id}] = {{ status: 0, check: false, html: '' }}; }});
  return '';
}})()"#
    )
}

/// The answer kept under `id`, as JSON, taken; an empty string until it came.
fn take_fetch(id: u64) -> String {
    format!(
        r#"(function () {{
  var reads = window.__truemainReads;
  var read = reads && reads[{id}];
  if (!read) return '';
  delete reads[{id}];
  return JSON.stringify(read);
}})()"#
    )
}

#[derive(serde::Deserialize)]
struct Fetched {
    status: u16,
    /// Cloudflare's check came back instead of the page.
    check: bool,
    html: String,
}

impl Fetched {
    /// The page itself, not Cloudflare standing in for it.
    fn through(&self) -> bool {
        self.status == 200 && !self.check
    }
}

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

fn idle_url() -> Result<Url, String> {
    Url::parse(IDLE).map_err(|error| error.to_string())
}

/// The window, made — at rest on `IDLE` — when there is none, and whether it was just made.
fn window(app: &AppHandle) -> Result<(WebviewWindow, bool), String> {
    if let Some(window) = app.get_webview_window(LABEL) {
        return Ok((window, false));
    }
    let window = WebviewWindowBuilder::new(app, LABEL, WebviewUrl::External(idle_url()?))
        .title("MOBAFire — TrueMain")
        .inner_size(480.0, 640.0)
        .center()
        .visible(false)
        .focused(false)
        // A hidden page left to work: macOS 14+ would suspend it (`tauri.macos.conf.json`).
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

/// Closes the window once it has stayed unused `IDLE_CLOSE` after `read`,
/// unless a read came since, one is running, or the player has it on screen.
fn close_when_idle(app: &AppHandle, read: u64) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(IDLE_CLOSE).await;
        if READS.load(Ordering::Relaxed) != read {
            return;
        }
        let Ok(_free) = READ.try_lock() else {
            return;
        };
        if let Some(window) = app.get_webview_window(LABEL) {
            if !window.is_visible().unwrap_or(false) {
                let _ = window.close();
            }
        }
    });
}

/// Waits for a page load after `seen`; false past `limit`.
async fn loaded(seen: &mut watch::Receiver<u64>, limit: Duration) -> bool {
    matches!(
        tokio::time::timeout(limit, seen.changed()).await,
        Ok(Ok(()))
    )
}

/// What a script run in the window answers, when it is a non-empty string.
/// WKWebView hands back an empty answer for a script that failed: it reads as
/// none, alike.
async fn eval_string(window: &WebviewWindow, script: &str) -> Result<Option<String>, String> {
    let (sender, receiver) = oneshot::channel::<String>();
    let sender = Arc::new(Mutex::new(Some(sender)));
    window
        .eval_with_callback(script, move |answer| {
            if let Some(sender) = sender.lock().ok().and_then(|mut slot| slot.take()) {
                let _ = sender.send(answer);
            }
        })
        .map_err(|error| error.to_string())?;
    let answer = tokio::time::timeout(LOAD_TIMEOUT, receiver)
        .await
        .map_err(|_| "MOBAFire's window did not answer".to_string())?
        .map_err(|_| "MOBAFire's window did not answer".to_string())?;
    Ok(serde_json::from_str::<String>(&answer)
        .ok()
        .filter(|text| !text.is_empty()))
}

/// `url` fetched from the window's page, as the site's own pages fetch; None
/// when the window gave no answer in time.
async fn fetch_in_window(window: &WebviewWindow, url: &str) -> Result<Option<Fetched>, String> {
    let id = FETCHES.fetch_add(1, Ordering::Relaxed);
    eval_string(window, &start_fetch(id, url)).await?;
    let deadline = tokio::time::Instant::now() + LOAD_TIMEOUT;
    while tokio::time::Instant::now() < deadline {
        tokio::time::sleep(POLL).await;
        if let Some(answer) = eval_string(window, &take_fetch(id)).await? {
            return Ok(serde_json::from_str::<Fetched>(&answer).ok());
        }
    }
    Ok(None)
}

/// The window put away; the app told the check is over.
fn put_away(app: &AppHandle, window: &WebviewWindow) {
    let _ = window.hide();
    let _ = app.emit(CHECK_EVENT, false);
}

/// `url` opened in the window itself, for Cloudflare's check to run there:
/// given a few seconds to pass on its own, then shown to the player and
/// waited for. A window closed then ends the read.
async fn open_page(
    app: &AppHandle,
    window: &WebviewWindow,
    seen: &mut watch::Receiver<u64>,
    url: Url,
) -> Result<String, String> {
    seen.borrow_and_update();
    window.navigate(url).map_err(|error| error.to_string())?;
    if !loaded(seen, LOAD_TIMEOUT).await {
        return Err("MOBAFire's page did not load".to_string());
    }
    if let Some(html) = eval_string(window, &read_page()).await? {
        return Ok(html);
    }
    let mut shown = false;
    let deadline = tokio::time::Instant::now() + CHECK_TIMEOUT;
    loop {
        let wait = if shown {
            Duration::from_secs(2)
        } else {
            QUIET_CHECK
        };
        loaded(seen, wait).await;
        if app.get_webview_window(LABEL).is_none() {
            let _ = app.emit(CHECK_EVENT, false);
            return Err("MOBAFire's check was closed".to_string());
        }
        if let Some(html) = eval_string(window, &read_page()).await? {
            if shown {
                put_away(app, window);
            }
            return Ok(html);
        }
        if tokio::time::Instant::now() >= deadline {
            put_away(app, window);
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

/// The HTML of one MOBAFire page (`page_url`'s rule), fetched from the
/// shell's hidden window on mobafire.com — or, while Cloudflare stands in
/// front of it, opened there for its check (`open_page`).
#[tauri::command]
pub async fn mobafire_page(app: AppHandle, path: String) -> Result<String, String> {
    let url = page_url(&path).ok_or_else(|| format!("{path} is not a MOBAFire guide page"))?;
    let read = READS.fetch_add(1, Ordering::Relaxed) + 1;
    let html = {
        let _one = READ.lock().await;
        read_through(&app, &url).await
    };
    close_when_idle(&app, read);
    html
}

async fn read_through(app: &AppHandle, url: &str) -> Result<String, String> {
    // A new receiver has seen every load before it: it waits for the next.
    let mut seen = LOADS.subscribe();
    let (window, made) = window(app)?;
    if made && !loaded(&mut seen, LOAD_TIMEOUT).await {
        return Err("MOBAFire's window did not load".to_string());
    }
    if let Some(fetched) = fetch_in_window(&window, url).await? {
        if fetched.through() {
            return Ok(fetched.html);
        }
    }
    let page = Url::parse(url).map_err(|error| error.to_string())?;
    let html = open_page(app, &window, &mut seen, page).await;
    // Back to rest, the page's adverts and scripts left behind.
    if let Ok(idle) = idle_url() {
        let _ = window.navigate(idle);
    }
    html
}

/// Opens a guide's YouTube video in the player's browser: a video's id
/// (eleven letters, digits, `-` or `_`), never an address the webview makes up.
#[tauri::command]
pub fn open_guide_video(app: AppHandle, video: String) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;

    let id = video.len() == 11
        && video
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    if !id {
        return Err(format!("{video} is not a YouTube video"));
    }
    // As `open_patch_note`: the rule above is the whole guard.
    #[allow(deprecated)]
    app.shell()
        .open(format!("https://www.youtube.com/watch?v={video}"), None)
        .map_err(|error| error.to_string())
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

    #[test]
    fn a_fetch_through_cloudflare_is_the_page_itself() {
        let page = |status, check| Fetched {
            status,
            check,
            html: String::new(),
        };
        assert!(page(200, false).through());
        assert!(!page(403, false).through());
        assert!(!page(200, true).through());
        assert!(!page(0, false).through());
    }

    #[test]
    fn the_fetch_scripts_carry_the_address_as_a_string() {
        let script = start_fetch(7, "https://www.mobafire.com/league-of-legends/build?page=2");
        assert!(
            script.contains(r#"fetch("https://www.mobafire.com/league-of-legends/build?page=2""#)
        );
        assert!(script.contains("reads[7]"));
        assert!(take_fetch(7).contains("delete reads[7]"));
        assert!(read_page().contains("var strip = function (html)"));
    }
}
