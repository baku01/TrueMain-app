//! What is kept of a Match-V5 answer and of its timeline.
//!
//! A match becomes one `Participant` per player — champion, lane, result, the
//! final items (slots 0–5 plus the role-bound slot, never the trinket), the rune
//! page and the summoner spells. The timeline adds each player's purchases and
//! skill points, the raw material of the item order, the starters, the boots and
//! the skill order (`derive`).

use std::collections::BTreeMap;

use serde_json::Value;

/// A game shorter than this is a remake, whatever Riot's flag says.
const REMAKE_FLOOR_SECONDS: u64 = 300;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Participant {
    pub participant_id: u32,
    pub puuid: String,
    pub champion_id: u32,
    /// `TOP`, `JUNGLE`, `MIDDLE`, `BOTTOM`, `UTILITY`, or empty.
    pub position: String,
    pub win: bool,
    /// Slots 0–5; zero for an empty slot.
    pub items: [u32; 6],
    /// Riot's role-bound slot (bot-lane boots live there); zero when empty.
    pub role_bound_item: u32,
    pub spells: [u32; 2],
    pub primary_style: u32,
    pub sub_style: u32,
    /// The primary tree's four runes (the keystone first), then the secondary's two.
    pub runes: Vec<u32>,
    /// Offense, flex, defense.
    pub shards: [u32; 3],
}

impl Participant {
    pub fn keystone(&self) -> u32 {
        self.runes.first().copied().unwrap_or(0)
    }

