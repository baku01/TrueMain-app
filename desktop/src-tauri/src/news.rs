//! Riot's patch notes, for the app's "Patch notes" page. The notes live on
//! leagueoflegends.com, which sends no CORS header, so the webview cannot read
//! them: the shell fetches the tag page of the player's language (the list of
//! patches) or one note's page, and hands back the JSON the page embeds
//! (`__NEXT_DATA__`), which the webview turns into cards and a reading view.
//! Which pages is the shell's rule: the tag page, or a game-updates page of
//! that same origin, never an address the webview makes up.

use std::time::Duration;

const ORIGIN: &str = "https://www.leagueoflegends.com";
const DATA_OPEN: &str = r#"<script id="__NEXT_DATA__" type="application/json">"#;
const DATA_CLOSE: &str = "</script>";

/// The site's folder for a language of the app (`en`, `pt-BR`); anything else reads in English.
fn locale(language: &str) -> &'static str {
    if language.eq_ignore_ascii_case("pt-br") {
        "pt-br"
    } else {
        "en-us"
    }
}

/// The JSON a Next.js page embeds, or none when the page has none.
fn extract_next_data(html: &str) -> Option<&str> {
    let start = html.find(DATA_OPEN)? + DATA_OPEN.len();
    let length = html[start..].find(DATA_CLOSE)?;
    Some(&html[start..start + length])
}

/// A note's address from the path the page lists, or none for anything that is not a game-updates page.
fn note_url(path: &str) -> Option<String> {
    let rest = path.strip_prefix('/')?;
    let (locale_part, tail) = rest.split_once('/')?;
    let known = locale_part == "pt-br" || locale_part == "en-us";
    let safe = tail.strip_prefix("news/game-updates/").is_some_and(|slug| {
        !slug.is_empty()
            && slug
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '/')
    });
    (known && safe).then(|| format!("{ORIGIN}{path}"))
}

/// The embedded JSON of Riot's patch-notes page in the player's language: the
/// list of patches, or — with the `path` the list gave — that patch's note.
#[tauri::command]
pub async fn riot_patch_notes_page(
    language: String,
    path: Option<String>,
) -> Result<String, String> {
    let url = match path {
        Some(path) => note_url(&path).ok_or_else(|| format!("{path} is not a patch note"))?,
        None => format!("{ORIGIN}/{}/news/tags/patch-notes/", locale(&language)),
    };
    let html = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent(concat!("TrueMain-Desktop/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|error| error.to_string())?
        .get(url)
        .send()
        .await
        .and_then(|response| response.error_for_status())
        .map_err(|error| error.to_string())?
        .text()
        .await
        .map_err(|error| error.to_string())?;
    extract_next_data(&html)
        .map(str::to_string)
        .ok_or_else(|| "the patch notes page carries no data".to_string())
}

/// Open one patch note in the player's browser.
#[tauri::command]
pub fn open_patch_note(app: tauri::AppHandle, path: String) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;

    let url = note_url(&path).ok_or_else(|| format!("{path} is not a patch note"))?;
    // As `open_on_site`: the path rule above is the whole guard.
    #[allow(deprecated)]
    app.shell()
        .open(url, None)
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_language_picks_the_sites_folder() {
        assert_eq!(locale("pt-BR"), "pt-br");
        assert_eq!(locale("en"), "en-us");
        assert_eq!(locale("fr"), "en-us");
    }

    #[test]
    fn the_embedded_json_is_cut_out_of_the_page() {
        let html = format!("<html>{DATA_OPEN}{{\"a\":1}}{DATA_CLOSE}</html>");
        assert_eq!(extract_next_data(&html), Some("{\"a\":1}"));
        assert_eq!(extract_next_data("<html></html>"), None);
    }

    #[test]
    fn only_a_game_updates_page_of_the_site_opens() {
        assert_eq!(
            note_url("/pt-br/news/game-updates/league-of-legends-patch-26-21-notes").as_deref(),
            Some("https://www.leagueoflegends.com/pt-br/news/game-updates/league-of-legends-patch-26-21-notes")
        );
        assert_eq!(
            note_url("https://evil.example/pt-br/news/game-updates/x"),
            None
        );
        assert_eq!(note_url("/pt-br/news/other/x"), None);
        assert_eq!(note_url("/fr-fr/news/game-updates/x"), None);
        assert_eq!(note_url("/pt-br/news/game-updates/../../x?y=1"), None);
        assert_eq!(note_url("/pt-br/news/game-updates/"), None);
    }
}
