package lol.truemain.mobile.ui.draft

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.JsonElement
import lol.truemain.mobile.R
import lol.truemain.mobile.data.GameData
import lol.truemain.mobile.data.Position
import lol.truemain.mobile.data.TrueMainApi
import lol.truemain.mobile.data.importRunes
import lol.truemain.mobile.data.ownedPageName
import lol.truemain.mobile.data.runeDraftOf
import lol.truemain.mobile.data.topRunePage
import lol.truemain.mobile.graph
import lol.truemain.mobile.lcu.double
import lol.truemain.mobile.lcu.get
import lol.truemain.mobile.lcu.int
import lol.truemain.mobile.lcu.items
import lol.truemain.mobile.ui.components.EmptyState
import lol.truemain.mobile.ui.components.Eyebrow
import lol.truemain.mobile.ui.components.Loading
import lol.truemain.mobile.ui.components.Panel
import lol.truemain.mobile.ui.components.RemoteImage
import lol.truemain.mobile.ui.components.percent
import lol.truemain.mobile.ui.theme.Tm

private sealed interface Recommendation {
    data object Loading : Recommendation
    data object Failed : Recommendation
    data class Ready(val build: JsonElement, val vsOpponent: Boolean) : Recommendation
}

/**
 * The page and spells TrueMain's own games say win on this champion and lane,
 * narrowed to the lane opponent when the client names one. Read from the
 * site's API on the phone, applied through the desktop on a tap.
 */
@Composable
fun RecommendedPanel(draft: Draft, data: GameData?, actions: DraftActions) {
    val api = LocalContext.current.graph.api
    val champion = draft.myChampion
    val me = draft.me ?: return
    val position = Position.of(me.position)
    val opponent = draft.opponentChampion
    var state by remember { mutableStateOf<Recommendation>(Recommendation.Loading) }
    var attempt by remember { mutableIntStateOf(0) }
    LaunchedEffect(champion, position, opponent, attempt) {
        state = Recommendation.Loading
        state = try {
            fetch(api, champion, position, opponent)
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            Recommendation.Failed
        }
    }

    Panel {
        Eyebrow(stringResource(R.string.draft_recommended), color = Tm.Rose400)
        val name = data?.championName(champion).orEmpty()
        val context = listOfNotNull(name.ifBlank { null }, position?.let { stringResource(it.label) }).joinToString(" · ")
        if (context.isNotBlank()) Text(context, style = MaterialTheme.typography.titleSmall, color = Tm.Ink100)
        when (val s = state) {
            Recommendation.Loading -> Loading()
            Recommendation.Failed -> EmptyState(
                stringResource(R.string.draft_recommended_failed),
                action = stringResource(R.string.draft_retry) to { attempt++ },
            )
            is Recommendation.Ready -> Ready(s, me, name, data, actions)
        }
    }
}

private suspend fun fetch(api: TrueMainApi, champion: Int, position: Position?, opponent: Int?): Recommendation {
    if (opponent != null) {
        val narrowed = api.championBuild(champion, position?.api, opponent)
        // Too few games against this opponent: the lane's build is the better advice.
        if (narrowed["builds"].items.isNotEmpty()) return Recommendation.Ready(narrowed, vsOpponent = true)
    }
    return Recommendation.Ready(api.championBuild(champion, position?.api), vsOpponent = false)
}

@Composable
private fun Ready(state: Recommendation.Ready, me: Cell, championName: String, data: GameData?, actions: DraftActions) {
    val top = state.build["builds"].items.firstOrNull()
    if (top == null) {
        Text(stringResource(R.string.draft_recommended_none), color = Tm.Ink400, style = MaterialTheme.typography.bodyMedium)
        return
    }
    val games = top.int("games")
    Text(
        pluralStringResource(
            if (state.vsOpponent) R.plurals.draft_recommended_stats_vs else R.plurals.draft_recommended_stats,
            games ?: 0,
            percent(top.double("winRate")),
            games ?: 0,
        ),
        style = MaterialTheme.typography.bodySmall,
        color = Tm.Ink400,
    )

    val runes = runeDraftOf(topRunePage(state.build), ownedPageName(championName))
    if (runes != null) {
        PerkStrip(runes.primaryStyleId, runes.subStyleId, runes.perkIds, data)
        Button(shape = Tm.ButtonShape, 
            onClick = { actions.run { actions.say(actions.session.importRunes(runes).message()) } },
            enabled = !actions.busy,
            colors = ButtonDefaults.buttonColors(containerColor = Tm.Rose400, contentColor = Tm.Ink950),
            modifier = Modifier.fillMaxWidth(),
        ) { Text(stringResource(R.string.draft_recommended_apply_runes)) }
    }

    val spells = top["core"]["summonerSpells"]
    val spell1 = spells.int("spell1Id") ?: 0
    val spell2 = spells.int("spell2Id") ?: 0
    if (spell1 > 0 && spell2 > 0 && spell1 != spell2) {
        // Same pair either way round counts as already set: which key holds Flash is the player's habit.
        val already = setOf(spell1, spell2) == setOf(me.spell1, me.spell2)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            RemoteImage(data?.spellIcon(spell1), 32.dp)
            RemoteImage(data?.spellIcon(spell2), 32.dp)
            Spacer(Modifier.weight(1f))
            OutlinedButton(shape = Tm.ButtonShape, onClick = {
                // Keep a spell the player already has on the key they keep it on.
                if (me.spell1 == spell2 || me.spell2 == spell1) actions.spells(spell2, spell1) else actions.spells(spell1, spell2)
            }, enabled = !actions.busy && !already) {
                Text(stringResource(if (already) R.string.draft_recommended_spells_set else R.string.draft_recommended_use_spells), color = if (already) Tm.Ink500 else Tm.Ink100)
            }
        }
    }
}
