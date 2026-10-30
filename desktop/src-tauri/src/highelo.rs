//! The high-elo collector: the builds and runes of the best players' recent games.
//!
//! The Riot API cannot be asked "the games of Ezreal in Challenger". What it can
//! do is list the ladder (`league-v4`), the match ids of a player
//! (`match-v5`), and one match. So the collector walks the ladder from the top,
//! reads each player's recent ranked games, and keeps one `Row` per participant
//! of every match it has not seen (`highelo_data`): a Challenger lobby is made
//! of high-elo players, so one match call stores ten builds, and the games of
//! every champion fill at once. A champion's statistics are then read from what
//! was kept.
//!
//! It spends the player's own key (`riot.rs`) and paces itself by what Riot
//! answers: each response carries the key's `X-App-Rate-Limit`, and the gap
//! between two calls to a host is the slowest window's, with a margin. A 429
//! waits the `Retry-After`; a 401 or 403 stops the run, since the key is gone.
//! Platform hosts (ladders) and regional hosts (matches) have budgets of their
//! own, so a ladder call never slows a match call. Rows live in a file in the
//! app's data folder and are loaded back at start, so a run continues where the
//! last one stopped (a match is never fetched twice).

use std::{
    collections::{HashMap, HashSet},
    fs::OpenOptions,
    io::{BufRead, BufReader, Write},
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Manager, State};
use tokio::time::sleep;

use crate::highelo_data::{champion_stats, rows_of_match, ChampionStats, Row};

const QUEUE_SOLO: u32 = 420;
/// How far back a player's games are read.
const WINDOW_DAYS: u64 = 14;
/// The gap kept between two calls until Riot has told the key's limits: the personal key's, with a margin.
const DEFAULT_GAP_MS: u64 = 1400;
const MARGIN: f64 = 1.15;

/// A platform's regional host: where its matches live.
fn region_of(platform: &str) -> Option<&'static str> {
    Some(match platform {
        "br1" | "na1" | "la1" | "la2" => "americas",
        "euw1" | "eun1" | "tr1" | "ru" | "me1" => "europe",
        "kr" | "jp1" => "asia",
        "oc1" | "ph2" | "sg2" | "th2" | "tw2" | "vn2" => "sea",
        _ => return None,
    })
}

/// The gap between two calls that keeps every window of `X-App-Rate-Limit` (`20:1,100:120`) respected.
fn gap_for(limits: &str) -> Option<Duration> {
    let slowest = limits
        .split(',')
        .filter_map(|window| {
            let (limit, seconds) = window.trim().split_once(':')?;
            let (limit, seconds): (f64, f64) = (limit.parse().ok()?, seconds.parse().ok()?);
            (limit > 0.0).then_some(seconds * 1000.0 / limit)
        })
        .fold(None, |acc: Option<f64>, gap| {
            Some(acc.map_or(gap, |a| a.max(gap)))
        })?;
    Some(Duration::from_millis(
        ((slowest * MARGIN).clamp(40.0, 10_000.0)) as u64,
    ))
}

/// Which tiers of the ladder are walked.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Tiers {
    Challenger,
    ChallengerGrandmaster,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Plan {
    pub platform: String,
    pub tiers: Tiers,
    /// The best players taken from the ladder.
    pub players: u32,
    /// Games read per player.
    pub games_per_player: u32,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    pub running: bool,
    /// `ladder`, `players`, `matches`, `done`, `stopped`, `failed`, or empty before a run.
    pub phase: String,
    pub platform: String,
    pub players_total: u32,
    pub players_done: u32,
    pub matches_stored: u32,
    pub matches_queued: u32,
    pub rows_stored: u32,
    pub calls: u32,
    /// The gap between calls the collector keeps, in milliseconds.
    pub gap_ms: u64,
    pub error: Option<String>,
}

pub struct Collector {
    path: PathBuf,
    rows: Mutex<Vec<Row>>,
    seen: Mutex<HashSet<String>>,
    progress: Mutex<Progress>,
    stop: AtomicBool,
}

impl Collector {
    pub fn new(app: &AppHandle) -> Self {
        let path = app
            .path()
            .app_data_dir()
            .unwrap_or_else(|_| std::env::temp_dir().join("truemain"))
            .join("highelo")
            .join("rows.jsonl");
        Self::at(path)
    }

    fn at(path: PathBuf) -> Self {
        let (rows, seen) = load(&path);
        let progress = Progress {
            rows_stored: rows.len() as u32,
            matches_stored: seen.len() as u32,
            ..Progress::default()
        };
        Self {
            path,
            rows: Mutex::new(rows),
            seen: Mutex::new(seen),
            progress: Mutex::new(progress),
            stop: AtomicBool::new(false),
        }
    }

