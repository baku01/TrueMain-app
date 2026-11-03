//! The personal build's other sources of numbers, chosen in Settings
//! (`utils/data-source.ts`): Blitz's, lolalytics' and Tencent's public read
//! endpoints, and op.gg's official API (its MCP server, published for third parties).
//! The webview cannot read them itself — no CORS header for its origin, and a
//! CSP that only reaches Data Dragon — so the shell does, the way `news.rs`
//! fetches Riot's patch notes. Which addresses is the shell's rule: a known
//! base and a path of plain segments, or one of op.gg's `lol_*` tools; never
//! a URL the webview makes up.
//!
//! Answers are kept for two hours: they move with a patch, and a page flicked
//! back and forth must not ask twice for the same thing. They are kept as the
//! text that came, at most `CACHE_BYTES` of it, and handed to the webview as
//! that text (`RawValue`) — never held or re-encoded as a tree of values.

use std::collections::HashMap;
use std::sync::{Arc, LazyLock, Mutex};

use serde_json::value::RawValue;
use std::time::{Duration, Instant};

const TTL: Duration = Duration::from_secs(2 * 60 * 60);
const TIMEOUT: Duration = Duration::from_secs(30);
const OPGG_MCP: &str = "https://mcp-api.op.gg/mcp";

/// What the cache holds at most; the oldest answers go first past it.
const CACHE_BYTES: usize = 32 * 1024 * 1024;

static CACHE: LazyLock<Mutex<HashMap<String, (Instant, Arc<str>)>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// One client for every read: its connections and TLS sessions are reused.
static CLIENT: LazyLock<Result<reqwest::Client, String>> = LazyLock::new(|| {
    reqwest::Client::builder()
        .timeout(TIMEOUT)
        .user_agent(concat!("TrueMain-Desktop/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|error| error.to_string())
});

/// The base a `source` names. lolalytics answers every view on one address
/// (`?ep=`), so its path is empty.
fn base(source: &str) -> Option<&'static str> {
    match source {
        "data" => Some("https://data.v2.iesdev.com/api/v1/query_objects/prod/lol/"),
        // The account reads sit at the root (`riot_account/…`), the match reads under `lol/`: each path carries its own prefix.
        "lol" => Some("https://lol.v2.iesdev.com/"),
        "utils" => Some("https://utils.iesdev.com/static/json/lol/"),
        // Blitz's champion insights (tips, strengths, weaknesses), published beside its site.
        "nexus" => Some("https://utils.iesdev.com/static/json/nexus/lol/"),
        "lolalytics" => Some("https://a1.lolalytics.com/mega/"),
        // The guides lol.qq.com's own pages load: scripts (`var X = {…};`), read as their object.
        "tencent" => Some("https://lol.qq.com/act/lbp/common/guides/"),
        _ => None,
    }
}

/// Plain segments only: no scheme, no `..`, nothing that leaves the base. A
/// player's Riot ID comes percent-encoded (`twtv%20Peng04`, Korean names), so
/// `%` is allowed — but never an encoded slash or dot, which could climb out.
fn safe_path(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    !path.is_empty()
        && !lower.contains("%2f")
        && !lower.contains("%2e")
        && !lower.contains("%5c")
        && path.split('/').all(|segment| {
            !segment.is_empty()
                && segment != ".."
                && segment
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b"-_.%".contains(&b))
        })
}

fn url(source: &str, path: &str) -> Result<String, String> {
    let base = base(source).ok_or_else(|| format!("{source} is not a known source"))?;
    let ok = if source == "lolalytics" {
        path.is_empty()
    } else {
        safe_path(path)
    };
    if !ok {
        return Err(format!("{path} is not a {source} path"));
    }
    Ok(format!("{base}{path}"))
}

