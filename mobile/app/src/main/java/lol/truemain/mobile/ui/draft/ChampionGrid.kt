package lol.truemain.mobile.ui.draft

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import java.text.Normalizer
import kotlinx.coroutines.delay
import lol.truemain.mobile.R
import lol.truemain.mobile.data.Champion
import lol.truemain.mobile.data.GameData
import lol.truemain.mobile.lcu.int
import lol.truemain.mobile.lcu.items
import lol.truemain.mobile.link.LinkUnavailable
import lol.truemain.mobile.session.Session
import lol.truemain.mobile.ui.builds.SelectChip
import lol.truemain.mobile.ui.components.ChampionIcon
import lol.truemain.mobile.ui.components.Eyebrow
import lol.truemain.mobile.ui.components.Loading
import lol.truemain.mobile.ui.components.Panel
import lol.truemain.mobile.ui.components.TmSearchField
import lol.truemain.mobile.ui.theme.Tm

/** Data Dragon's class tags (always English keys, whatever the language) and how the chips name them. */
private val TAGS = listOf(
    "Fighter" to R.string.draft_tag_fighter,
    "Tank" to R.string.draft_tag_tank,
    "Mage" to R.string.draft_tag_mage,
    "Assassin" to R.string.draft_tag_assassin,
    "Marksman" to R.string.draft_tag_marksman,
    "Support" to R.string.draft_tag_support,
)

/**
 * The champions for the action a tap writes to. A tap only hovers (the
 * client's own click does the same); locking or banning is a separate button,
 * behind a confirmation, and only while the turn is really open.
 */
