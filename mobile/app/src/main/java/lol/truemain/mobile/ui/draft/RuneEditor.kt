package lol.truemain.mobile.ui.draft

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import lol.truemain.mobile.R
import lol.truemain.mobile.data.GameData
import lol.truemain.mobile.data.PerkStyle
import lol.truemain.mobile.data.RuneDraft
import lol.truemain.mobile.data.RuneImport
import lol.truemain.mobile.data.importRunes
import lol.truemain.mobile.data.ownedPageName
import lol.truemain.mobile.ui.components.Eyebrow
import lol.truemain.mobile.ui.components.RemoteImage
import lol.truemain.mobile.ui.theme.Tm

/**
 * A page as the client's own editor builds one, with its rules enforced as the
 * player taps so the result is always importable: a keystone and one rune per
 * primary row; a different secondary path with two runes from two different
 * rows (a third tap drops the oldest); one shard per row.
 */
private class RuneEditorState(data: GameData, initial: RunePage?) {
    var primary by mutableStateOf<PerkStyle?>(null)
    var secondary by mutableStateOf<PerkStyle?>(null)

    /** Primary picks by slot (0 is the keystone). */
    val primaryPicks = mutableStateMapOf<Int, Int>()

    /** Secondary picks as (slot, perk), oldest first. */
    val secondaryPicks = mutableStateListOf<Pair<Int, Int>>()
    val shards = mutableStateListOf(*data.shardRows.map { it.first() }.toTypedArray())

    init {
        val page = initial
        val style = data.styles.firstOrNull { it.id == page?.primary }
        if (page != null && style != null) {
            primary = style
            page.perks.take(4).forEach { perk -> style.slotOf(perk)?.let { primaryPicks[it] = perk } }
            data.styles.firstOrNull { it.id == page.sub && it.id != style.id }?.let { sub ->
                secondary = sub
                page.perks.drop(4).take(2).forEach { perk -> sub.slotOf(perk)?.takeIf { it > 0 }?.let { secondaryPicks += it to perk } }
            }
            page.perks.drop(6).take(3).forEachIndexed { row, perk -> if (perk in data.shardRows[row]) shards[row] = perk }
        }
    }

    fun choosePrimary(style: PerkStyle) {
        if (style.id == primary?.id) return
        primary = style
        primaryPicks.clear()
        if (secondary?.id == style.id) {
            secondary = null
            secondaryPicks.clear()
        }
    }

    fun chooseSecondary(style: PerkStyle) {
        if (style.id == secondary?.id) return
        secondary = style
        secondaryPicks.clear()
    }

    fun toggleSecondary(slot: Int, perk: Int) {
        val existing = secondaryPicks.indexOfFirst { it.first == slot }
        when {
            existing >= 0 && secondaryPicks[existing].second == perk -> secondaryPicks.removeAt(existing)
            existing >= 0 -> secondaryPicks[existing] = slot to perk
            else -> {
                secondaryPicks += slot to perk
                if (secondaryPicks.size > 2) secondaryPicks.removeAt(0)
            }
        }
    }

    fun draft(name: String): RuneDraft? {
        val p = primary ?: return null
        val s = secondary ?: return null
        val main = (0..3).map { primaryPicks[it] ?: return null }
        if (secondaryPicks.size != 2) return null
        // The client wants the secondary runes in row order, whatever order they were tapped in.
        val second = secondaryPicks.sortedBy { it.first }.map { it.second }
        return RuneDraft(name.trim().ifEmpty { return null }, p.id, s.id, main + second + shards).takeIf { it.complete }
    }
}

