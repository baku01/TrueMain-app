package lol.truemain.mobile.ui.play

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import lol.truemain.mobile.R
import lol.truemain.mobile.graph
import lol.truemain.mobile.lcu.bool
import lol.truemain.mobile.link.LinkState
import lol.truemain.mobile.session.Session
import lol.truemain.mobile.ui.components.EmptyState
import lol.truemain.mobile.ui.components.Loading
import lol.truemain.mobile.ui.theme.Tm
import kotlinx.coroutines.delay

/**
 * Getting into a game from the phone: a queue to open a lobby in, then the
 * lobby itself — members, lanes, invites, the queue — with the invitations
 * received on top. Everything shown is the client's own state, as events
 * bring it; the screen only sends the player's taps.
 */
@Composable
fun PlayScreen() {
    val graph = LocalContext.current.graph
    val link by graph.link.state.collectAsState()
    val app by graph.session.state(Session.APP_STATE).collectAsState()
    val lobby by graph.session.state(Session.LOBBY).collectAsState()
    val received by graph.session.state(Session.INVITATIONS).collectAsState()
    val scope = rememberCoroutineScope()
    val actions = remember(graph) { PlayActions(graph.session, scope) }
    val open = link is LinkState.Open
    val connected = app.bool("connected") == true

    // The queues do not change while the client runs: read once, kept across lobbies; an empty
    // list (read while the client was still starting) is read again.
    var catalog by remember { mutableStateOf<QueueCatalog?>(null) }
    var catalogFailed by remember { mutableStateOf(false) }
    var attempt by remember { mutableIntStateOf(0) }
    LaunchedEffect(open, connected, attempt) {
        // Nothing else asks again: an empty answer is retried here, a few times, before it is shown.
        repeat(QUEUE_TRIES) {
            if (!open || !connected || catalog?.groups?.isNotEmpty() == true) return@LaunchedEffect
            catalogFailed = false
            val response = runCatching { graph.session.get(QueueCatalog.PATH) }.getOrNull()
            if (response?.ok == true) catalog = QueueCatalog.of(response.body) else catalogFailed = true
            if (catalog?.groups?.isNotEmpty() == true) return@LaunchedEffect
            delay(QUEUE_RETRY_MILLIS)
        }
    }

    when {
        !open -> EmptyState(stringResource(R.string.play_no_link))
        app == null -> Loading()
        !connected -> EmptyState(stringResource(R.string.link_no_client))
        else -> Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            ReceivedInvitations(received, catalog, actions)
            actions.failure?.let { FailureBanner(it, actions::dismiss) }
            val current = lobby
            if (current == null) {
                QueuePicker(catalog, catalogFailed, actions) { attempt++ }
            } else {
                LobbyPanel(current, catalog, actions)
            }
        }
    }
}

/** A write the client refused, in its words when it gave some, until dismissed or the next write. */
@Composable
fun FailureBanner(failure: PlayFailure, onDismiss: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().background(Tm.Red.copy(alpha = if (Tm.colors.light) 0.12f else 0.2f), RoundedCornerShape(12.dp)).padding(start = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            failure.reason ?: stringResource(R.string.error_generic),
            style = MaterialTheme.typography.bodyMedium,
            color = Tm.Red,
            modifier = Modifier.weight(1f).padding(vertical = 10.dp),
        )
        IconButton(onClick = onDismiss) { Icon(Icons.Filled.Close, contentDescription = stringResource(R.string.play_close), tint = Tm.Red) }
    }
}

/** Tries before an empty queue list is shown, and the pause between them. */
private const val QUEUE_TRIES = 5
private const val QUEUE_RETRY_MILLIS = 2_000L
