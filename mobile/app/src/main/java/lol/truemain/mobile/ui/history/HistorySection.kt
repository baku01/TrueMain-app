package lol.truemain.mobile.ui.history

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import lol.truemain.mobile.R
import lol.truemain.mobile.data.GameData
import lol.truemain.mobile.graph
import lol.truemain.mobile.lcu.bool
import lol.truemain.mobile.lcu.str
import lol.truemain.mobile.link.LinkState
import lol.truemain.mobile.session.Session
import lol.truemain.mobile.ui.components.ChampionIcon
import lol.truemain.mobile.ui.components.EmptyState
import lol.truemain.mobile.ui.components.Eyebrow
import lol.truemain.mobile.ui.components.Loading
import lol.truemain.mobile.ui.components.rememberGameData
import lol.truemain.mobile.ui.game.ItemStrip
import lol.truemain.mobile.ui.game.LevelBadge
import lol.truemain.mobile.ui.game.SpellStack
import lol.truemain.mobile.ui.game.kdaText
import lol.truemain.mobile.ui.theme.Tm

/**
 * The player's recent games, ten at a time. A section, not a list: it sits
 * in a screen that already scrolls (Home, the Game tab out of a game).
 */
@Composable
fun HistorySection(onLeadChampion: (Int) -> Unit = {}) {
    val graph = LocalContext.current.graph
    val data = rememberGameData()
    val link by graph.link.state.collectAsState()
    val appState by graph.session.state(Session.APP_STATE).collectAsState()
    val phase by graph.session.phase.collectAsState()
    val ready = link is LinkState.Open && appState.bool("connected") == true
    val riotId = appState.str("riotId")
    val pager = remember(graph) { HistoryPager(graph.session) }
    val scope = rememberCoroutineScope()
    var opened by remember { mutableStateOf<MatchSummary?>(null) }

    // A game joins the history once the client has its stats: read again on login and on reaching end of game.
    LaunchedEffect(ready, riotId, phase == "EndOfGame") {
        if (ready) pager.reload()
    }

    LaunchedEffect(pager.games.firstOrNull()?.me?.championId) {
        pager.games.firstOrNull()?.me?.championId?.takeIf { it > 0 }?.let(onLeadChampion)
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Eyebrow(stringResource(R.string.history_title))
        when {
            pager.games.isEmpty() && pager.loading -> Loading()
            pager.games.isEmpty() && !ready -> EmptyState(stringResource(R.string.history_unavailable))
            pager.games.isEmpty() && pager.failed -> EmptyState(
                stringResource(R.string.history_error),
                action = stringResource(R.string.history_retry) to { scope.launch { pager.reload() } },
            )
            pager.games.isEmpty() -> EmptyState(stringResource(R.string.history_empty))
            else -> {
                pager.games.forEach { game -> HistoryRow(game, data) { opened = game } }
                when {
                    pager.loading -> Loading()
                    pager.failed -> TextButton(onClick = { scope.launch { pager.more() } }, modifier = Modifier.align(Alignment.CenterHorizontally), shape = Tm.ButtonShape) {
                        Text(stringResource(R.string.history_error_more), color = Tm.Rose400)
                    }
                    !pager.exhausted && ready -> TextButton(onClick = { scope.launch { pager.more() } }, modifier = Modifier.align(Alignment.CenterHorizontally), shape = Tm.ButtonShape) {
                        Text(stringResource(R.string.history_more), color = Tm.Rose400)
                    }
                }
            }
        }
    }

    opened?.let { GameDetailDialog(it, onDismiss = { opened = null }) }
}

@Composable
private fun HistoryRow(game: MatchSummary, data: GameData?, onClick: () -> Unit) {
    val me = game.me
    val tone = resultColor(me)
    val shape = RoundedCornerShape(10.dp)
    val light = Tm.colors.light
    Box(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Tm.colors.pane)
            .background(
                Brush.horizontalGradient(
                    0f to tone.copy(alpha = if (light) 0.10f else 0.13f),
                    0.35f to Color.Transparent,
                ),
            )
            .then(if (light) Modifier.border(1.dp, Tm.colors.border.copy(alpha = 0.7f), shape) else Modifier)
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 10.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Box(Modifier.width(3.dp).height(54.dp).background(tone, RoundedCornerShape(2.dp)))
            Box {
                ChampionIcon(me.championId, 46.dp)
                LevelBadge(me.level)
            }
            SpellStack(me.spellIds, 21.dp, data)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        resultLabel(me),
                        color = tone,
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        " · " + queueLabel(game.queueId, game.gameMode),
                        Modifier.weight(1f),
                        color = Tm.Ink400,
                        style = MaterialTheme.typography.labelMedium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(relativeDate(game.creation), color = Tm.Ink400, style = MaterialTheme.typography.labelMedium)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        kdaText(me.kills, me.deaths, me.assists),
                        fontFamily = Tm.DisplayFont,
                        color = Tm.Ink100,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        "  " + (kdaRatio(me)?.let { stringResource(R.string.history_kda, it) } ?: stringResource(R.string.history_perfect)),
                        Modifier.weight(1f),
                        color = Tm.Ink400,
                        style = MaterialTheme.typography.labelMedium,
                    )
                    Text(
                        stringResource(R.string.history_cs_duration, me.creepScore, durationText(game.durationSeconds)),
                        color = Tm.Ink400,
                        style = MaterialTheme.typography.labelMedium,
                    )
                }
                ItemStrip(me.items, 21.dp, data)
            }
        }
    }
}