private fun PerkStyle.slotOf(perk: Int): Int? = slots.indexOfFirst { perk in it }.takeIf { it >= 0 }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RuneEditorSheet(data: GameData, initial: RunePage?, championName: String, actions: DraftActions, onDismiss: () -> Unit) {
    val state = remember(data) { RuneEditorState(data, initial) }
    // A champion's page is named the way the desktop names its own, so the import reuses that slot.
    var name by remember { mutableStateOf(if (championName.isNotBlank()) ownedPageName(championName) else ownedPageName("").trim()) }
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberFullSheetState(), containerColor = Tm.Ink900) {
        Column(
            Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Eyebrow(stringResource(R.string.draft_editor_primary))
            StyleRow(data.styles, state.primary?.id, exclude = null, onPick = state::choosePrimary)
            state.primary?.let { style ->
                style.slots.forEachIndexed { slot, perks ->
                    PerkRow(perks, data, if (slot == 0) 44.dp else 34.dp, selected = { state.primaryPicks[slot] == it }) { state.primaryPicks[slot] = it }
                }
            }

            Eyebrow(stringResource(R.string.draft_editor_secondary))
            StyleRow(data.styles, state.secondary?.id, exclude = state.primary?.id, onPick = state::chooseSecondary)
            state.secondary?.let { style ->
                style.slots.drop(1).forEachIndexed { index, perks ->
                    val slot = index + 1
                    PerkRow(perks, data, 34.dp, selected = { perk -> state.secondaryPicks.any { it == slot to perk } }) { state.toggleSecondary(slot, it) }
                }
            }

            Eyebrow(stringResource(R.string.draft_editor_shards))
            data.shardRows.forEachIndexed { row, perks ->
                PerkRow(perks, data, 28.dp, selected = { state.shards[row] == it }) { state.shards[row] = it }
            }

            OutlinedTextField(
                value = name,
                onValueChange = { name = it.take(25) },
                singleLine = true,
                label = { Text(stringResource(R.string.draft_editor_name)) },
                modifier = Modifier.fillMaxWidth(),
            )
            val draft = state.draft(name)
            Button(shape = Tm.ButtonShape, 
                onClick = {
                    draft ?: return@Button
                    actions.run {
                        val result = actions.session.importRunes(draft)
                        actions.say(result.message())
                        if (result == RuneImport.Done) onDismiss()
                    }
                },
                enabled = draft != null && !actions.busy,
                colors = ButtonDefaults.buttonColors(containerColor = Tm.Rose400, contentColor = Tm.Ink950),
                modifier = Modifier.fillMaxWidth().height(50.dp),
            ) { Text(stringResource(if (draft == null) R.string.draft_editor_incomplete else R.string.draft_editor_save)) }
        }
    }
}

@Composable
private fun StyleRow(styles: List<PerkStyle>, selected: Int?, exclude: Int?, onPick: (PerkStyle) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        styles.filter { it.id != exclude }.forEach { style ->
            val on = style.id == selected
            RemoteImage(
                style.icon,
                40.dp,
                Modifier.border(2.dp, if (on) Tm.Rose400 else Color.Transparent, CircleShape).clickable { onPick(style) }.padding(3.dp),
                shape = CircleShape,
                grayscale = selected != null && !on,
                contentDescription = style.name,
            )
        }
    }
}

@Composable
private fun PerkRow(perks: List<Int>, data: GameData, size: Dp, selected: (Int) -> Boolean, onPick: (Int) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        perks.forEach { perk ->
            val on = selected(perk)
            RemoteImage(
                data.perkIcon(perk),
                size,
                Modifier.border(2.dp, if (on) Tm.Rose400 else Color.Transparent, CircleShape).clickable { onPick(perk) }.padding(2.dp),
                shape = CircleShape,
                grayscale = !on,
                contentDescription = data.perks[perk]?.name,
            )
        }
    }
    val picked = perks.firstOrNull(selected)?.let { data.perks[it] }
    if (picked != null && size >= 34.dp) {
        Text(stringResource(R.string.draft_perk_line, picked.name, picked.shortDesc), style = MaterialTheme.typography.bodySmall, color = Tm.Ink400, maxLines = 2)
    }
}
