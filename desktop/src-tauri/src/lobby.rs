//! The lobby builds' writes (Swiftplay): a slot's champion, lane, summoner
//! spells or rune page, each from its own button and only from it.
//!
//! The client takes the player's whole list of slots, so each write reads it
//! right before and changes only what the button names
//! (`lcu::lobby::patch_player_slots`). As in champion select, a champion is
//! checked against the client's own list first. Nothing here runs on a timer,
//! a phase change or a build arriving. A tape replay is read-only.

use lcu::SlotPatch;

use crate::record::SharedClient;

/// What the command answers for a champion the client does not offer the
/// player. Matched by the frontend.
const NOT_PICKABLE: &str = "not-pickable";
/// The slot is gone: the lobby changed queue, or was left. Matched by the
/// frontend.
const NO_SLOT: &str = "no-slot";

/// The champions the player may put in a slot, for the picker. `None` when
/// the client did not answer — unknown, not empty: the write checks again.
#[tauri::command]
pub async fn lobby_choices(
    client: tauri::State<'_, SharedClient>,
) -> Result<Option<Vec<i64>>, String> {
    if crate::supervisor::replaying() {
        return Ok(None);
    }
    let client = crate::record::attached(&client)?;
    Ok(client
        .grid_champions()
        .await
        .inspect_err(|error| tracing::debug!(%error, "no lobby champions"))
        .ok())
}

/// Change the slot at `slot` as `patch` says, every other field and slot
/// written back as the client has them.
#[tauri::command]
pub async fn lobby_slot_set(
    client: tauri::State<'_, SharedClient>,
    slot: usize,
    patch: SlotPatch,
) -> Result<(), String> {
    if crate::supervisor::replaying() {
        return Err("a replay cannot be written to".to_string());
    }
    if let (Some(spell1), Some(spell2)) = (patch.spell1, patch.spell2) {
        if spell1 <= 0 || spell2 <= 0 || spell1 == spell2 {
            return Err("a build needs two different spells".to_string());
        }
    }
    if let Some(perks) = &patch.perks {
        if serde_json::from_str::<serde_json::Value>(perks).is_err() {
            return Err("this rune page is incomplete".to_string());
        }
    }
    let client = crate::record::attached(&client)?;
    if let Some(champion_id) = patch.champion_id {
        // A list the client did not answer is no proof either way: the
        // client refuses a champion the player cannot play on its own.
        if let Ok(pickable) = client.grid_champions().await {
            if !pickable.contains(&champion_id) {
                return Err(NOT_PICKABLE.to_string());
            }
        }
    }
    let slots = client
        .lobby_player_slots()
        .await
        .map_err(|error| error.to_string())?;
    let written =
        lcu::lobby::patch_player_slots(&slots, slot, &patch).ok_or_else(|| NO_SLOT.to_string())?;
    client.set_player_slots(&written).await.map_err(|error| {
        tracing::warn!(%error, "lobby slot write failed");
        error.to_string()
    })
}
