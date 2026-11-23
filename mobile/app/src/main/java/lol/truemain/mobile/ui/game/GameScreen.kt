package lol.truemain.mobile.ui.game

import android.os.SystemClock
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.serialization.json.JsonElement
import lol.truemain.mobile.R
import lol.truemain.mobile.data.GameData
import lol.truemain.mobile.graph
import lol.truemain.mobile.link.LinkUnavailable
import lol.truemain.mobile.session.Session
import lol.truemain.mobile.ui.components.Chip
import lol.truemain.mobile.ui.components.EmptyState
import lol.truemain.mobile.ui.components.Loading
import lol.truemain.mobile.ui.components.Panel
import lol.truemain.mobile.ui.components.rememberGameData
import lol.truemain.mobile.ui.history.HistorySection
import lol.truemain.mobile.ui.theme.Tm

/** The phases in which a game is loading or running on the PC. */
private val IN_GAME = setOf("GameStart", "InProgress", "Reconnect")

/** How often the desktop's state is read again while it has one: only changes are pushed, the clock is not. */
private const val RESYNC_MILLIS = 10_000L

/** How often the live client is read while the desktop has no state yet. */
private const val POLL_MILLIS = 3_000L

/**
 * The game on the PC, as its scoreboard: the desktop's derived state first
 * (it alone carries objectives and timers), the game's own live client API
 * while that is not there yet. Out of a game, the recent games instead.
 */
@Composable
fun GameScreen() {
    val graph = LocalContext.current.graph
    val data = rememberGameData()
    val phase by graph.session.phase.collectAsState()
    val state by graph.session.state(Session.GAME).collectAsState()
    val inGame = phase in IN_GAME
    val hasState = state != null
    var polled by remember { mutableStateOf<JsonElement?>(null) }

    LaunchedEffect(inGame, hasState) {
        polled = null
        if (!inGame) return@LaunchedEffect
        while (true) {
            if (hasState) {
                delay(RESYNC_MILLIS)
                graph.session.refresh(Session.GAME)
            } else {
                polled = try {
                    graph.session.get("/liveclientdata/allgamedata").takeIf { it.ok }?.body
                } catch (_: LinkUnavailable) {
                    null
                }
                delay(POLL_MILLIS)
            }
        }
    }

    val game = remember(state, polled, data) { liveGameOfState(state, data) ?: liveGameOfPayload(polled, data) }
    when {
        game != null -> LiveGameView(game, running = inGame, data = data)
        inGame -> Column(Modifier.fillMaxSize().padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Loading()
            Text(stringResource(R.string.game_loading), color = Tm.Ink400, style = MaterialTheme.typography.bodyMedium)
        }
        else -> Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
            EmptyState(stringResource(R.string.game_none_title), stringResource(R.string.game_none_body))
            HistorySection()
        }
    }
}

/**
 * The game clock between two readings: the desktop sends the state on a
 * change only, so the phone runs the clock from the last reading itself.
 */
@Composable
private fun rememberClock(gameTime: Double, running: Boolean): Double {
    var now by remember { mutableDoubleStateOf(gameTime) }
    LaunchedEffect(gameTime, running) {
        val anchor = SystemClock.elapsedRealtime()
        now = gameTime
        while (running) {
            delay(1_000)
            now = gameTime + (SystemClock.elapsedRealtime() - anchor) / 1000.0
        }
    }
    return now
}

@Composable
private fun LiveGameView(game: LiveGame, running: Boolean, data: GameData?) {
    val clock = rememberClock(game.gameTime, running)
    val first = game.mySide ?: Side.Order
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        GameHeader(game, clock)
        game.vitals?.let { VitalsPanel(it) }
        game.objectives?.let { ObjectivesPanel(it, game.mySide, clock) }
        game.timers?.let { TimersPanel(it, clock) }
        TeamPanel(game, first, clock, data)
        TeamPanel(game, first.other, clock, data)
    }
}

@Composable
private fun GameHeader(game: LiveGame, clock: Double) {
    Panel {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    clockText(clock),
                    fontFamily = Tm.DisplayFont,
                    fontSize = 32.sp,
                    fontWeight = FontWeight.Bold,
                    color = Tm.Ink100,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    modeLabel(game.gameMode)?.let { Chip(it) }
                    if (game.mySide == null) Chip(stringResource(R.string.game_spectating), color = Tm.Gold)
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    game.kills(Side.Order).toString(),
                    fontFamily = Tm.DisplayFont,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold,
                    color = Tm.Blue,
                )
                Text("–", fontFamily = Tm.DisplayFont, fontSize = 22.sp, color = Tm.Ink500)
                Text(
                    game.kills(Side.Chaos).toString(),
                    fontFamily = Tm.DisplayFont,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold,
                    color = Tm.Red,
                )
            }
        }
        game.gold?.let {
            Text(
                stringResource(R.string.game_gold, it),
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
                color = Tm.Gold,
            )
        }
    }
}

/** The mode in words where the game's own code means nothing to a player; null when unknown. */
@Composable
private fun modeLabel(mode: String): String? = when (mode.uppercase()) {
    "CLASSIC" -> stringResource(R.string.game_mode_classic)
    "ARAM" -> stringResource(R.string.game_mode_aram)
    "PRACTICETOOL" -> stringResource(R.string.game_mode_practice)
    "CHERRY" -> stringResource(R.string.game_mode_arena)
    "URF", "ARURF" -> stringResource(R.string.game_mode_urf)
    "" -> null
    else -> mode
}
