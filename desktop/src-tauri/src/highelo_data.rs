//! What the high-elo collector keeps of a match, and the statistics read from it.
//!
//! A match is reduced to one `Row` per participant — champion, lane, result, the
//! final items, the rune page and the summoner spells — because that is all the
//! page's numbers need. The lobby of a Challenger or Grandmaster game is made of
//! high-elo players, so each stored match yields ten builds for one API call.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// One participant of one match.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Row {
    /// The match, so a match is never counted twice.
    pub m: String,
    /// The patch, `16.21`.
    pub v: String,
    /// Milliseconds since the epoch the game was created.
    pub t: u64,
    pub c: u32,
    /// `TOP`, `JUNGLE`, `MIDDLE`, `BOTTOM`, `UTILITY`, or empty.
    pub p: String,
    pub w: bool,
    /// The six item slots, without the trinket; zero for an empty slot.
    pub i: Vec<u32>,
    pub s: [u32; 2],
    /// The keystone.
    pub k: u32,
    /// Primary and secondary tree.
    pub ps: u32,
    pub ss: u32,
    /// Every selected rune: the primary tree's four (the keystone first), then the secondary's two.
    pub r: Vec<u32>,
    /// Stat shards: offense, flex, defense.
    pub sh: [u32; 3],
}

/// `16.21.123.456` → `16.21`.
fn patch_of(version: &str) -> String {
    version.split('.').take(2).collect::<Vec<_>>().join(".")
}

fn number(value: &Value, key: &str) -> u32 {
    value.get(key).and_then(Value::as_u64).unwrap_or(0) as u32
}

/// The rows of a Match-V5 answer; none for a game too short to be a real one.
pub fn rows_of_match(body: &Value) -> Vec<Row> {
    let (Some(info), Some(meta)) = (body.get("info"), body.get("metadata")) else {
        return Vec::new();
    };
    let id = meta
        .get("matchId")
        .and_then(Value::as_str)
        .unwrap_or_default();
    // A game ended by a remake is not a build worth counting.
    if id.is_empty()
        || info
            .get("gameDuration")
            .and_then(Value::as_u64)
            .unwrap_or(0)
            < 300
    {
        return Vec::new();
    }
    let version = patch_of(
        info.get("gameVersion")
            .and_then(Value::as_str)
            .unwrap_or_default(),
    );
    let created = info
        .get("gameCreation")
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let Some(participants) = info.get("participants").and_then(Value::as_array) else {
        return Vec::new();
    };
    participants
        .iter()
        .filter_map(|p| {
            let champion = number(p, "championId");
            if champion == 0 {
                return None;
            }
            let styles = p.pointer("/perks/styles").and_then(Value::as_array)?;
            let style = |description: &str| {
                styles
                    .iter()
                    .find(|s| s.get("description").and_then(Value::as_str) == Some(description))
            };
            let selections = |style: Option<&Value>| -> Vec<u32> {
                style
                    .and_then(|s| s.get("selections"))
                    .and_then(Value::as_array)
                    .map(|list| {
                        list.iter()
                            .map(|selection| number(selection, "perk"))
                            .collect()
                    })
                    .unwrap_or_default()
            };
            let primary = selections(style("primaryStyle"));
            let secondary = selections(style("subStyle"));
            let keystone = *primary.first()?;
            let mut runes = primary;
            runes.extend(secondary);
            let shard = |name: &str| {
                p.pointer(&format!("/perks/statPerks/{name}"))
                    .and_then(Value::as_u64)
                    .unwrap_or(0) as u32
            };
            Some(Row {
                m: id.to_string(),
                v: version.clone(),
                t: created,
                c: champion,
                p: p.get("teamPosition")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string(),
                w: p.get("win").and_then(Value::as_bool).unwrap_or(false),
                i: (0..6).map(|slot| number(p, &format!("item{slot}"))).collect(),
                s: [number(p, "summoner1Id"), number(p, "summoner2Id")],
                k: keystone,
                ps: style("primaryStyle").map(|s| number(s, "style")).unwrap_or(0),
                ss: style("subStyle").map(|s| number(s, "style")).unwrap_or(0),
                r: runes,
                sh: [shard("offense"), shard("flex"), shard("defense")],
            })
        })
        .collect()
}

