package lol.truemain.mobile.ui.play

import androidx.annotation.StringRes
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import lol.truemain.mobile.R
import lol.truemain.mobile.graph
import lol.truemain.mobile.lcu.get
import lol.truemain.mobile.lcu.int
import lol.truemain.mobile.lcu.items
import lol.truemain.mobile.lcu.long
import lol.truemain.mobile.lcu.str
import lol.truemain.mobile.ui.components.EmptyState
import lol.truemain.mobile.ui.components.Loading
import lol.truemain.mobile.ui.components.RemoteImage
import lol.truemain.mobile.ui.components.rememberGameData
import lol.truemain.mobile.ui.theme.Tm

/** A friend who could join: online on chat, as `/lol-chat/v1/friends` lists them. */
private data class Friend(val summonerId: Long, val name: String, val tag: String, val icon: Int?, @StringRes val status: Int, val order: Int)

/** Online first, then away and busy; the Riot mobile app and offline cannot join a lobby. */
private val AVAILABLE = listOf("chat", "away", "dnd")

@StringRes
private fun statusOf(availability: String, gameStatus: String?): Int = when {
    gameStatus == "inGame" -> R.string.play_friend_in_game
    gameStatus == "championSelect" -> R.string.play_friend_champ_select
    gameStatus == "inQueue" -> R.string.play_friend_in_queue
    gameStatus?.startsWith("hosting") == true -> R.string.play_friend_in_lobby
    availability == "away" -> R.string.play_friend_away
    availability == "dnd" -> R.string.play_friend_busy
    else -> R.string.play_friend_online
}

/**
 * The friends to invite, searchable by name. One invite per tap, marked
 * once sent: [taken] are the ones already in the lobby or invited to it.
 */
@Composable
fun InviteDialog(taken: Set<Long>, actions: PlayActions, onDismiss: () -> Unit) {
    val session = LocalContext.current.graph.session
    val data = rememberGameData()
    var friends by remember { mutableStateOf<List<Friend>?>(null) }
    var failed by remember { mutableStateOf(false) }
    var attempt by remember { mutableIntStateOf(0) }
    var query by remember { mutableStateOf("") }
    var sent by remember { mutableStateOf(emptySet<Long>()) }

    LaunchedEffect(attempt) {
        failed = false
        val response = runCatching { session.get("/lol-chat/v1/friends") }.getOrNull()
        if (response?.ok != true) {
            failed = true
            return@LaunchedEffect
        }
        friends = response.body.items.mapNotNull { friend ->
            val id = friend.long("summonerId")?.takeIf { it > 0 } ?: return@mapNotNull null
            val availability = friend.str("availability").orEmpty()
            val order = AVAILABLE.indexOf(availability).takeIf { it >= 0 } ?: return@mapNotNull null
            val name = friend.str("gameName")?.takeIf { it.isNotBlank() } ?: friend.str("name").orEmpty()
            Friend(id, name, friend.str("gameTag").orEmpty(), friend.int("icon"), statusOf(availability, friend["lol"].str("gameStatus")), order)
        }.sortedWith(compareBy<Friend> { it.order }.thenBy { it.name.lowercase() })
    }

    Dialog(onDismissRequest = onDismiss) {
        Column(
            Modifier.fillMaxWidth().background(Tm.Ink900, RoundedCornerShape(20.dp)).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(stringResource(R.string.play_invite_title), style = MaterialTheme.typography.titleLarge, color = Tm.Ink100, modifier = Modifier.weight(1f))
                IconButton(onClick = onDismiss) { Icon(Icons.Filled.Close, contentDescription = stringResource(R.string.play_close), tint = Tm.Ink300) }
            }
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                singleLine = true,
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                placeholder = { Text(stringResource(R.string.play_invite_search)) },
                modifier = Modifier.fillMaxWidth(),
            )
            actions.failure?.let { FailureBanner(it, actions::dismiss) }
            val list = friends
            when {
                list == null && failed -> EmptyState(
                    stringResource(R.string.play_friends_failed),
                    action = stringResource(R.string.play_retry) to { attempt++ },
                )
                list == null -> Loading()
                else -> {
                    val shown = list.filter { query.isBlank() || "${it.name}#${it.tag}".contains(query.trim(), ignoreCase = true) }
                    if (shown.isEmpty()) {
                        EmptyState(stringResource(if (list.isEmpty()) R.string.play_friends_none else R.string.play_friends_no_match))
                    } else {
                        LazyColumn(Modifier.heightIn(max = 420.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            items(shown, key = { it.summonerId }) { friend ->
                                FriendRow(friend, data?.profileIcon(friend.icon), invited = friend.summonerId in taken || friend.summonerId in sent, actions) {
                                    actions.run("invite:${friend.summonerId}", "POST", "/lol-lobby/v2/lobby/invitations", buildJsonArray {
                                        add(buildJsonObject { put("toSummonerId", friend.summonerId) })
                                    }) { ok -> if (ok) sent = sent + friend.summonerId }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun FriendRow(friend: Friend, icon: String?, invited: Boolean, actions: PlayActions, onInvite: () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        RemoteImage(icon, 36.dp, shape = CircleShape)
        Column(Modifier.weight(1f)) {
            Row {
                Text(friend.name, color = Tm.Ink100, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                if (friend.tag.isNotEmpty()) Text(" #${friend.tag}", color = Tm.Ink500, maxLines = 1)
            }
            Text(stringResource(friend.status), style = MaterialTheme.typography.bodySmall, color = if (friend.order == 0) Tm.Success else Tm.Ink400)
        }
        if (invited) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.Check, contentDescription = null, tint = Tm.Success)
                Text(stringResource(R.string.play_invited), color = Tm.Success, style = MaterialTheme.typography.labelMedium)
            }
        } else {
            TextButton(shape = Tm.ButtonShape, onClick = onInvite, enabled = actions.idle) {
                Text(stringResource(R.string.play_invite), color = if (actions.idle) Tm.Rose400 else Tm.Ink500)
            }
        }
    }
}