    fn update(&self, change: impl FnOnce(&mut Progress)) {
        change(&mut self.progress.lock().expect("progress poisoned"));
    }

    fn store(&self, rows: Vec<Row>) {
        let Some(first) = rows.first() else { return };
        if !self
            .seen
            .lock()
            .expect("seen poisoned")
            .insert(first.m.clone())
        {
            return;
        }
        if let Some(folder) = self.path.parent() {
            let _ = std::fs::create_dir_all(folder);
        }
        if let Ok(mut file) = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.path)
        {
            for row in &rows {
                if let Ok(line) = serde_json::to_string(row) {
                    let _ = writeln!(file, "{line}");
                }
            }
        }
        let count = rows.len() as u32;
        self.rows.lock().expect("rows poisoned").extend(rows);
        self.update(|p| {
            p.matches_stored += 1;
            p.rows_stored += count;
        });
    }
}

fn load(path: &PathBuf) -> (Vec<Row>, HashSet<String>) {
    let mut rows = Vec::new();
    let mut seen = HashSet::new();
    if let Ok(file) = std::fs::File::open(path) {
        for line in BufReader::new(file).lines().map_while(Result::ok) {
            if let Ok(row) = serde_json::from_str::<Row>(&line) {
                seen.insert(row.m.clone());
                rows.push(row);
            }
        }
    }
    (rows, seen)
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Why a call stopped the run, or what it answered.
enum Answer {
    Body(Value),
    Missing,
    Stop(String),
}

/// Calls to Riot, paced per host.
struct Riot {
    key: String,
    client: reqwest::Client,
    gaps: HashMap<String, (Instant, Duration)>,
}

impl Riot {
    async fn get(&mut self, collector: &Collector, host: &str, path: &str) -> Answer {
        let url = format!("https://{host}.api.riotgames.com{path}");
        for attempt in 0..4 {
            if collector.stop.load(Ordering::Relaxed) {
                return Answer::Stop("stopped".to_string());
            }
            let (next, gap) = self
                .gaps
                .get(host)
                .copied()
                .unwrap_or((Instant::now(), Duration::from_millis(DEFAULT_GAP_MS)));
            let wait = next.saturating_duration_since(Instant::now());
            if !wait.is_zero() {
                sleep(wait).await;
            }
            self.gaps
                .insert(host.to_string(), (Instant::now() + gap, gap));
            collector.update(|p| p.calls += 1);
            let response = match self
                .client
                .get(&url)
                .header("X-Riot-Token", &self.key)
                .send()
                .await
            {
                Ok(response) => response,
                Err(_) => {
                    sleep(Duration::from_secs(2u64 << attempt)).await;
                    continue;
                }
            };
            if let Some(limits) = response
                .headers()
                .get("x-app-rate-limit")
                .and_then(|value| value.to_str().ok())
                .and_then(gap_for)
            {
                self.gaps
                    .insert(host.to_string(), (Instant::now() + limits, limits));
                collector.update(|p| p.gap_ms = limits.as_millis() as u64);
            }
            let status = response.status().as_u16();
            match status {
                200 => {
                    return match response.json::<Value>().await {
                        Ok(body) => Answer::Body(body),
                        Err(_) => Answer::Missing,
                    };
                }
                404 => return Answer::Missing,
                401 | 403 => return Answer::Stop(format!("Riot refused the key ({status}).")),
                429 => {
                    let seconds = response
                        .headers()
                        .get("retry-after")
                        .and_then(|value| value.to_str().ok())
                        .and_then(|value| value.trim().parse::<u64>().ok())
                        .unwrap_or(10);
                    sleep(Duration::from_secs(seconds.min(120) + 1)).await;
                }
                _ => sleep(Duration::from_secs(2u64 << attempt)).await,
            }
        }
        Answer::Missing
    }
}

/// The ladder's players, best first, as `puuid`s.
async fn ladder(
    riot: &mut Riot,
    collector: &Collector,
    plan: &Plan,
) -> Result<Vec<String>, String> {
    let mut entries: Vec<(i64, String)> = Vec::new();
    let leagues: &[&str] = match plan.tiers {
        Tiers::Challenger => &["challengerleagues"],
        Tiers::ChallengerGrandmaster => &["challengerleagues", "grandmasterleagues"],
    };
    for league in leagues {
        let path = format!("/lol/league/v4/{league}/by-queue/RANKED_SOLO_5x5");
        match riot.get(collector, &plan.platform, &path).await {
            Answer::Body(body) => {
                for entry in body
                    .get("entries")
                    .and_then(Value::as_array)
                    .into_iter()
                    .flatten()
                {
                    let points = entry
                        .get("leaguePoints")
                        .and_then(Value::as_i64)
                        .unwrap_or(0);
                    if let Some(puuid) = entry.get("puuid").and_then(Value::as_str) {
                        entries.push((points, puuid.to_string()));
                    }
                }
            }
            Answer::Missing => {}
            Answer::Stop(reason) => return Err(reason),
        }
    }
    if entries.is_empty() {
        return Err("Riot's ladder carried no players with an id.".to_string());
    }
    entries.sort_by_key(|entry| std::cmp::Reverse(entry.0));
    Ok(entries
        .into_iter()
        .take(plan.players as usize)
        .map(|(_, puuid)| puuid)
        .collect())
}

async fn run(app: AppHandle, key: String, plan: Plan) {
    let collector = app.state::<Arc<Collector>>().inner().clone();
    collect(&collector, key, plan).await;
}

/// One run: the walk, and what it ended as.
async fn collect(collector: &Collector, key: String, plan: Plan) {
    let Some(region) = region_of(&plan.platform) else {
        collector.update(|p| {
            p.running = false;
            p.phase = "failed".to_string();
            p.error = Some(format!("{} is not a Riot platform.", plan.platform));
        });
        return;
    };
    let mut riot = Riot {
        key,
        client: reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .user_agent(concat!("TrueMain-Desktop/", env!("CARGO_PKG_VERSION")))
            .build()
            .expect("failed to build the HTTP client"),
        gaps: HashMap::new(),
    };
    let outcome = walk(&mut riot, collector, &plan, region).await;
    collector.update(|p| {
        p.running = false;
        match outcome {
            Ok(()) if collector.stop.load(Ordering::Relaxed) => p.phase = "stopped".to_string(),
            Ok(()) => p.phase = "done".to_string(),
            Err(ref reason) if reason == "stopped" => p.phase = "stopped".to_string(),
            Err(reason) => {
                p.phase = "failed".to_string();
                p.error = Some(reason);
            }
        }
    });
}

async fn walk(
    riot: &mut Riot,
    collector: &Collector,
    plan: &Plan,
    region: &str,
) -> Result<(), String> {
    collector.update(|p| p.phase = "ladder".to_string());
    let players = ladder(riot, collector, plan).await?;
    collector.update(|p| {
        p.phase = "players".to_string();
        p.players_total = players.len() as u32;
    });
    let since = now_secs().saturating_sub(WINDOW_DAYS * 86_400);
    for (index, puuid) in players.iter().enumerate() {
        let path = format!(
            "/lol/match/v5/matches/by-puuid/{puuid}/ids?queue={QUEUE_SOLO}&startTime={since}&count={}",
            plan.games_per_player
        );
        let ids: Vec<String> = match riot.get(collector, region, &path).await {
            Answer::Body(body) => serde_json::from_value(body).unwrap_or_default(),
            Answer::Missing => Vec::new(),
            Answer::Stop(reason) => return Err(reason),
        };
        let fresh: Vec<String> = {
            let seen = collector.seen.lock().expect("seen poisoned");
            ids.into_iter().filter(|id| !seen.contains(id)).collect()
        };
        collector.update(|p| {
            p.phase = "matches".to_string();
            p.matches_queued = fresh.len() as u32;
        });
        for id in fresh {
            match riot
                .get(collector, region, &format!("/lol/match/v5/matches/{id}"))
                .await
            {
                Answer::Body(body) => collector.store(rows_of_match(&body)),
                Answer::Missing => {}
                Answer::Stop(reason) => return Err(reason),
            }
            collector.update(|p| p.matches_queued = p.matches_queued.saturating_sub(1));
        }
        collector.update(|p| p.players_done = index as u32 + 1);
    }
    Ok(())
}

/// Starts a collection with the saved key. One run at a time.
#[tauri::command]
pub fn highelo_start(
    app: AppHandle,
    collector: State<'_, Arc<Collector>>,
    plan: Plan,
) -> Result<(), String> {
    let key = crate::riot::read_saved().ok_or("Save a Riot API key first.")?;
    if region_of(&plan.platform).is_none() {
        return Err(format!("{} is not a Riot platform.", plan.platform));
    }
    if plan.players == 0
        || plan.players > 1500
        || plan.games_per_player == 0
        || plan.games_per_player > 100
    {
        return Err("The plan is out of range.".to_string());
    }
    {
        let mut progress = collector.progress.lock().expect("progress poisoned");
        if progress.running {
            return Err("A collection is already running.".to_string());
        }
        *progress = Progress {
            running: true,
            phase: "ladder".to_string(),
            platform: plan.platform.clone(),
            matches_stored: progress.matches_stored,
            rows_stored: progress.rows_stored,
            gap_ms: DEFAULT_GAP_MS,
            ..Progress::default()
        };
    }
    collector.stop.store(false, Ordering::Relaxed);
    tauri::async_runtime::spawn(run(app, key, plan));
    Ok(())
}

#[tauri::command]
pub fn highelo_stop(collector: State<'_, Arc<Collector>>) {
    collector.stop.store(true, Ordering::Relaxed);
}

#[tauri::command]
pub fn highelo_progress(collector: State<'_, Arc<Collector>>) -> Progress {
    collector
        .progress
        .lock()
        .expect("progress poisoned")
        .clone()
}

/// The statistics of a champion over what has been collected.
#[tauri::command]
pub fn highelo_stats(
    collector: State<'_, Arc<Collector>>,
    champion_id: u32,
    patch: Option<String>,
    position: Option<String>,
) -> ChampionStats {
    let rows = collector.rows.lock().expect("rows poisoned");
    champion_stats(&rows, champion_id, patch.as_deref(), position.as_deref())
}

/// Forgets everything collected.
#[tauri::command]
pub fn highelo_clear(collector: State<'_, Arc<Collector>>) -> Result<(), String> {
    if collector
        .progress
        .lock()
        .expect("progress poisoned")
        .running
    {
        return Err("Stop the collection first.".to_string());
    }
    collector.rows.lock().expect("rows poisoned").clear();
    collector.seen.lock().expect("seen poisoned").clear();
    let _ = std::fs::remove_file(&collector.path);
    collector.update(|p| {
        p.matches_stored = 0;
        p.rows_stored = 0;
        p.phase = String::new();
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Against the real API: `RIOT_KEY=RGAPI-… cargo test --lib live_collection -- --ignored --nocapture`.
    #[tokio::test]
    #[ignore = "spends the Riot key"]
    async fn live_collection() {
        let key = std::env::var("RIOT_KEY").expect("RIOT_KEY");
        let path = std::env::temp_dir().join("truemain-highelo-live.jsonl");
        let _ = std::fs::remove_file(&path);
        let collector = Collector::at(path.clone());
        let plan = Plan {
            platform: "br1".to_string(),
            tiers: Tiers::Challenger,
            players: 3,
            games_per_player: 4,
        };
        collect(&collector, key, plan).await;
        let progress = collector.progress.lock().unwrap().clone();
        println!("{progress:?}");
        assert_eq!(progress.phase, "done", "{:?}", progress.error);
        let rows = collector.rows.lock().unwrap();
        assert!(!rows.is_empty(), "no rows stored");
        let champion = rows[0].c;
        let stats = champion_stats(&rows, champion, None, None);
        println!("champion {champion}: {stats:#?}");
        assert!(stats.games > 0);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn a_platform_goes_to_its_regional_host() {
        assert_eq!(region_of("br1"), Some("americas"));
        assert_eq!(region_of("euw1"), Some("europe"));
        assert_eq!(region_of("kr"), Some("asia"));
        assert_eq!(region_of("oc1"), Some("sea"));
        assert_eq!(region_of("nowhere"), None);
    }

    #[test]
    fn the_gap_keeps_the_slowest_window_with_a_margin() {
        // 20 per second is 50 ms a call; 100 per two minutes is 1200 ms — the one that binds.
        assert_eq!(gap_for("20:1,100:120"), Some(Duration::from_millis(1380)));
        // An approved key's budget is far looser: 500 per 10 s is 20 ms, 30000 per 10 min is 20 ms.
        assert_eq!(gap_for("500:10,30000:600"), Some(Duration::from_millis(40)));
        assert_eq!(gap_for("nonsense"), None);
    }

    #[test]
    fn rows_are_read_back_and_a_match_is_counted_once() {
        let row = |m: &str| Row {
            m: m.to_string(),
            v: "16.21".to_string(),
            t: 1,
            c: 222,
            p: "BOTTOM".to_string(),
            w: true,
            i: vec![3031, 0, 0, 0, 0, 0],
            s: [4, 7],
            k: 8005,
            ps: 8000,
            ss: 8300,
            r: vec![8005],
            sh: [5008, 5008, 5001],
        };
        let path =
            std::env::temp_dir().join(format!("truemain-highelo-{}.jsonl", std::process::id()));
        let lines: String = ["a", "a", "b"]
            .iter()
            .map(|m| format!("{}\n", serde_json::to_string(&row(m)).unwrap()))
            .collect();
        std::fs::write(&path, lines).unwrap();
        let (rows, seen) = load(&path);
        assert_eq!(rows.len(), 3);
        assert_eq!(seen.len(), 2);
        let _ = std::fs::remove_file(path);
    }
}
