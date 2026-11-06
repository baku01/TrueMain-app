//! The lobby of a queue with no champion select (Swiftplay), where the player
//! picks their champions before matchmaking: one per lane they queue for.
//!
//! The client keeps those picks in the lobby itself (`/lol-lobby/v2/lobby`,
//! `localMember.playerSlots`), each with its lane, its summoner spells and its
//! rune page — the game reads them from there, as there is no draft to read
//! them from. The app follows the lobby to show both champions' builds, and
//! writes a slot back only on the player's click
//! (`/lol-lobby/v1/lobby/members/localMember/player-slots`), the same write
//! Blitz's lobby builds make.

use serde::{Deserialize, Serialize};

/// `GET /lol-lobby/v2/lobby`, reduced to what the lobby screen reads.
///
/// The rest of the lobby — the other members, their puuids and names — has
/// no reason to be kept, and a tape records this model at attach rather than
/// the raw body.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Lobby {
    pub game_config: LobbyGameConfig,
    pub local_member: LobbyMember,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct LobbyGameConfig {
    pub queue_id: i64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct LobbyMember {
    /// Empty in every queue with a champion select: only a queue without one
    /// asks for the champions in the lobby.
    pub player_slots: Vec<PlayerSlot>,
}

/// One of the player's picks. Only the champion and the lane are read: the
/// spells and the rune page are written, never shown.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PlayerSlot {
    /// Zero (or below) while the slot is empty.
    pub champion_id: i64,
    pub position_preference: String,
}

/// What the lobby screen needs: the player's picks, in slot order.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LobbyState {
    pub queue_id: i64,
    pub slots: Vec<LobbySlot>,
}

/// One pick, as the screen draws it.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LobbySlot {
    /// `None` for an empty slot rather than `0`, so the screen draws an
    /// unknown champion instead of looking up champion zero.
    pub champion_id: Option<i64>,
    /// Upper-case lane (`MIDDLE`), empty while none is picked.
    pub position: String,
}

impl Lobby {
    /// The picks, or `None` in a lobby with none — every queue with a
    /// champion select, whose screen is the draft.
    pub fn lobby_state(&self) -> Option<LobbyState> {
        let slots = &self.local_member.player_slots;
        if slots.is_empty() {
            return None;
        }
        Some(LobbyState {
            queue_id: self.game_config.queue_id,
            slots: slots
                .iter()
                .map(|slot| LobbySlot {
                    champion_id: (slot.champion_id > 0).then_some(slot.champion_id),
                    position: slot.position_preference.to_uppercase(),
                })
                .collect(),
        })
    }
}

/// One change to one slot, from one of the lobby screen's buttons. A field
/// left out keeps what the client has.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SlotPatch {
    pub champion_id: Option<i64>,
    pub position: Option<String>,
    pub spell1: Option<i64>,
    pub spell2: Option<i64>,
    /// The rune page as the client keeps it on a slot: a JSON document in a
    /// string (`{"perkIds":[…],"perkStyle":…,"perkSubStyle":…}`).
    pub perks: Option<String>,
}

