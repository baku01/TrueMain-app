package lol.truemain.mobile.ui.play

import android.os.SystemClock
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlinx.serialization.json.JsonElement
import lol.truemain.mobile.R
import lol.truemain.mobile.graph
import lol.truemain.mobile.lcu.bool
import lol.truemain.mobile.lcu.double
import lol.truemain.mobile.lcu.get
import lol.truemain.mobile.lcu.list
import lol.truemain.mobile.lcu.str
import lol.truemain.mobile.session.Session
import lol.truemain.mobile.ui.components.Eyebrow
import lol.truemain.mobile.ui.components.Panel
import lol.truemain.mobile.ui.components.StatRow
import lol.truemain.mobile.ui.theme.Tm

private const val SEARCH_PATH = "/lol-lobby/v2/lobby/matchmaking/search"

/**
 * Find match, and the queue once in it. The client sends the search only
 * when something changes, so the time in queue is counted on from the last
 * one it sent — and a queue-dodge penalty counted down the same way.
 */
@Composable
fun MatchmakingPanel(lobby: JsonElement, isLeader: Boolean, actions: PlayActions) {
    val session = LocalContext.current.graph.session
    val search by session.state(Session.SEARCH).collectAsState()
    val phase by session.phase.collectAsState()
    val searchState = search.str("searchState")
    val inQueue = phase == "Matchmaking" || searchState == "Searching" || searchState == "Found"

    Panel {
        if (inQueue) {
            InQueue(search)
            OutlinedButton(shape = Tm.ButtonShape, 
                onClick = { actions.run("cancel", "DELETE", SEARCH_PATH) },
                enabled = actions.idle,
                modifier = Modifier.fillMaxWidth().height(48.dp),
            ) {
                Icon(Icons.Filled.Close, contentDescription = null, tint = Tm.Ink300)
                Text(stringResource(R.string.play_cancel_queue), color = Tm.Ink200, modifier = Modifier.padding(start = 8.dp))
            }
        } else {
            val canStart = lobby.bool("canStartActivity") == true
            Button(shape = Tm.ButtonShape, 
                onClick = { actions.run("start", "POST", SEARCH_PATH) },
                enabled = isLeader && canStart && actions.idle,
                colors = ButtonDefaults.buttonColors(containerColor = Tm.Rose400, contentColor = Tm.colors.textInverted),
                modifier = Modifier.fillMaxWidth().height(56.dp),
            ) {
                if (actions.busy == "start") {
                    CircularProgressIndicator(color = Tm.colors.textInverted, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                } else {
                    Icon(Icons.Filled.PlayArrow, contentDescription = null)
                    Text(stringResource(R.string.play_find_match), style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(start = 8.dp))
                }
            }
            when {
                !isLeader -> Hint(stringResource(R.string.play_waiting_leader))
                !canStart -> Hint(stringResource(R.string.play_cannot_start))
            }
        }
    }
}

@Composable
private fun InQueue(search: JsonElement?) {
    val now = rememberClock()
    val inQueue = rememberCounted(search.double("timeInQueue") ?: 0.0, now, up = true)
    val estimated = search.double("estimatedQueueTime")?.toLong()?.takeIf { it > 0 }
    // A dodge or leaver penalty holds the search for its length before it starts.
    val penaltyBase = (search.list("errors").mapNotNull { it.double("penaltyTimeRemaining") } +
        listOfNotNull(search["lowPriorityData"].double("penaltyTimeRemaining"))).maxOrNull() ?: 0.0
    val penalty = rememberCounted(penaltyBase, now, up = false)
    val message = search.list("errors").firstNotNullOfOrNull { it.str("message")?.takeIf(String::isNotBlank) }

    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        CircularProgressIndicator(color = Tm.Rose400, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
        Eyebrow(stringResource(R.string.play_in_queue), color = Tm.Rose300)
    }
    Text(clockText(inQueue), style = MaterialTheme.typography.displaySmall, fontWeight = FontWeight.SemiBold, color = Tm.Ink100)
    StatRow(stringResource(R.string.play_estimated), estimated?.let { clockText(it) } ?: "—")
    if (penalty > 0) {
        Text(stringResource(R.string.play_penalty, clockText(penalty)), color = Tm.Gold, style = MaterialTheme.typography.bodyMedium)
    }
    if (message != null) Hint(message)
}

@Composable
private fun Hint(text: String) {
    Text(text, style = MaterialTheme.typography.bodySmall, color = Tm.Ink400)
}

@Composable
fun clockText(seconds: Long): String {
    val (minutes, rest) = clock(seconds)
    return stringResource(R.string.play_clock, minutes, rest)
}

/** A clock that moves while the panel shows, a few times a second so a whole second never lags. */
@Composable
private fun rememberClock(): Long {
    var now by remember { mutableLongStateOf(SystemClock.elapsedRealtime()) }
    LaunchedEffect(Unit) {
        while (true) {
            now = SystemClock.elapsedRealtime()
            delay(250)
        }
    }
    return now
}

/** [base] seconds as last sent, moved by the time since it was: up for the queue, down for a penalty. */
@Composable
private fun rememberCounted(base: Double, now: Long, up: Boolean): Long {
    val anchor = remember(base) { SystemClock.elapsedRealtime() }
    val passed = (now - anchor).coerceAtLeast(0) / 1000.0
    return (if (up) base + passed else base - passed).toLong().coerceAtLeast(0)
}
