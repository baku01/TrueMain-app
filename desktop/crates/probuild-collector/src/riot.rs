//! Calls to the Riot API, paced per host by what Riot answers.
//!
//! The same pacing as the desktop collector (`src-tauri/src/highelo.rs`): each
//! response carries the key's `X-App-Rate-Limit`, and the gap between two calls
//! to a host is the slowest window's, with a margin. Platform hosts (ladders)
//! and regional hosts (matches, timelines) have budgets of their own. A 429
//! waits the `Retry-After`; a 401 or 403 stops the run, since the key is gone.

use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};

use serde_json::Value;
use tokio::time::sleep;

/// The gap kept between two calls until Riot has told the key's limits: the personal key's, with a margin.
pub const DEFAULT_GAP_MS: u64 = 1400;
const MARGIN: f64 = 1.15;
const ATTEMPTS: u32 = 4;

/// A platform's regional host: where its matches live.
pub fn region_of(platform: &str) -> Option<&'static str> {
    Some(match platform {
        "br1" | "na1" | "la1" | "la2" => "americas",
        "euw1" | "eun1" | "tr1" | "ru" | "me1" => "europe",
        "kr" | "jp1" => "asia",
        "oc1" | "ph2" | "sg2" | "th2" | "tw2" | "vn2" => "sea",
        _ => return None,
    })
}

/// The gap between two calls that keeps every window of `X-App-Rate-Limit` (`20:1,100:120`) respected.
pub fn gap_for(limits: &str) -> Option<Duration> {
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

/// What a call answered.
pub enum Answer {
    Body(Value),
    /// A 404, a body that is not JSON, or every attempt failed: nothing to keep, the run goes on.
    Missing,
    /// The run cannot go on: the key was refused, or the run was asked to stop.
    Stop(String),
}

pub struct Riot {
    key: String,
    client: reqwest::Client,
    gaps: HashMap<String, (Instant, Duration)>,
    stop: Arc<AtomicBool>,
    pub calls: u64,
    pub gap_ms: u64,
}

impl Riot {
    pub fn new(key: String, stop: Arc<AtomicBool>) -> Result<Self, String> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(20))
            .user_agent(concat!("TrueMain-ProBuild/", env!("CARGO_PKG_VERSION")))
            .build()
            .map_err(|error| error.to_string())?;
        Ok(Self {
            key,
            client,
            gaps: HashMap::new(),
            stop,
            calls: 0,
            gap_ms: DEFAULT_GAP_MS,
        })
    }

    /// `GET https://{host}.api.riotgames.com{path}`, paced on `host`.
    pub async fn get(&mut self, host: &str, path: &str) -> Answer {
        let url = format!("https://{host}.api.riotgames.com{path}");
        for attempt in 0..ATTEMPTS {
            if self.stop.load(Ordering::Relaxed) {
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
            self.calls += 1;
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
                self.gap_ms = limits.as_millis() as u64;
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
                    eprintln!("429 on {host}, waiting {seconds}s");
                    sleep(Duration::from_secs(seconds.min(120) + 1)).await;
                }
                _ => sleep(Duration::from_secs(2u64 << attempt)).await,
            }
        }
        Answer::Missing
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
        assert_eq!(gap_for("20:1,100:120"), Some(Duration::from_millis(1380)));
        assert_eq!(gap_for("500:10,30000:600"), Some(Duration::from_millis(40)));
        assert_eq!(gap_for("nonsense"), None);
    }
}
