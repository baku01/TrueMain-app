package lol.truemain.mobile.ui.draft

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive
import lol.truemain.mobile.R
import lol.truemain.mobile.data.GameData
import lol.truemain.mobile.data.RuneImport
import lol.truemain.mobile.lcu.bool
import lol.truemain.mobile.lcu.int
import lol.truemain.mobile.lcu.items
import lol.truemain.mobile.lcu.list
import lol.truemain.mobile.lcu.str
import lol.truemain.mobile.session.Session
import lol.truemain.mobile.ui.components.Eyebrow
import lol.truemain.mobile.ui.components.Panel
import lol.truemain.mobile.ui.components.RemoteImage
import lol.truemain.mobile.ui.theme.Tm

/** A page of `/lol-perks/v1/pages`, or the current one. */
data class RunePage(val id: Int, val name: String, val primary: Int, val sub: Int, val perks: List<Int>, val active: Boolean) {
    companion object {
        fun of(json: JsonElement?): RunePage? {
            val id = json.int("id") ?: return null
            return RunePage(
                id = id,
                name = json.str("name").orEmpty(),
                primary = json.int("primaryStyleId") ?: 0,
                sub = json.int("subStyleId") ?: 0,
                perks = json.list("selectedPerkIds").mapNotNull { it.int },
                active = json.bool("current") == true || json.bool("isActive") == true,
            )
        }
    }
}

/** What an import answered, as the player reads it. */
fun RuneImport.message(): Int = when (this) {
    RuneImport.Done -> R.string.draft_runes_applied
    RuneImport.NoSlot -> R.string.draft_runes_no_slot
    RuneImport.Failed -> R.string.draft_runes_failed
}

/** The page the client will play, the others a tap away, and an editor for a page of one's own. */
@Composable
fun RunesPanel(draft: Draft, data: GameData?, actions: DraftActions) {
    val currentJson by actions.session.state(Session.CURRENT_RUNE_PAGE).collectAsState()
    val pagesJson by actions.session.state(Session.RUNE_PAGES).collectAsState()
    val current = RunePage.of(currentJson)
    val pages = pagesJson.items.mapNotNull(RunePage::of)
    var pagesOpen by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf(false) }

    Panel {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Eyebrow(stringResource(R.string.draft_runes), Modifier.weight(1f))
            TextButton(shape = Tm.ButtonShape, onClick = { pagesOpen = true }, enabled = pages.isNotEmpty()) { Text(stringResource(R.string.draft_runes_pages), color = Tm.Rose400) }
            TextButton(shape = Tm.ButtonShape, onClick = { editing = true }, enabled = data != null) { Text(stringResource(R.string.draft_runes_edit), color = Tm.Rose400) }
        }
        if (current == null) {
            Text(stringResource(R.string.draft_runes_none), color = Tm.Ink400, style = MaterialTheme.typography.bodyMedium)
        } else {
            Text(current.name, style = MaterialTheme.typography.titleSmall, color = Tm.Ink100, maxLines = 1, overflow = TextOverflow.Ellipsis)
            PerkStrip(current.primary, current.sub, current.perks, data)
        }
    }

    if (pagesOpen) PagesSheet(pages, current?.id, data, actions) { pagesOpen = false }
    if (editing && data != null) {
        RuneEditorSheet(
            data = data,
            initial = current,
            championName = data.championName(draft.myChampion),
            actions = actions,
            onDismiss = { editing = false },
        )
    }
}

/** A page in one line: primary path, keystone, its three runes, the secondary path and its two, the shards. */
@Composable
fun PerkStrip(primary: Int, sub: Int, perks: List<Int>, data: GameData?) {
    Row(Modifier.horizontalScroll(rememberScrollState()), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        RemoteImage(data?.styleIcon(primary), 20.dp, shape = CircleShape)
        perks.getOrNull(0)?.let { RemoteImage(data?.perkIcon(it), 40.dp, shape = CircleShape) }
        perks.drop(1).take(3).forEach { RemoteImage(data?.perkIcon(it), 26.dp, shape = CircleShape) }
        Spacer(Modifier.width(4.dp))
        RemoteImage(data?.styleIcon(sub), 20.dp, shape = CircleShape)
        perks.drop(4).take(2).forEach { RemoteImage(data?.perkIcon(it), 26.dp, shape = CircleShape) }
        Spacer(Modifier.width(4.dp))
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            perks.drop(6).take(3).forEach { RemoteImage(data?.perkIcon(it), 12.dp, shape = CircleShape) }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PagesSheet(pages: List<RunePage>, currentId: Int?, data: GameData?, actions: DraftActions, onDismiss: () -> Unit) {
    val sheetSnackbar = rememberSheetSnackbar(actions)
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberFullSheetState(), containerColor = Tm.Ink900) {
        Box(Modifier.fillMaxWidth()) {
            Column(Modifier.fillMaxWidth()) {
                Eyebrow(stringResource(R.string.draft_runes_pages_title), Modifier.padding(horizontal = 20.dp, vertical = 8.dp))
                LazyColumn(Modifier.fillMaxWidth().heightIn(max = 520.dp), contentPadding = PaddingValues(bottom = 24.dp)) {
                    items(pages, key = { it.id }) { page ->
                        val selected = page.id == currentId
                        Column(
                            Modifier.fillMaxWidth()
                                .padding(horizontal = 12.dp, vertical = 3.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (selected) Tm.Rose950 else Color.Transparent)
                                .clickable(enabled = !selected && !actions.busy) {
                                    actions.send("PUT", "/lol-perks/v1/currentpage", JsonPrimitive(page.id))
                                }
                                .padding(10.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            Text(page.name, style = MaterialTheme.typography.bodyMedium, color = if (selected) Tm.Rose300 else Tm.Ink100, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            PerkStrip(page.primary, page.sub, page.perks, data)
                        }
                    }
                }
            }
            SnackbarHost(sheetSnackbar, Modifier.align(Alignment.BottomCenter).padding(12.dp))
        }
    }
}
