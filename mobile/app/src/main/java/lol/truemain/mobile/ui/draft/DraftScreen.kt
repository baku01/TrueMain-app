package lol.truemain.mobile.ui.draft

import android.os.VibrationEffect
import android.os.Vibrator
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import lol.truemain.mobile.R
import lol.truemain.mobile.data.GameData
import lol.truemain.mobile.graph
import lol.truemain.mobile.lcu.get
import lol.truemain.mobile.lcu.str
import lol.truemain.mobile.link.LinkState
import lol.truemain.mobile.session.Session
import lol.truemain.mobile.ui.components.EmptyState
import lol.truemain.mobile.ui.components.rememberGameData

/**
 * Champion select, driven from the phone: the draft as both teams see it, the
 * grid for the player's open turn, and their loadout (spells, skin, runes).
 * Everything here is live from the client's events; a write is always one tap
 * of the player's, and a lock or a ban is two.
 */
@Composable
fun DraftScreen(onOpenFullBuild: ((championId: Int, position: String?) -> Unit)? = null) {
    val graph = LocalContext.current.graph
    val session = graph.session
    val link by graph.link.state.collectAsState()
    val json by session.state(Session.CHAMP_SELECT).collectAsState()
    val data = rememberGameData()
    val snackbar = remember { SnackbarHostState() }
    val actions = rememberDraftActions(snackbar)
    val draft = remember(json) { json?.let(Draft::of) }

    Box(Modifier.fillMaxSize()) {
        if (draft == null) {
            EmptyState(stringResource(R.string.draft_empty_title), stringResource(R.string.draft_empty_body))
        } else {
            YourTurnBuzz(draft)
            DraftContent(draft, data, actions, online = link is LinkState.Open, onOpenFullBuild = onOpenFullBuild)
        }
        SnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter).padding(12.dp))
    }
}

@Composable
private fun DraftContent(
    draft: Draft,
    data: GameData?,
    actions: DraftActions,
    online: Boolean,
    onOpenFullBuild: ((championId: Int, position: String?) -> Unit)?,
) {
    val gameflow by actions.session.state(Session.GAMEFLOW_SESSION).collectAsState()
    // The mode filters the spells: ARAM's Mark, Classic's Smite.
    val mode = gameflow["map"].str("gameMode") ?: gameflow["gameData"]["queue"].str("gameMode")
    val me = draft.me
    val target = draft.target
    var query by rememberSaveable { mutableStateOf("") }
    var tag by rememberSaveable { mutableStateOf<String?>(null) }
    val picker = target?.let { rememberChampionPickerState(draft, it, data, query, tag, actions) }

    Column(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .weight(1f)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
                .padding(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            DraftHeader(draft, online = online)
            IncomingSwaps(draft, data, actions)
            if (target != null && picker != null) {
                ChampionPickerPanel(
                    draft = draft,
                    target = target,
                    picker = picker,
                    data = data,
                    query = query,
                    onQueryChange = { query = it },
                    tag = tag,
                    onTagChange = { tag = it },
                    actions = actions,
                )
            }
            if (draft.benchEnabled) BenchPanel(draft, data, actions)
            TeamsPanel(draft, data)
            if (me != null) LoadoutPanel(draft, me, data, mode, actions)
            RunesPanel(draft, data, actions)
            if (draft.myChampion > 0) RecommendedPanel(draft, data, actions, onOpenFullBuild)
            SwapOffers(draft, data, actions)
        }
        if (target != null && draft.current != null && picker != null) {
            DraftTurnBar(draft, target, picker, data, actions)
        }
    }
}

/** A short buzz when a turn of the player's opens: the phone may well be in a pocket. */
@Composable
private fun YourTurnBuzz(draft: Draft) {
    val context = LocalContext.current
    val turn = draft.current?.id
    LaunchedEffect(turn) {
        if (turn != null) context.getSystemService(Vibrator::class.java)?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 200, 120, 200), -1))
    }
}