    /// The final inventory: slots 0–5 and the role-bound slot, empty slots left out.
    pub fn final_items(&self) -> Vec<u32> {
        self.items
            .iter()
            .chain(std::iter::once(&self.role_bound_item))
            .copied()
            .filter(|item| *item != 0)
            .collect()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Match {
    pub match_id: String,
    pub platform: String,
    pub queue_id: u32,
    /// `16.21`.
    pub patch: String,
    pub game_version: String,
    pub created_ms: u64,
    pub duration_seconds: u64,
    pub remake: bool,
    /// Empty for a remake: nothing of it is a build.
    pub participants: Vec<Participant>,
}

/// `16.21.123.456` → `16.21`.
pub fn patch_of(version: &str) -> String {
    version.split('.').take(2).collect::<Vec<_>>().join(".")
}

fn number(value: &Value, key: &str) -> u32 {
    value.get(key).and_then(Value::as_u64).unwrap_or(0) as u32
}

fn text(value: &Value, key: &str) -> String {
    value
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

/// A Match-V5 answer; `None` when it is not one.
pub fn match_of(body: &Value) -> Option<Match> {
    let info = body.get("info")?;
    let match_id = text(body.get("metadata")?, "matchId");
    if match_id.is_empty() {
        return None;
    }
    let participants = info.get("participants").and_then(Value::as_array)?;
    let duration_seconds = info
        .get("gameDuration")
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let remake = duration_seconds < REMAKE_FLOOR_SECONDS
        || participants.iter().any(|p| {
            p.get("gameEndedInEarlySurrender")
                .and_then(Value::as_bool)
                .unwrap_or(false)
        });
    let game_version = text(info, "gameVersion");
    let platform = match text(info, "platformId") {
        id if !id.is_empty() => id,
        _ => match_id.split('_').next().unwrap_or_default().to_string(),
    };
    Some(Match {
        platform,
        queue_id: number(info, "queueId"),
        patch: patch_of(&game_version),
        game_version,
        created_ms: info
            .get("gameCreation")
            .and_then(Value::as_u64)
            .unwrap_or(0),
        duration_seconds,
        remake,
        participants: if remake {
            Vec::new()
        } else {
            participants
                .iter()
                .enumerate()
                .filter_map(|(index, p)| participant_of(index, p))
                .collect()
        },
        match_id,
    })
}

fn participant_of(index: usize, p: &Value) -> Option<Participant> {
    let champion_id = number(p, "championId");
    if champion_id == 0 {
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
            .map(|list| list.iter().map(|s| number(s, "perk")).collect())
            .unwrap_or_default()
    };
    let mut runes = selections(style("primaryStyle"));
    runes.first()?;
    runes.extend(selections(style("subStyle")));
    let shard = |name: &str| {
        p.pointer(&format!("/perks/statPerks/{name}"))
            .and_then(Value::as_u64)
            .unwrap_or(0) as u32
    };
    let participant_id = match number(p, "participantId") {
        0 => index as u32 + 1,
        id => id,
    };
    Some(Participant {
        participant_id,
        puuid: text(p, "puuid"),
        champion_id,
        position: text(p, "teamPosition"),
        win: p.get("win").and_then(Value::as_bool).unwrap_or(false),
        items: std::array::from_fn(|slot| number(p, &format!("item{slot}"))),
        role_bound_item: number(p, "roleBoundItem"),
        spells: [number(p, "summoner1Id"), number(p, "summoner2Id")],
        primary_style: style("primaryStyle").map_or(0, |s| number(s, "style")),
        sub_style: style("subStyle").map_or(0, |s| number(s, "style")),
        runes,
        shards: [shard("offense"), shard("flex"), shard("defense")],
    })
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ItemEventKind {
    Purchased,
    Sold,
    Destroyed,
    Undo,
}

impl ItemEventKind {
    pub fn riot_name(self) -> &'static str {
        match self {
            Self::Purchased => "ITEM_PURCHASED",
            Self::Sold => "ITEM_SOLD",
            Self::Destroyed => "ITEM_DESTROYED",
            Self::Undo => "ITEM_UNDO",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ItemEvent {
    pub timestamp_ms: u64,
    pub kind: ItemEventKind,
    /// Zero for an undo, which names `before_id` / `after_id` instead.
    pub item_id: u32,
    pub before_id: u32,
    pub after_id: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SkillEvent {
    pub timestamp_ms: u64,
    /// 1 Q, 2 W, 3 E, 4 R.
    pub skill_slot: u32,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Events {
    pub items: Vec<ItemEvent>,
    pub skills: Vec<SkillEvent>,
}

/// Every player's purchases and skill points, by participant id, in timeline order.
pub fn events_of_timeline(timeline: &Value) -> BTreeMap<u32, Events> {
    let mut players: BTreeMap<u32, Events> = BTreeMap::new();
    let frames = timeline.pointer("/info/frames").and_then(Value::as_array);
    for event in frames
        .into_iter()
        .flatten()
        .filter_map(|frame| frame.get("events")?.as_array())
        .flatten()
    {
        let participant = number(event, "participantId");
        // Participant 0 is the game itself (turret plates, minions): not a player.
        let Some(kind) = event.get("type").and_then(Value::as_str) else {
            continue;
        };
        if participant == 0 {
            continue;
        }
        let timestamp_ms = event
            .get("timestamp")
            .and_then(Value::as_u64)
            .unwrap_or(0);
        let item_kind = match kind {
            "ITEM_PURCHASED" => Some(ItemEventKind::Purchased),
            "ITEM_SOLD" => Some(ItemEventKind::Sold),
            "ITEM_DESTROYED" => Some(ItemEventKind::Destroyed),
            "ITEM_UNDO" => Some(ItemEventKind::Undo),
            _ => None,
        };
        let entry = players.entry(participant).or_default();
        if let Some(kind) = item_kind {
            entry.items.push(ItemEvent {
                timestamp_ms,
                kind,
                item_id: number(event, "itemId"),
                before_id: number(event, "beforeId"),
                after_id: number(event, "afterId"),
            });
        } else if kind == "SKILL_LEVEL_UP"
            // A champion's evolve (Kai'Sa, Viktor) is not a skill point.
            && event.get("levelUpType").and_then(Value::as_str) == Some("NORMAL")
        {
            entry.skills.push(SkillEvent {
                timestamp_ms,
                skill_slot: number(event, "skillSlot"),
            });
        }
    }
    players
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use serde_json::json;

    pub fn participant(id: u32, champion: u32, win: bool, position: &str) -> Value {
        json!({
            "participantId": id, "puuid": format!("p{id}"), "championId": champion, "win": win, "teamPosition": position,
            "item0": 3031, "item1": 3006, "item2": 0, "item3": 0, "item4": 0, "item5": 0, "item6": 3340, "roleBoundItem": 3009,
            "summoner1Id": 4, "summoner2Id": 7,
            "perks": {
                "statPerks": { "offense": 5008, "flex": 5008, "defense": 5001 },
                "styles": [
                    { "description": "primaryStyle", "style": 8000, "selections": [{ "perk": 8005 }, { "perk": 9111 }, { "perk": 9104 }, { "perk": 8299 }] },
                    { "description": "subStyle", "style": 8300, "selections": [{ "perk": 8304 }, { "perk": 8347 }] }
                ]
            }
        })
    }

    pub fn game(id: &str, version: &str, duration: u64, participants: Vec<Value>) -> Value {
        json!({
            "metadata": { "matchId": id },
            "info": { "platformId": "BR1", "queueId": 420, "gameVersion": version, "gameCreation": 1_700_000_000_000u64, "gameDuration": duration, "participants": participants }
        })
    }

    #[test]
    fn a_match_becomes_a_participant_per_player() {
        let body = game(
            "BR1_1",
            "16.21.1.2",
            1800,
            vec![
                participant(1, 222, true, "BOTTOM"),
                participant(2, 81, false, "BOTTOM"),
            ],
        );
        let game = match_of(&body).unwrap();
        assert_eq!((game.patch.as_str(), game.queue_id, game.remake), ("16.21", 420, false));
        let first = &game.participants[0];
        assert_eq!(first.keystone(), 8005);
        assert_eq!(first.runes, vec![8005, 9111, 9104, 8299, 8304, 8347]);
        assert_eq!(first.final_items(), vec![3031, 3006, 3009], "the trinket is not kept");
        assert!(first.win && !game.participants[1].win);
    }

    #[test]
    fn a_remake_keeps_the_match_but_no_participant() {
        let short = game("BR1_2", "16.21.1", 200, vec![participant(1, 222, true, "BOTTOM")]);
        let game = match_of(&short).unwrap();
        assert!(game.remake && game.participants.is_empty());
        let mut flagged = participant(1, 222, true, "BOTTOM");
        flagged["gameEndedInEarlySurrender"] = json!(true);
        assert!(match_of(&super::tests::game("BR1_3", "16.21", 1800, vec![flagged])).unwrap().remake);
        assert!(match_of(&json!({})).is_none());
    }

    #[test]
    fn the_timeline_gives_purchases_and_normal_skill_points() {
        let timeline = json!({ "info": { "frames": [
            { "events": [
                { "type": "ITEM_PURCHASED", "participantId": 1, "timestamp": 1000, "itemId": 1055 },
                { "type": "ITEM_UNDO", "participantId": 1, "timestamp": 2000, "beforeId": 1055, "afterId": 0 },
                { "type": "SKILL_LEVEL_UP", "participantId": 1, "timestamp": 3000, "skillSlot": 1, "levelUpType": "NORMAL" },
                { "type": "SKILL_LEVEL_UP", "participantId": 1, "timestamp": 4000, "skillSlot": 1, "levelUpType": "EVOLVE" },
                { "type": "ITEM_PURCHASED", "participantId": 0, "timestamp": 5000, "itemId": 1 }
            ] }
        ] } });
        let events = events_of_timeline(&timeline);
        assert_eq!(events.len(), 1);
        let player = &events[&1];
        assert_eq!(player.items.len(), 2);
        assert_eq!(player.items[1].kind, ItemEventKind::Undo);
        assert_eq!(player.items[1].before_id, 1055);
        assert_eq!(player.skills, vec![SkillEvent { timestamp_ms: 3000, skill_slot: 1 }]);
    }
}