@Composable
fun ChampionPicker(draft: Draft, target: Action, data: GameData?, actions: DraftActions) {
    val pickable by actions.session.state(Session.PICKABLE).collectAsState()
    val bannable = rememberBannable(actions.session, target, draft.taken.size)
    // The client's own list wins; without one, everything not already taken. An empty list is
    // no list: no turn leaves nothing to pick or ban, and trusting one locked the whole grid.
    val allowed: Set<Int>? = when (target.kind) {
        ActionKind.Pick -> pickable?.items?.mapNotNull { it.int }?.toSet()
        ActionKind.Ban -> bannable
    }?.takeIf { it.isNotEmpty() }
    var query by rememberSaveable { mutableStateOf("") }
    var tag by rememberSaveable { mutableStateOf<String?>(null) }
    var confirming by remember { mutableStateOf(false) }
    val planning = draft.current == null
    // In planning the client may keep the intent on the seat rather than on the action.
    val hovered = target.championId.takeIf { it > 0 } ?: draft.me?.pickIntent?.takeIf { planning && it > 0 }

    Panel {
        Eyebrow(
            stringResource(
                when {
                    planning -> R.string.draft_choose_intent
                    target.kind == ActionKind.Ban -> R.string.draft_choose_ban
                    else -> R.string.draft_choose_pick
                },
            ),
        )
        if (data == null) {
            Loading()
            return@Panel
        }
        TmSearchField(
            value = query,
            onValueChange = { query = it },
            placeholder = stringResource(R.string.draft_search),
        )
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            SelectChip(stringResource(R.string.draft_tag_all), tag == null) { tag = null }
            TAGS.forEach { (key, label) -> SelectChip(stringResource(label), tag == key) { tag = if (tag == key) null else key } }
        }
        val taken = draft.taken
        val isAllowed = { id: Int -> allowed?.contains(id) ?: (id == hovered || id !in taken) }
        val shown = remember(data, query, tag, allowed, taken, hovered) {
            val needle = query.fold()
            data.champions.values
                .filter { tag == null || tag in it.tags }
                .filter { needle.isEmpty() || it.name.fold().contains(needle) }
                .sortedWith(compareBy<Champion>({ !isAllowed(it.id) }, { it.name }))
        }
        if (shown.isEmpty()) {
            Text(stringResource(R.string.draft_no_match), color = Tm.Ink400, style = MaterialTheme.typography.bodyMedium)
        } else {
            LazyVerticalGrid(
                columns = GridCells.Adaptive(64.dp),
                modifier = Modifier.fillMaxWidth().height(300.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                items(shown, key = { it.id }) { champion ->
                    val enabled = isAllowed(champion.id)
                    ChampionTile(champion, selected = champion.id == hovered, available = enabled, clickable = enabled && !actions.busy) {
                        if (champion.id != hovered) actions.hover(target, champion.id)
                    }
                }
            }
        }
        if (planning) {
            Text(stringResource(R.string.draft_intent_note), color = Tm.Ink400, style = MaterialTheme.typography.bodySmall)
        } else {
            val ban = target.kind == ActionKind.Ban
            Button(
                shape = Tm.ButtonShape,
                onClick = { confirming = true },
                enabled = hovered != null && isAllowed(hovered) && !actions.busy,
                colors = ButtonDefaults.buttonColors(containerColor = if (ban) Tm.Red else Tm.Rose400, contentColor = Tm.colors.textInverted),
                modifier = Modifier.fillMaxWidth().height(48.dp),
            ) {
                Text(
                    when {
                        hovered == null -> stringResource(R.string.draft_hover_first)
                        ban -> stringResource(R.string.draft_ban_named, data.championName(hovered))
                        else -> stringResource(R.string.draft_lock_named, data.championName(hovered))
                    },
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }

    if (confirming && hovered != null) {
        val ban = target.kind == ActionKind.Ban
        val name = data?.championName(hovered).orEmpty()
        AlertDialog(
            onDismissRequest = { confirming = false },
            icon = { ChampionIcon(hovered, 56.dp) },
            title = { Text(stringResource(if (ban) R.string.draft_confirm_ban_title else R.string.draft_confirm_lock_title, name)) },
            text = { Text(stringResource(if (ban) R.string.draft_confirm_ban_body else R.string.draft_confirm_lock_body)) },
            confirmButton = {
                TextButton(
                    shape = Tm.ButtonShape,
                    onClick = {
                        confirming = false
                        // The session may have moved on while the dialog was open: complete only the open
                        // action, and only while it still shows the champion the player confirmed.
                        val open = draft.current?.takeIf { it.id == target.id && it.championId == hovered }
                        if (open != null) actions.complete(open) else actions.say(R.string.draft_error_lock)
                    },
                    enabled = !actions.busy,
                ) { Text(stringResource(if (ban) R.string.draft_ban else R.string.draft_lock), color = if (ban) Tm.Red else Tm.Rose400) }
            },
            dismissButton = { TextButton(shape = Tm.ButtonShape, onClick = { confirming = false }) { Text(stringResource(R.string.draft_cancel), color = Tm.Ink300) } },
            containerColor = Tm.Ink900,
        )
    }
}

/**
 * The client's bannable list, read while a ban turn is open; it is not one of
 * the events the desktop forwards. Read again every few seconds rather than
 * once: the client can answer an empty list as the turn opens, and with the
 * bans hidden until they are revealed nothing else would ask again — the grid
 * stayed greyed out for the whole turn.
 */
@Composable
private fun rememberBannable(session: Session, target: Action, takenCount: Int): Set<Int>? {
    var bannable by remember { mutableStateOf<Set<Int>?>(null) }
    LaunchedEffect(target.kind, target.id, takenCount) {
        if (target.kind != ActionKind.Ban) return@LaunchedEffect
        while (true) {
            bannable = try {
                session.get("/lol-champ-select/v1/bannable-champion-ids").takeIf { it.ok }?.body?.items?.mapNotNull { it.int }?.toSet()
            } catch (_: LinkUnavailable) {
                null
            }
            delay(BANNABLE_EVERY)
        }
    }
    return bannable
}

private const val BANNABLE_EVERY = 3_000L

@Composable
private fun ChampionTile(champion: Champion, selected: Boolean, available: Boolean, clickable: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(8.dp)
    Column(
        Modifier
            .alpha(if (available || selected) 1f else 0.4f)
            .clip(shape)
            .background(if (selected) Tm.Rose950 else Color.Transparent)
            .border(1.5.dp, if (selected) Tm.Rose400 else Color.Transparent, shape)
            .clickable(enabled = clickable, onClick = onClick)
            .padding(4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        ChampionIcon(champion.id, 52.dp, grayscale = !available && !selected)
        Text(
            champion.name,
            style = MaterialTheme.typography.labelMedium,
            color = if (selected) Tm.Rose300 else Tm.Ink200,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            textAlign = TextAlign.Center,
        )
    }
}

/** Case- and accent-blind, so `kaisa` finds Kai'Sa and `nunu` finds Nunu & Willump. */
private fun String.fold(): String =
    Normalizer.normalize(lowercase(), Normalizer.Form.NFD).replace(Regex("[^\\p{L}\\p{N}]"), "")