/// The player's slots with `patch` applied to the one at `index`; `None` when
/// there is no such slot (the lobby changed queue, or was left).
///
/// The client only takes the whole list, so every other field of every slot
/// is written back as it was read: a field this app does not know must
/// survive the write. A new champion is put in its default skin, unless the
/// slot's skin is already one of that champion's (a skin's id is its
/// champion's times a thousand, plus its number).
pub fn patch_player_slots(
    slots: &[serde_json::Value],
    index: usize,
    patch: &SlotPatch,
) -> Option<Vec<serde_json::Value>> {
    let mut slots = slots.to_vec();
    let slot = slots.get_mut(index)?.as_object_mut()?;
    if let Some(champion_id) = patch.champion_id {
        let skin_id = slot
            .get("skinId")
            .and_then(serde_json::Value::as_i64)
            .unwrap_or(0);
        slot.insert("championId".to_string(), champion_id.into());
        if skin_id / 1000 != champion_id {
            slot.insert("skinId".to_string(), (champion_id * 1000).into());
        }
    }
    if let Some(position) = &patch.position {
        slot.insert(
            "positionPreference".to_string(),
            position.to_uppercase().into(),
        );
    }
    if let Some(spell1) = patch.spell1 {
        slot.insert("spell1".to_string(), spell1.into());
    }
    if let Some(spell2) = patch.spell2 {
        slot.insert("spell2".to_string(), spell2.into());
    }
    if let Some(perks) = &patch.perks {
        slot.insert("perks".to_string(), perks.clone().into());
    }
    Some(slots)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn swiftplay() -> serde_json::Value {
        serde_json::json!({
            "gameConfig": { "queueId": 480, "showPositionSelector": true },
            "localMember": {
                "puuid": "a-player",
                "playerSlots": [
                    { "championId": 103, "positionPreference": "middle", "skinId": 103004, "spell1": 4, "spell2": 14, "perks": "" },
                    { "championId": 0, "positionPreference": "JUNGLE", "skinId": 0, "spell1": 11, "spell2": 4, "perks": "" }
                ]
            },
            "members": [{ "puuid": "someone-else" }]
        })
    }

    #[test]
    fn a_swiftplay_lobby_lists_the_players_picks_in_slot_order() {
        let lobby: Lobby = serde_json::from_value(swiftplay()).unwrap();
        assert_eq!(
            lobby.lobby_state(),
            Some(LobbyState {
                queue_id: 480,
                slots: vec![
                    LobbySlot {
                        champion_id: Some(103),
                        position: "MIDDLE".into(),
                    },
                    LobbySlot {
                        champion_id: None,
                        position: "JUNGLE".into(),
                    },
                ],
            }),
            "lanes are upper-case and an empty slot is unknown, not champion zero"
        );
    }

    #[test]
    fn a_lobby_with_a_champion_select_has_no_picks() {
        let lobby: Lobby = serde_json::from_value(serde_json::json!({
            "gameConfig": { "queueId": 420 },
            "localMember": { "playerSlots": [] }
        }))
        .unwrap();
        assert_eq!(lobby.lobby_state(), None);
    }

    #[test]
    fn a_left_lobby_reads_as_none() {
        // The client deletes the endpoint with a `null` body.
        assert!(serde_json::from_value::<Lobby>(serde_json::Value::Null).is_err());
    }

    fn slots() -> Vec<serde_json::Value> {
        swiftplay()["localMember"]["playerSlots"]
            .as_array()
            .cloned()
            .unwrap()
    }

    #[test]
    fn a_patch_changes_its_slot_only_and_keeps_every_other_field() {
        let patch = SlotPatch {
            spell1: Some(14),
            spell2: Some(4),
            perks: Some(r#"{"perkIds":[8112],"perkStyle":8100,"perkSubStyle":8200}"#.into()),
            ..SlotPatch::default()
        };
        let written = patch_player_slots(&slots(), 0, &patch).unwrap();
        assert_eq!(written[0]["spell1"], 14);
        assert_eq!(written[0]["spell2"], 4);
        assert_eq!(
            written[0]["perks"],
            r#"{"perkIds":[8112],"perkStyle":8100,"perkSubStyle":8200}"#
        );
        assert_eq!(written[0]["championId"], 103, "the champion stays");
        assert_eq!(written[0]["skinId"], 103004, "and so does its skin");
        assert_eq!(written[1], slots()[1], "the other slot is written as read");
    }

    #[test]
    fn a_new_champion_takes_its_default_skin_and_its_own_lane_upper_case() {
        let patch = SlotPatch {
            champion_id: Some(64),
            position: Some("jungle".into()),
            ..SlotPatch::default()
        };
        let written = patch_player_slots(&slots(), 1, &patch).unwrap();
        assert_eq!(written[1]["championId"], 64);
        assert_eq!(written[1]["skinId"], 64000);
        assert_eq!(written[1]["positionPreference"], "JUNGLE");

        // The same champion again keeps the skin the player chose for it.
        let same = SlotPatch {
            champion_id: Some(103),
            ..SlotPatch::default()
        };
        assert_eq!(
            patch_player_slots(&slots(), 0, &same).unwrap()[0]["skinId"],
            103004
        );
    }

    #[test]
    fn a_slot_that_is_not_there_is_not_written() {
        assert!(patch_player_slots(&slots(), 2, &SlotPatch::default()).is_none());
        assert!(patch_player_slots(&[], 0, &SlotPatch::default()).is_none());
    }
}
