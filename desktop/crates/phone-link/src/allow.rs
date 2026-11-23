//! What a paired phone may ask the desktop, and which events it receives.
//!
//! Exactly what the phone app uses, nothing else. The client's API reaches the
//! player's chat, friends' presence, store and account; a phone lost or lent,
//! or a phone app with a bug, must not. A new screen on the phone that needs
//! an endpoint adds it here, in a desktop release that ships before the phone's.
//!
//! Patterns are written segment by segment: a literal, `{n}` an integer,
//! `{s}` any one segment, `{a|b}` one of the alternatives.

/// `(methods, pattern)`.
const REQUESTS: &[(&str, &str)] = &[
    // the desktop's own routes (`connector`), not the client's
    ("GET", "/truemain/state"),
    ("GET", "/truemain/game"),
    // the app's theme, so the phone draws in the colours the player chose
    ("GET", "/truemain/theme"),
    // a rune page imported the way the app imports its own (`lcu::runes::plan_import`):
    // it reuses the app's page and never removes a page the client generated
    ("POST", "/truemain/runes"),
    // the player
    ("GET", "/lol-summoner/v1/current-summoner"),
    ("GET", "/lol-summoner/v2/summoners"),
    ("GET", "/lol-ranked/v1/current-ranked-stats"),
    ("GET", "/lol-match-history/v1/products/lol/current-summoner/matches"),
    ("GET", "/lol-match-history/v1/games/{n}"),
    // queues and the lobby
    ("GET", "/lol-gameflow/v1/{session|gameflow-phase}"),
    ("GET", "/lol-game-queues/v1/queues"),
    ("GET|POST|DELETE", "/lol-lobby/v2/lobby"),
    ("PUT", "/lol-lobby/v2/lobby/members/localMember/position-preferences"),
    ("POST|DELETE", "/lol-lobby/v2/lobby/matchmaking/search"),
    ("POST", "/lol-lobby/v2/lobby/invitations"),
    ("POST", "/lol-lobby/v2/lobby/members/{n}/kick"),
    ("GET", "/lol-lobby/v2/received-invitations"),
    ("POST", "/lol-lobby/v2/received-invitations/{s}/{accept|decline}"),
    ("GET", "/lol-chat/v1/friends"),
    // the match found
    ("GET", "/lol-matchmaking/v1/search"),
    ("GET", "/lol-matchmaking/v1/ready-check"),
    ("POST", "/lol-matchmaking/v1/ready-check/{accept|decline}"),
    // champion select
    ("GET", "/lol-champ-select/v1/session"),
    ("PATCH", "/lol-champ-select/v1/session/actions/{n}"),
    ("POST", "/lol-champ-select/v1/session/actions/{n}/complete"),
    ("GET", "/lol-champ-select/v1/{pickable-champion-ids|bannable-champion-ids|current-champion|skin-carousel-skins}"),
    ("PATCH", "/lol-champ-select/v1/session/my-selection"),
    ("POST", "/lol-champ-select/v1/session/my-selection/reroll"),
    ("POST", "/lol-champ-select/v1/session/bench/swap/{n}"),
    ("POST", "/lol-champ-select/v1/session/{trades|position-swaps|pick-order-swaps}/{n}/{request|accept|decline|cancel}"),
    // runes
    ("GET", "/lol-perks/v1/{pages|currentpage|inventory|styles|perks}"),
    ("POST", "/lol-perks/v1/pages"),
    ("PUT|DELETE", "/lol-perks/v1/pages/{n}"),
    ("PUT", "/lol-perks/v1/currentpage"),
    ("GET", "/lol-perks/v1/recommended-pages/champion/{n}/position/{s}/map/{n}"),
    // the game in progress, read off the game's own API on the desktop
    ("GET", "/liveclientdata/{allgamedata|activeplayer|playerlist|eventdata|gamestats}"),
];

/// The client events a phone follows, and the desktop's own (`/truemain/*`).
pub const EVENTS: &[&str] = &[
    "/truemain/state",
    "/truemain/game",
    "/truemain/theme",
    "/lol-gameflow/v1/gameflow-phase",
    "/lol-gameflow/v1/session",
    "/lol-lobby/v2/lobby",
    "/lol-lobby/v2/received-invitations",
    "/lol-matchmaking/v1/search",
    "/lol-matchmaking/v1/ready-check",
    "/lol-champ-select/v1/session",
    "/lol-champ-select/v1/current-champion",
    "/lol-champ-select/v1/pickable-champion-ids",
    "/lol-perks/v1/pages",
    "/lol-perks/v1/currentpage",
];

/// The client endpoints among `EVENTS`, the ones the connector subscribes to.
pub fn client_events() -> impl Iterator<Item = &'static str> {
    EVENTS
        .iter()
        .copied()
        .filter(|uri| uri.starts_with("/lol-"))
}

pub fn is_allowed_event(uri: &str) -> bool {
    EVENTS.contains(&uri)
}

