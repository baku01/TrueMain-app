//! How often the running game is read.
//!
//! The request itself is `lcu::LiveClient::all_game_data`, the one client the
//! app has for the game's API (shared with the game recording, #1744).

use std::time::Duration;

/// How often the game is read while it answers.
///
/// The board moves at most a few times a minute — a purchase, a level, a
/// death — but the in-game tips say what such a moment means while it still
/// matters: the enemy jungler just seen (his items move on the scoreboard only
/// in sight), a level 2 reached first, a lane opponent down. Half a second
/// keeps them under a second late, as ABSOL's coach (0.4 s) does; a reading
/// that moved nothing sends the clock alone, and the request is a loopback one.
pub const POLL: Duration = Duration::from_millis(500);

/// The longest wait between two attempts while the game does not answer.
///
/// It does not answer until the game process is up, and is expected to answer
/// errors or a game with no players while the loading screen lasts (one to
/// three minutes). Backing off spares a loopback port little; the ceiling is
/// what matters: the board appears at most this long after the game has
/// loaded.
const MAX_BACKOFF: Duration = Duration::from_secs(5);

/// The wait before the next reading, after `failures` attempts in a row that
/// got no game: the poll interval while the game answers, doubling from there
/// up to [`MAX_BACKOFF`] while it does not.
pub fn next_poll(failures: u32) -> Duration {
    let doublings = failures.saturating_sub(1).min(8);
    POLL.saturating_mul(1 << doublings).min(MAX_BACKOFF)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn polls_at_the_interval_while_the_game_answers() {
        assert_eq!(next_poll(0), POLL);
    }

    #[test]
    fn backs_off_while_the_game_does_not_answer_up_to_a_ceiling() {
        assert_eq!(next_poll(1), Duration::from_millis(500));
        assert_eq!(next_poll(2), Duration::from_secs(1));
        assert_eq!(next_poll(4), Duration::from_secs(4));
        assert_eq!(next_poll(5), MAX_BACKOFF);
        assert_eq!(next_poll(u32::MAX), MAX_BACKOFF);
    }
}