fn cached(key: &str) -> Result<Option<Arc<str>>, String> {
    let cache = CACHE.lock().map_err(|e| e.to_string())?;
    Ok(cache
        .get(key)
        .filter(|(at, _)| at.elapsed() < TTL)
        .map(|(_, text)| Arc::clone(text)))
}

/// Keep `text` under `key`, dropping what expired, then the oldest answers
/// while the whole is past `CACHE_BYTES`.
fn keep(key: String, text: Arc<str>) -> Result<(), String> {
    let mut cache = CACHE.lock().map_err(|e| e.to_string())?;
    cache.retain(|_, (at, _)| at.elapsed() < TTL);
    cache.insert(key, (Instant::now(), text));
    let mut total: usize = cache.values().map(|(_, text)| text.len()).sum();
    while total > CACHE_BYTES {
        let Some(oldest) = cache
            .iter()
            .min_by_key(|(_, (at, _))| *at)
            .map(|(key, _)| key.clone())
        else {
            break;
        };
        if let Some((_, text)) = cache.remove(&oldest) {
            total -= text.len();
        }
    }
    Ok(())
}

fn client() -> Result<reqwest::Client, String> {
    CLIENT.clone()
}

/// One read of a source: `source` picks the base, `path` the endpoint under it.
#[tauri::command]
pub async fn source_get(
    source: String,
    path: String,
    query: Vec<(String, String)>,
) -> Result<Box<RawValue>, String> {
    let url = url(&source, &path)?;
    let key = format!("{url} {query:?}");
    if let Some(text) = cached(&key)? {
        return RawValue::from_string(text.to_string()).map_err(|error| error.to_string());
    }
    let text = client()?
        .get(url)
        .query(&query)
        .send()
        .await
        .and_then(|response| response.error_for_status())
        .map_err(|error| format!("{source} answered {error}"))?
        .text()
        .await
        .map_err(|error| error.to_string())?;
    let value = if source == "tencent" {
        script_object(&text)
    } else {
        RawValue::from_string(text).map_err(|error| error.to_string())
    }?;
    keep(key, Arc::from(value.get()))?;
    Ok(value)
}

/// The object a script assigns (`var CHAMPION_DETAIL_103={…};/* … */`):
/// the first JSON value from its first brace, whatever follows it.
fn script_object(text: &str) -> Result<Box<RawValue>, String> {
    let start = text.find('{').ok_or("no object in the script")?;
    serde_json::Deserializer::from_str(&text[start..])
        .into_iter::<Box<RawValue>>()
        .next()
        .ok_or("no object in the script")?
        .map_err(|error| error.to_string())
}

/// One of op.gg's League tools — `lol_` and lower-case words, nothing else.
fn opgg_tool(tool: &str) -> bool {
    tool.strip_prefix("lol_").is_some_and(|rest| {
        !rest.is_empty() && rest.bytes().all(|b| b.is_ascii_lowercase() || b == b'_')
    })
}

/// The tool's answer out of a JSON-RPC reply, sent as plain JSON or as a
/// server-sent event (`data: {...}`), whichever the server picked.
fn opgg_text(body: &str) -> Result<String, String> {
    let json = body
        .lines()
        .find_map(|line| line.strip_prefix("data:").map(str::trim))
        .unwrap_or(body.trim());
    let reply: serde_json::Value = serde_json::from_str(json).map_err(|e| e.to_string())?;
    if let Some(error) = reply.get("error") {
        return Err(format!("op.gg answered {error}"));
    }
    let result = &reply["result"];
    let text = result["content"][0]["text"]
        .as_str()
        .unwrap_or_default()
        .to_string();
    if result["isError"].as_bool() == Some(true) {
        return Err(format!("op.gg answered {text}"));
    }
    Ok(text)
}