pub fn is_allowed_request(method: &str, path: &str) -> bool {
    let Some(path) = normalize(path) else {
        return false;
    };
    let method = method.to_ascii_uppercase();
    REQUESTS
        .iter()
        .any(|(methods, pattern)| methods.split('|').any(|m| m == method) && matches(pattern, path))
}

/// The path without its query, or `None` if it tries to leave its segment:
/// `.`/`..`, an encoded slash or backslash, an empty segment, a control character.
pub fn normalize(raw: &str) -> Option<&str> {
    if !raw.starts_with('/') || raw.len() > 2048 {
        return None;
    }
    let path = raw.split(['?', '#']).next().unwrap_or_default();
    if path.chars().any(|c| c.is_control() || c == '\\') {
        return None;
    }
    for segment in path.split('/').skip(1) {
        let lower = segment.to_ascii_lowercase();
        let decoded = lower.replace("%2e", ".");
        if segment.is_empty()
            || decoded == "."
            || decoded == ".."
            || lower.contains("%2f")
            || lower.contains("%5c")
            || lower.contains("%00")
        {
            return None;
        }
    }
    Some(path)
}

fn matches(pattern: &str, path: &str) -> bool {
    let mut wanted = pattern.split('/');
    let mut given = path.split('/');
    loop {
        match (wanted.next(), given.next()) {
            (None, None) => return true,
            (Some(want), Some(got)) if segment_matches(want, got) => {}
            _ => return false,
        }
    }
}

fn segment_matches(want: &str, got: &str) -> bool {
    match want {
        "{n}" => {
            let digits = got.strip_prefix('-').unwrap_or(got);
            !digits.is_empty() && digits.len() <= 20 && digits.bytes().all(|b| b.is_ascii_digit())
        }
        "{s}" => !got.is_empty(),
        _ => match want.strip_prefix('{').and_then(|w| w.strip_suffix('}')) {
            Some(alternatives) => alternatives.split('|').any(|a| a == got),
            None => want == got,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_what_the_phone_uses() {
        assert!(is_allowed_request("GET", "/lol-champ-select/v1/session"));
        assert!(is_allowed_request(
            "patch",
            "/lol-champ-select/v1/session/actions/12"
        ));
        assert!(is_allowed_request(
            "POST",
            "/lol-champ-select/v1/session/trades/3/accept"
        ));
        assert!(is_allowed_request(
            "POST",
            "/lol-matchmaking/v1/ready-check/accept"
        ));
        assert!(is_allowed_request(
            "GET",
            "/lol-perks/v1/recommended-pages/champion/103/position/middle/map/11"
        ));
        assert!(is_allowed_request(
            "GET",
            "/lol-match-history/v1/products/lol/current-summoner/matches?begIndex=0&endIndex=20"
        ));
        assert!(is_allowed_request("DELETE", "/lol-perks/v1/pages/-4"));
        assert!(is_allowed_request("GET", "/liveclientdata/allgamedata"));
        assert!(is_allowed_request("POST", "/truemain/runes"));
    }

    #[test]
    fn refuses_everything_else() {
        assert!(!is_allowed_request("GET", "/lol-chat/v1/conversations"));
        assert!(!is_allowed_request(
            "DELETE",
            "/lol-champ-select/v1/session"
        ));
        assert!(!is_allowed_request("GET", "/riotclient/auth-token"));
        assert!(!is_allowed_request(
            "GET",
            "/lol-champ-select/v1/session/actions/abc"
        ));
        assert!(!is_allowed_request(
            "POST",
            "/lol-champ-select/v1/session/trades/3/steal"
        ));
        assert!(!is_allowed_request(
            "GET",
            "lol-summoner/v1/current-summoner"
        ));
        assert!(!is_allowed_request("GET", "/liveclientdata/../lol-chat"));
    }

    #[test]
    fn refuses_paths_that_escape_their_segment() {
        assert!(!is_allowed_request(
            "POST",
            "/lol-lobby/v2/received-invitations/..%2f..%2friotclient/accept"
        ));
        assert!(!is_allowed_request(
            "POST",
            "/lol-lobby/v2/received-invitations/%2e%2e/accept"
        ));
        assert!(!is_allowed_request("GET", "/lol-champ-select/v1//session"));
        assert!(!is_allowed_request("GET", "/lol-champ-select\\v1/session"));
        assert!(!is_allowed_request("GET", "/lol-champ-select/v1/session\n"));
    }

    #[test]
    fn follows_only_the_listed_events() {
        assert!(is_allowed_event("/lol-champ-select/v1/session"));
        assert!(!is_allowed_event("/lol-chat/v1/conversations/abc/messages"));
        assert!(client_events().all(|uri| uri.starts_with("/lol-")));
        assert_eq!(
            client_events().count(),
            EVENTS
                .iter()
                .filter(|u| !u.starts_with("/truemain/"))
                .count()
        );
        assert!(
            is_allowed_event("/truemain/theme") && is_allowed_request("GET", "/truemain/theme")
        );
    }
}
