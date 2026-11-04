//! Pushing a rune page into the client.
//!
//! One of the places this app **writes** to the client (with the item set,
//! `item_sets`, and champion select, `champ_select`), so it carries its own
//! boundaries:
//!
//! * it runs on an explicit user click, or — when the player turns it on in
//!   Settings — once at their own lock-in (`useDraftAutoImport`), the way the
//!   major companion apps do. Never on a hover, never a pick or a queue
//!   accepted for them: the player still makes every decision;
//! * it reuses its own page; when the list is full and none of it is ours, it
//!   frees a slot the way Blitz does, as the player chose (2026-11-04): an
//!   invalid page first, else the one modified longest ago — never a page the
//!   client generates itself, which cannot be removed.

use serde::{Deserialize, Serialize};

/// Marks the one page this app owns, so it can be reused across games instead
/// of accumulating a new page every draft.
pub const OWNED_PAGE_PREFIX: &str = "TrueMain: ";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunePage {
    pub id: i64,
    #[serde(default)]
    pub name: String,
    /// False for the pages the client generates itself, which cannot be removed.
    #[serde(default)]
    pub is_deletable: bool,
    /// False for a page the client no longer accepts (a rune removed by a patch).
    #[serde(default = "valid")]
    pub is_valid: bool,
    /// When the page was last changed, in milliseconds: the least used is the oldest.
    #[serde(default)]
    pub last_modified: i64,
}

fn valid() -> bool {
    true
}

impl RunePage {
    /// Whether this app created the page.
    ///
    /// Name-based because the client gives us nothing else to mark a page with;
    /// a player who renames one of their own pages to match takes it over, which
    /// is a deliberate act and the only false positive available.
    pub fn is_ours(&self) -> bool {
        self.name.starts_with(OWNED_PAGE_PREFIX)
    }
}

/// The page to send to the client.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunePageDraft {
    pub name: String,
    pub primary_style_id: i64,
    pub sub_style_id: i64,
    /// Perk ids, in the client's slot order. The client knows perks only by id;
    /// there is no name it would accept.
    pub selected_perk_ids: Vec<i64>,
}

/// What to do before creating the new page.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RuneImportPlan {
    /// Room to spare: create the page outright.
    Create,
    /// Our previous page exists; delete it and create the new one in its place.
    ReplaceOwn { page_id: i64 },
    /// The list is full and none of it is ours: the player's least used page
    /// (an invalid one first, else the one modified longest ago) makes room.
    ReplaceLeastUsed { page_id: i64 },
    /// The list is full of pages nobody can delete.
    NoSlotAvailable,
}

/// Decide what the import has to do, given the pages that exist.
///
/// Separated from the requests so the rule that protects the player's own pages
/// is covered by tests rather than by a comment.
pub fn plan_import(pages: &[RunePage], max_pages: usize) -> RuneImportPlan {
    if let Some(ours) = pages
        .iter()
        .find(|page| page.is_ours() && page.is_deletable)
    {
        return RuneImportPlan::ReplaceOwn { page_id: ours.id };
    }

    // Only editable pages count against the limit; the client's own generated
    // pages sit in the list without occupying a slot the player can free.
    let used = pages.iter().filter(|page| page.is_deletable).count();
    if used < max_pages {
        return RuneImportPlan::Create;
    }
    pages
        .iter()
        .filter(|page| page.is_deletable)
        .min_by_key(|page| (page.is_valid, page.last_modified))
        .map_or(RuneImportPlan::NoSlotAvailable, |page| {
            RuneImportPlan::ReplaceLeastUsed { page_id: page.id }
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn page(id: i64, name: &str, deletable: bool) -> RunePage {
        RunePage {
            id,
            name: name.to_string(),
            is_deletable: deletable,
            is_valid: true,
            last_modified: id,
        }
    }

    #[test]
    fn creates_a_page_when_there_is_room() {
        let pages = vec![page(1, "My Ahri", true)];
        assert_eq!(plan_import(&pages, 5), RuneImportPlan::Create);
    }

    #[test]
    fn reuses_our_own_page_instead_of_accumulating_one_per_game() {
        let pages = vec![page(1, "My Ahri", true), page(2, "TrueMain: Ahri", true)];
        assert_eq!(
            plan_import(&pages, 5),
            RuneImportPlan::ReplaceOwn { page_id: 2 }
        );
    }

    #[test]
    fn reuses_our_page_even_when_the_list_is_full() {
        let pages = vec![
            page(1, "My Ahri", true),
            page(2, "TrueMain: Ahri", true),
            page(3, "Jungle", true),
        ];
        assert_eq!(
            plan_import(&pages, 3),
            RuneImportPlan::ReplaceOwn { page_id: 2 }
        );
    }

    #[test]
    fn a_full_list_frees_the_page_modified_longest_ago() {
        // As Blitz does: the player's least used page makes room.
        let mut old = page(1, "My Ahri", true);
        old.last_modified = 100;
        let mut recent = page(2, "Jungle", true);
        recent.last_modified = 900;
        assert_eq!(
            plan_import(&[recent, old], 2),
            RuneImportPlan::ReplaceLeastUsed { page_id: 1 }
        );
    }

    #[test]
    fn an_invalid_page_goes_before_any_valid_one() {
        let mut broken = page(2, "Old patch", true);
        broken.is_valid = false;
        broken.last_modified = 999;
        assert_eq!(
            plan_import(&[page(1, "My Ahri", true), broken], 2),
            RuneImportPlan::ReplaceLeastUsed { page_id: 2 }
        );
    }

    #[test]
    fn pages_nobody_can_delete_leave_no_slot() {
        assert_eq!(
            plan_import(&[page(1, "Recommended", false)], 0),
            RuneImportPlan::NoSlotAvailable
        );
    }

    #[test]
    fn the_clients_own_undeletable_pages_do_not_use_up_the_budget() {
        // Champion-recommended pages appear in the list but are not the
        // player's to free; counting them would make us refuse with slots left.
        let pages = vec![page(1, "Recommended", false), page(2, "My Ahri", true)];
        assert_eq!(plan_import(&pages, 2), RuneImportPlan::Create);
    }

    #[test]
    fn a_page_of_ours_that_cannot_be_deleted_is_not_treated_as_reusable() {
        let pages = vec![page(1, "TrueMain: Ahri", false)];
        assert_eq!(plan_import(&pages, 1), RuneImportPlan::Create);
    }

    #[test]
    fn recognises_only_our_own_prefix() {
        assert!(page(1, "TrueMain: Ahri", true).is_ours());
        assert!(!page(1, "truemain ahri", true).is_ours());
        assert!(!page(1, "My TrueMain page", true).is_ours());
    }
}
