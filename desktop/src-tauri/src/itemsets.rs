//! The item sets this app writes. A build's (#1908) — the button's and the
//! draft's automatic import alike — as Blitz writes its own: recommended-set
//! files the shop opens on in game (`write_recommended_item_sets`). A kit's
//! (#2185) into the client as the one TrueMain item set, on the player's
//! click: the rules that keep that from touching the player's own sets — the
//! whole list read right before it is written, every set not ours written
//! back as read, nothing written after a failed read — live in
//! `lcu::item_sets` and `LcuClient::import_item_set`.

use lcu::{Error, ItemSetDraft, LcuClient, NamedBlock};

use crate::record::SharedClient;

/// What the command answers when the client's list could not be read, so
/// nothing was written. Matched by the frontend.
const READ_FAILED: &str = "read-failed";

/// What the command answers when the set was written but the player's own
/// sets no longer read the same. Matched by the frontend.
const SETS_CHANGED: &str = "sets-changed";

/// What the command answers for a build with no item to write.
const EMPTY_BUILD: &str = "empty-build";

/// Write a kit's tree into the client as the TrueMain item set, one block per
/// path after the starter and the boots (#2185). Only ever called from the
/// button.
#[tauri::command]
pub async fn import_kit_item_set(
    client: tauri::State<'_, SharedClient>,
    champion_id: i64,
    champion: String,
    blocks: Vec<NamedBlock>,
) -> Result<(), String> {
    let draft = ItemSetDraft::from_blocks(&champion, champion_id, &blocks)
        .ok_or_else(|| EMPTY_BUILD.to_string())?;
    write(&client, &draft).await
}

async fn write(client: &SharedClient, draft: &ItemSetDraft) -> Result<(), String> {
    let client = client
        .read()
        .expect("client lock poisoned")
        .clone()
        .ok_or_else(|| "the League client is not running".to_string())?;

    match client.import_item_set(draft).await {
        Ok(()) => Ok(()),
        Err(Error::ItemSetsUnreadable(error)) => {
            tracing::warn!(%error, "item set import aborted: the list could not be read");
            Err(READ_FAILED.to_string())
        }
        Err(Error::PlayerItemSetsChanged) => Err(SETS_CHANGED.to_string()),
        Err(error) => {
            tracing::warn!(%error, "item set import failed");
            Err(error.to_string())
        }
    }
}

/// Our recommended sets' file names in the game's `Config/Global/Recommended`:
/// `!!!truemain-0.json` and on, sorted ahead of the game's own.
const RECOMMENDED_PREFIX: &str = "!!!truemain-";
/// The game ranks recommended sets by `sortrank`; Riot's own sit at 4 and
/// 4999, so ours start far above them, the selected build first.
const RECOMMENDED_RANK: i64 = 1_000_000_000;

/// The game's `Config/Global/Recommended` folders, where the game is: the
/// client says where it is installed (a client that does not falls back to
/// the default install), and Garena's builds keep the config in a sibling
/// `Game` folder.
async fn recommended_folders(client: &LcuClient) -> Vec<std::path::PathBuf> {
    let install = std::path::PathBuf::from(client.install_dir().await.unwrap_or_else(|_| {
        if cfg!(target_os = "macos") {
            "/Applications/League of Legends.app/Contents/LoL".to_string()
        } else {
            r"C:\Riot Games\League of Legends".to_string()
        }
    }));
    [install.join("Config"), install.join("../Game/Config")]
        .into_iter()
        .filter(|root| root.is_dir())
        .map(|root| root.join("Global").join("Recommended"))
        .collect()
}

/// Our own recommended files out of `folder` (`!!!truemain-*.json`); the
/// player's sets and other apps' files stay.
fn remove_recommended(folder: &std::path::Path) {
    if let Ok(entries) = std::fs::read_dir(folder) {
        for entry in entries.flatten() {
            let name = entry.file_name();
            let name = name.to_string_lossy();
            if name.starts_with(RECOMMENDED_PREFIX) && name.ends_with(".json") {
                let _ = std::fs::remove_file(entry.path());
            }
        }
    }
}

/// When a game ends, the item sets this app wrote for it go, as Blitz's do:
/// the TrueMain set in the account's list (`LcuClient::remove_item_sets`)
/// and the automatic import's recommended files. The next draft writes its
/// own; between games the shop lists none of ours.
pub async fn clear_after_game(client: std::sync::Arc<LcuClient>) {
    match client.remove_item_sets().await {
        Ok(removed) => tracing::debug!(removed, "item set cleared after the game"),
        Err(error) => tracing::warn!(%error, "could not clear the item set after the game"),
    }
    for folder in recommended_folders(&client).await {
        remove_recommended(&folder);
    }
}

/// The automatic import's item sets (`useDraftAutoImport`), written the way
/// Blitz writes its own: as recommended-set files in the game's
/// `Config/Global/Recommended`, so the shop opens on them in game — the build
/// selected in the draft first, the champion's other builds after it. Each
/// set is the client's item set JSON (title, `championKey`, blocks); this
/// fills in its rank. Only our own files (`!!!truemain-*.json`) are ever
/// removed; the player's sets and other apps' files are left alone.
#[tauri::command]
pub async fn write_recommended_item_sets(
    client: tauri::State<'_, SharedClient>,
    sets: Vec<serde_json::Value>,
) -> Result<(), String> {
    let client = client
        .read()
        .expect("client lock poisoned")
        .clone()
        .ok_or_else(|| "the League client is not running".to_string())?;
    let mut written = false;
    for folder in recommended_folders(&client).await {
        std::fs::create_dir_all(&folder).map_err(|error| error.to_string())?;
        remove_recommended(&folder);
        for (index, set) in sets.iter().enumerate() {
            let mut set = set.clone();
            if let Some(object) = set.as_object_mut() {
                object.insert("priority".into(), serde_json::Value::Bool(index == 0));
                object.insert(
                    "sortrank".into(),
                    serde_json::Value::from(RECOMMENDED_RANK - index as i64),
                );
            }
            let path = folder.join(format!("{RECOMMENDED_PREFIX}{index}.json"));
            std::fs::write(
                &path,
                serde_json::to_vec(&set).map_err(|error| error.to_string())?,
            )
            .map_err(|error| error.to_string())?;
        }
        written = true;
    }
    if written {
        Ok(())
    } else {
        Err("no game config folder in the League install".to_string())
    }
}