/// One call to op.gg's official API: the tool's text answer, as op.gg writes it.
#[tauri::command]
pub async fn opgg_call(tool: String, arguments: serde_json::Value) -> Result<String, String> {
    if !opgg_tool(&tool) {
        return Err(format!("{tool} is not an op.gg League tool"));
    }
    let key = format!("opgg {tool} {arguments}");
    if let Some(text) = cached(&key)? {
        return Ok(text.to_string());
    }
    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": { "name": tool, "arguments": arguments },
    });
    let body = client()?
        .post(OPGG_MCP)
        .header("Accept", "application/json, text/event-stream")
        .json(&request)
        .send()
        .await
        .and_then(|response| response.error_for_status())
        .map_err(|error| format!("op.gg answered {error}"))?
        .text()
        .await
        .map_err(|error| error.to_string())?;
    let text = opgg_text(&body)?;
    keep(key, Arc::from(text.as_str()))?;
    Ok(text)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_cache_lets_the_oldest_answers_go_past_its_size() {
        let big: Arc<str> = Arc::from("x".repeat(CACHE_BYTES / 2 + 1));
        keep("evict-test first".into(), Arc::clone(&big)).unwrap();
        keep("evict-test second".into(), Arc::clone(&big)).unwrap();
        assert!(cached("evict-test first").unwrap().is_none());
        assert!(cached("evict-test second").unwrap().is_some());
    }

    #[test]
    fn reads_the_object_a_script_assigns() {
        let value = script_object("var X={\"a\":[1]};/* |xGv00|f00 */").unwrap();
        assert_eq!(value.get(), "{\"a\":[1]}");
        assert!(script_object("nothing").is_err());
    }

    #[test]
    fn known_sources_and_plain_paths_only() {
        assert!(url("data", "champion_builds_tags").is_ok());
        assert!(url("utils", "esports/worlds-2026/matches").is_ok());
        assert!(url("lolalytics", "").is_ok());
        assert!(url("lolalytics", "x").is_err());
        assert!(url("tencent", "champDetail/champDetail_103.js").is_ok());
        assert!(url("other", "x").is_err());
        assert!(url("data", "../secret").is_err());
        assert!(url("data", "a//b").is_err());
        assert!(url("lol", "https:").is_err());
        assert!(url("lol", "riot_account/lol/EUW1/twtv%20Peng04/NMIXX").is_ok());
        assert!(url("lol", "riot_account/lol/EUW1/a%2F..%2Fx/y").is_err());
        assert!(url("lol", "lol/match/%2e%2e").is_err());
    }

    #[test]
    fn op_gg_league_tools_only() {
        assert!(opgg_tool("lol_get_champion_analysis"));
        assert!(!opgg_tool("tft_list_meta_decks"));
        assert!(!opgg_tool("lol_"));
        assert!(!opgg_tool("lol_x/../y"));
    }

    #[test]
    fn reads_the_text_from_json_or_an_event() {
        let reply =
            r#"{"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"A(1)"}]}}"#;
        assert_eq!(opgg_text(reply).unwrap(), "A(1)");
        assert_eq!(
            opgg_text(&format!("event: message\ndata: {reply}\n")).unwrap(),
            "A(1)"
        );
        let failed = r#"{"result":{"isError":true,"content":[{"text":"bad"}]}}"#;
        assert!(opgg_text(failed).is_err());
    }
}

#[cfg(test)]
mod network {
    use super::*;

    /// The real op.gg call the app makes, through the shell: it must answer, and promptly.
    /// Run by hand: `cargo test --lib sources::network -- --ignored`.
    #[tokio::test]
    #[ignore]
    async fn op_gg_answers_promptly() {
        let started = std::time::Instant::now();
        let text = opgg_call(
            "lol_get_champion_analysis".into(),
            serde_json::json!({ "game_mode": "ranked", "champion": "EZREAL", "position": "adc" }),
        )
        .await
        .expect("op.gg answered");
        assert!(text.contains("LolGetChampionAnalysis"));
        assert!(
            started.elapsed() < Duration::from_secs(15),
            "took {:?}",
            started.elapsed()
        );
    }
}
