package lol.truemain.mobile.ui.draft

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import lol.truemain.mobile.R
import lol.truemain.mobile.data.GameData
import lol.truemain.mobile.data.SummonerSpell
import lol.truemain.mobile.ui.components.Eyebrow
import lol.truemain.mobile.ui.components.Panel
import lol.truemain.mobile.ui.components.RemoteImage
import lol.truemain.mobile.ui.theme.Tm

/**
 * The player's own loadout: spells (any time), skin (once locked in, since the
 * carousel is the locked champion's) and, in ARAM, the reroll.
 */
@Composable
fun LoadoutPanel(draft: Draft, me: Cell, data: GameData?, mode: String?, actions: DraftActions) {
    var spellsOpen by remember { mutableStateOf(false) }
    var skinsOpen by remember { mutableStateOf(false) }
    Panel {
        Eyebrow(stringResource(R.string.draft_loadout))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            RemoteImage(data?.spellIcon(me.spell1), 36.dp)
            RemoteImage(data?.spellIcon(me.spell2), 36.dp)
            TextButton(shape = Tm.ButtonShape, onClick = { spellsOpen = true }, enabled = data != null) {
                Text(stringResource(R.string.draft_spells_change), color = Tm.Rose400)
            }
            TextButton(shape = Tm.ButtonShape, 
                onClick = { actions.spells(me.spell2, me.spell1) },
                enabled = !actions.busy && me.spell1 > 0 && me.spell2 > 0,
            ) { Text(stringResource(R.string.draft_spells_swap), color = Tm.Ink300) }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(shape = Tm.ButtonShape, onClick = { skinsOpen = true }, enabled = draft.locked, modifier = Modifier.weight(1f)) {
                Text(stringResource(if (draft.locked) R.string.draft_skins else R.string.draft_skins_after_lock), color = if (draft.locked) Tm.Ink100 else Tm.Ink500)
            }
            if (draft.allowRerolling) {
                OutlinedButton(shape = Tm.ButtonShape, 
                    onClick = { actions.send("POST", "/lol-champ-select/v1/session/my-selection/reroll") },
                    enabled = !actions.busy && draft.rerollsRemaining > 0,
                ) {
                    Icon(Icons.Filled.Refresh, contentDescription = null, tint = Tm.Ink300)
                    Text(stringResource(R.string.draft_reroll, draft.rerollsRemaining), color = Tm.Ink100, modifier = Modifier.padding(start = 6.dp))
                }
            }
        }
    }
    if (spellsOpen && data != null) SpellsSheet(me, data, mode, actions) { spellsOpen = false }
    if (skinsOpen) SkinsSheet(me, actions) { skinsOpen = false }
}

/** The spells the game mode allows, as Data Dragon tags them; every classic one when the mode is unknown. */
fun spellsFor(data: GameData, mode: String?): List<SummonerSpell> {
    val wanted = mode?.takeIf { it.isNotBlank() } ?: "CLASSIC"
    val inMode = data.spells.values.filter { wanted in it.modes }
    return (inMode.ifEmpty { data.spells.values.filter { "CLASSIC" in it.modes } }).sortedBy { it.name }
}

/**
 * Pick which key to fill, then the spell. Choosing the spell already on the
 * other key swaps the two rather than sending a pair the client would accept
 * but the game would not.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun SpellsSheet(me: Cell, data: GameData, mode: String?, actions: DraftActions, onDismiss: () -> Unit) {
    var slot by remember { mutableIntStateOf(0) }
    val current = listOf(me.spell1, me.spell2)
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberFullSheetState(), containerColor = Tm.Ink900) {
        Column(Modifier.padding(horizontal = 20.dp).padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Eyebrow(stringResource(R.string.draft_spells_title))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                listOf(R.string.draft_spell_d, R.string.draft_spell_f).forEachIndexed { index, key ->
                    Column(
                        Modifier.clip(RoundedCornerShape(12.dp))
                            .border(2.dp, if (slot == index) Tm.Rose400 else Tm.Ink700, RoundedCornerShape(12.dp))
                            .clickable { slot = index }
                            .padding(8.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        RemoteImage(data.spellIcon(current[index]), 48.dp)
                        Text(stringResource(key), style = MaterialTheme.typography.labelMedium, color = Tm.Ink300)
                    }
                }
                TextButton(shape = Tm.ButtonShape, onClick = { actions.spells(me.spell2, me.spell1) }, enabled = !actions.busy) {
                    Text(stringResource(R.string.draft_spells_swap), color = Tm.Rose400)
                }
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                spellsFor(data, mode).forEach { spell ->
                    val selectedHere = current[slot] == spell.id
                    Column(
                        Modifier.width(64.dp).clip(RoundedCornerShape(10.dp))
                            .background(if (selectedHere) Tm.Rose950 else Color.Transparent)
                            .clickable(enabled = !actions.busy && !selectedHere) {
                                val other = current[1 - slot]
                                val pair = if (spell.id == other) listOf(current[1], current[0]) else current.toMutableList().also { it[slot] = spell.id }
                                actions.spells(pair[0], pair[1])
                                slot = 1 - slot
                            }
                            .padding(4.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        RemoteImage(data.spellIcon(spell.id), 44.dp, grayscale = spell.id in current && !selectedHere)
                        Text(spell.name, style = MaterialTheme.typography.labelSmall, color = Tm.Ink300, maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center)
                    }
                }
            }
        }
    }
}