/// A thing picked, how often and how often it won.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Tally {
    pub id: u32,
    pub games: u32,
    pub wins: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SpellPair {
    pub spells: [u32; 2],
    pub games: u32,
    pub wins: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Page {
    pub keystone: u32,
    pub primary: u32,
    pub secondary: u32,
    pub runes: Vec<u32>,
    pub games: u32,
    pub wins: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChampionStats {
    pub champion_id: u32,
    /// The patch the numbers are for; empty when there is no game of the champion.
    pub patch: String,
    /// Every patch the champion has games on, newest first.
    pub patches: Vec<String>,
    pub games: u32,
    pub wins: u32,
    /// Games per lane, 1 Top … 5 Support, 0 none.
    pub positions: Vec<Tally>,
    pub keystones: Vec<Tally>,
    /// Every rune but the keystones, picked.
    pub runes: Vec<Tally>,
    pub shards: Vec<Tally>,
    pub pages: Vec<Page>,
    pub items: Vec<Tally>,
    pub spells: Vec<SpellPair>,
}

fn newest_first(a: &str, b: &str) -> std::cmp::Ordering {
    let key = |v: &str| {
        let mut parts = v.split('.').map(|part| part.parse::<u32>().unwrap_or(0));
        (parts.next().unwrap_or(0), parts.next().unwrap_or(0))
    };
    key(b).cmp(&key(a))
}

fn tally(counts: HashMap<u32, (u32, u32)>) -> Vec<Tally> {
    let mut list: Vec<Tally> = counts
        .into_iter()
        .map(|(id, (games, wins))| Tally { id, games, wins })
        .collect();
    list.sort_by(|a, b| b.games.cmp(&a.games).then(a.id.cmp(&b.id)));
    list
}

fn bump(map: &mut HashMap<u32, (u32, u32)>, id: u32, win: bool) {
    let entry = map.entry(id).or_default();
    entry.0 += 1;
    entry.1 += u32::from(win);
}

/// A lane as a number, so lanes can be tallied like everything else: 1 Top … 5 Support, 0 none.
fn position_code(position: &str) -> u32 {
    match position {
        "TOP" => 1,
        "JUNGLE" => 2,
        "MIDDLE" => 3,
        "BOTTOM" => 4,
        "UTILITY" => 5,
        _ => 0,
    }
}

/// The statistics of one champion over the stored rows. `patch` of `None` takes the newest patch it has
/// games on; `position` of `None` takes every lane.
pub fn champion_stats(
    rows: &[Row],
    champion_id: u32,
    patch: Option<&str>,
    position: Option<&str>,
) -> ChampionStats {
    let of_champion: Vec<&Row> = rows.iter().filter(|row| row.c == champion_id).collect();
    let mut patches: Vec<String> = of_champion.iter().map(|row| row.v.clone()).collect();
    patches.sort();
    patches.dedup();
    patches.sort_by(|a, b| newest_first(a, b));
    let chosen = patch
        .map(str::to_string)
        .filter(|wanted| patches.contains(wanted))
        .or_else(|| patches.first().cloned())
        .unwrap_or_default();

    let selected: Vec<&Row> = of_champion
        .into_iter()
        .filter(|row| row.v == chosen)
        .collect();
    let mut positions = HashMap::new();
    for row in &selected {
        bump(&mut positions, position_code(&row.p), row.w);
    }
    let chosen_rows: Vec<&&Row> = selected
        .iter()
        .filter(|row| position.is_none_or(|wanted| row.p == wanted))
        .collect();

    let (mut keystones, mut runes, mut shards, mut items) = (
        HashMap::new(),
        HashMap::new(),
        HashMap::new(),
        HashMap::new(),
    );
    let mut spells: HashMap<[u32; 2], (u32, u32)> = HashMap::new();
    let mut pages: HashMap<Vec<u32>, (u32, u32)> = HashMap::new();
    let mut wins = 0;
    for row in &chosen_rows {
        wins += u32::from(row.w);
        bump(&mut keystones, row.k, row.w);
        for rune in row.r.iter().skip(1) {
            bump(&mut runes, *rune, row.w);
        }
        for shard in row.sh {
            bump(&mut shards, shard, row.w);
        }
        for item in row.i.iter().filter(|item| **item != 0) {
            bump(&mut items, *item, row.w);
        }
        let mut pair = row.s;
        pair.sort_unstable();
        let entry = spells.entry(pair).or_default();
        entry.0 += 1;
        entry.1 += u32::from(row.w);
        let mut signature = vec![row.ps, row.ss];
        signature.extend(&row.r);
        let entry = pages.entry(signature).or_default();
        entry.0 += 1;
        entry.1 += u32::from(row.w);
    }

    let mut spell_list: Vec<SpellPair> = spells
        .into_iter()
        .map(|(spells, (games, wins))| SpellPair {
            spells,
            games,
            wins,
        })
        .collect();
    spell_list.sort_by(|a, b| b.games.cmp(&a.games).then(a.spells.cmp(&b.spells)));
    let mut page_list: Vec<Page> = pages
        .into_iter()
        .map(|(signature, (games, wins))| Page {
            keystone: signature.get(2).copied().unwrap_or(0),
            primary: signature[0],
            secondary: signature[1],
            runes: signature[2..].to_vec(),
            games,
            wins,
        })
        .collect();
    page_list.sort_by(|a, b| b.games.cmp(&a.games).then(a.runes.cmp(&b.runes)));
    page_list.truncate(5);

    ChampionStats {
        champion_id,
        patch: chosen,
        patches,
        games: chosen_rows.len() as u32,
        wins,
        positions: tally(positions),
        keystones: tally(keystones),
        runes: tally(runes),
        shards: tally(shards),
        pages: page_list,
        items: tally(items),
        spells: spell_list,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn participant(champion: u32, win: bool, position: &str, keystone: u32) -> Value {
        json!({
            "championId": champion, "win": win, "teamPosition": position,
            "item0": 3031, "item1": 3006, "item2": 0, "item3": 0, "item4": 0, "item5": 0, "item6": 3340,
            "summoner1Id": 4, "summoner2Id": 7,
            "perks": {
                "statPerks": { "offense": 5008, "flex": 5008, "defense": 5001 },
                "styles": [
                    { "description": "primaryStyle", "style": 8000, "selections": [{ "perk": keystone }, { "perk": 9111 }, { "perk": 9104 }, { "perk": 8299 }] },
                    { "description": "subStyle", "style": 8300, "selections": [{ "perk": 8304 }, { "perk": 8347 }] }
                ]
            }
        })
    }

    fn game(id: &str, version: &str, participants: Vec<Value>) -> Value {
        json!({
            "metadata": { "matchId": id },
            "info": { "gameVersion": version, "gameCreation": 1_700_000_000_000u64, "gameDuration": 1800, "participants": participants }
        })
    }

    #[test]
    fn a_match_becomes_a_row_per_participant() {
        let body = game(
            "BR1_1",
            "16.21.1.2",
            vec![
                participant(222, true, "BOTTOM", 8005),
                participant(81, false, "BOTTOM", 8021),
            ],
        );
        let rows = rows_of_match(&body);
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].v, "16.21");
        assert_eq!(rows[0].k, 8005);
        assert_eq!(rows[0].i, vec![3031, 3006, 0, 0, 0, 0]);
        assert_eq!(rows[0].r, vec![8005, 9111, 9104, 8299, 8304, 8347]);
        assert_eq!(rows[0].sh, [5008, 5008, 5001]);
        assert!(rows[0].w && !rows[1].w);
    }

    #[test]
    fn a_remake_or_a_malformed_match_gives_nothing() {
        let mut short = game("BR1_2", "16.21.1", vec![participant(222, true, "BOTTOM", 8005)]);
        short["info"]["gameDuration"] = json!(200);
        assert!(rows_of_match(&short).is_empty());
        assert!(rows_of_match(&json!({})).is_empty());
    }

    #[test]
    fn statistics_count_games_and_wins_per_keystone_item_and_spell_pair() {
        let rows: Vec<Row> = [("a", true, 8005), ("b", true, 8005), ("c", false, 8021)]
            .iter()
            .flat_map(|(id, win, keystone)| {
                rows_of_match(&game(id, "16.21.1", vec![participant(222, *win, "BOTTOM", *keystone)]))
            })
            .collect();
        let stats = champion_stats(&rows, 222, None, None);
        assert_eq!((stats.games, stats.wins, stats.patch.as_str()), (3, 2, "16.21"));
        assert_eq!(stats.keystones[0], Tally { id: 8005, games: 2, wins: 2 });
        assert_eq!(stats.keystones[1], Tally { id: 8021, games: 1, wins: 0 });
        assert_eq!(
            stats.items.iter().find(|t| t.id == 3031),
            Some(&Tally { id: 3031, games: 3, wins: 2 })
        );
        assert!(stats.items.iter().all(|t| t.id != 3340), "the trinket slot is not kept");
        assert_eq!(stats.spells[0], SpellPair { spells: [4, 7], games: 3, wins: 2 });
        assert_eq!(stats.pages[0].games, 2);
        assert_eq!(stats.positions[0].id, 4);
    }

    #[test]
    fn the_newest_patch_is_the_default_and_another_can_be_asked_for() {
        let mut rows = rows_of_match(&game("a", "16.9.1", vec![participant(222, true, "BOTTOM", 8005)]));
        rows.extend(rows_of_match(&game("b", "16.21.1", vec![participant(222, false, "BOTTOM", 8005)])));
        let stats = champion_stats(&rows, 222, None, None);
        assert_eq!(stats.patch, "16.21");
        assert_eq!(stats.patches, vec!["16.21", "16.9"]);
        assert_eq!(champion_stats(&rows, 222, Some("16.9"), None).wins, 1);
        assert_eq!(champion_stats(&rows, 222, Some("1.1"), None).patch, "16.21");
    }

    #[test]
    fn a_position_narrows_the_numbers_but_not_the_lane_split() {
        let mut rows = rows_of_match(&game("a", "16.21.1", vec![participant(222, true, "BOTTOM", 8005)]));
        rows.extend(rows_of_match(&game("b", "16.21.1", vec![participant(222, true, "MIDDLE", 8005)])));
        let stats = champion_stats(&rows, 222, None, Some("MIDDLE"));
        assert_eq!(stats.games, 1);
        assert_eq!(stats.positions.len(), 2);
    }
}
