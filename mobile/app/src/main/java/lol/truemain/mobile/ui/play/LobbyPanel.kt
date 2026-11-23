package lol.truemain.mobile.ui.play

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.JsonElement
import lol.truemain.mobile.R
import lol.truemain.mobile.lcu.bool
import lol.truemain.mobile.lcu.get
import lol.truemain.mobile.lcu.int
import lol.truemain.mobile.lcu.list
import lol.truemain.mobile.lcu.long
import lol.truemain.mobile.lcu.str
import lol.truemain.mobile.session.Session
import lol.truemain.mobile.ui.components.Chip
import lol.truemain.mobile.ui.components.Eyebrow
import lol.truemain.mobile.ui.components.Panel
import lol.truemain.mobile.ui.components.PositionIcon
import lol.truemain.mobile.ui.components.RemoteImage
import lol.truemain.mobile.ui.components.rememberGameData
import lol.truemain.mobile.ui.theme.Tm

/** A member's name: Riot ID since 2023, the summoner name before (and on older clients). */
private fun JsonElement.displayName(): String =
    str("gameName")?.takeIf { it.isNotBlank() } ?: str("summonerName").orEmpty()

/**
 * The lobby the player is in: its queue, its members with their lanes, the
 * invites still out, then the lanes to pick and the button to queue. Kicking
 * and inviting follow what the client allows this player, not the screen.
 */
@Composable
fun LobbyPanel(lobby: JsonElement, catalog: QueueCatalog?, actions: PlayActions) {
    val config = lobby["gameConfig"]
    val local = lobby["localMember"]
    val localPuuid = local.str("puuid")
    val isLeader = local.bool("isLeader") == true
    val members = lobby.list("members")
    val pending = lobby.list("invitations").filter { it.str("state") == "Pending" }
    val maxSize = config.int("maxLobbySize") ?: 5
    val canInvite = local.bool("allowedInviteOthers") != false && members.size + pending.size < maxSize
    var inviting by rememberSaveable { mutableStateOf(false) }

    Panel {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Eyebrow(stringResource(R.string.play_lobby))
                Text(
                    catalog?.name(config.int("queueId")) ?: stringResource(R.string.play_queue_unknown),
                    style = MaterialTheme.typography.titleLarge,
                    color = Tm.Ink100,
                )
                Text(stringResource(R.string.play_members_count, members.size, maxSize), style = MaterialTheme.typography.bodySmall, color = Tm.Ink400)
            }
            IconButton(onClick = { actions.run("leave", "DELETE", Session.LOBBY) }, enabled = actions.idle) {
                Icon(Icons.AutoMirrored.Filled.ExitToApp, contentDescription = stringResource(R.string.play_leave), tint = Tm.Ink300)
            }
        }
        for (member in members) {
            MemberRow(
                member = member,
                isLocal = member.str("puuid") == localPuuid,
                showLanes = config.bool("showPositionSelector") == true,
                canKick = isLeader && member.str("puuid") != localPuuid,
                actions = actions,
            )
        }
        for (invite in pending) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(Modifier.size(40.dp).border(1.dp, Tm.Ink700, CircleShape))
                Text(
                    invite.str("toSummonerName")?.takeIf { it.isNotBlank() } ?: stringResource(R.string.play_invite_unknown),
                    color = Tm.Ink300,
                    modifier = Modifier.weight(1f),
                )
                Chip(stringResource(R.string.play_invite_pending), color = Tm.Gold)
            }
        }
        if (canInvite) {
            OutlinedButton(shape = Tm.ButtonShape, onClick = { inviting = true }, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Filled.Add, contentDescription = null, tint = Tm.Rose400)
                Text(stringResource(R.string.play_invite_friends), color = Tm.Rose300, modifier = Modifier.padding(start = 8.dp))
            }
        }
    }

    if (config.bool("showPositionSelector") == true) {
        LaneSelect(
            first = local.str("firstPositionPreference").orEmpty(),
            second = local.str("secondPositionPreference").orEmpty(),
            actions = actions,
        )
    }

    MatchmakingPanel(lobby, isLeader, actions)

    if (inviting) {
        val taken = (members.mapNotNull { it.long("summonerId") } + pending.mapNotNull { it.long("toSummonerId") }).toSet()
        InviteDialog(taken, actions) { inviting = false }
    }
}

@Composable
private fun MemberRow(member: JsonElement, isLocal: Boolean, showLanes: Boolean, canKick: Boolean, actions: PlayActions) {
    val data = rememberGameData()
    val summonerId = member.long("summonerId")
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        RemoteImage(
            data?.profileIcon(member.int("summonerIconId")),
            40.dp,
            shape = CircleShape,
            modifier = if (isLocal) Modifier.border(2.dp, Tm.Rose400, CircleShape) else Modifier,
        )
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    member.displayName(),
                    color = if (isLocal) Tm.Rose300 else Tm.Ink100,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                if (member.bool("isLeader") == true) {
                    Icon(Icons.Filled.Star, contentDescription = stringResource(R.string.play_leader), tint = Tm.Gold, modifier = Modifier.size(16.dp))
                }
            }
            if (showLanes) {
                val first = member.str("firstPositionPreference")
                val second = member.str("secondPositionPreference")
                val lanes = if (first == "FILL") laneLabel(first) else stringResource(R.string.play_lanes_pair, laneLabel(first), laneLabel(second))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    PositionIcon(first, size = 14.dp, tint = Tm.Gold)
                    if (first != "FILL" && !second.isNullOrEmpty() && second != "UNSELECTED") {
                        PositionIcon(second, size = 13.dp, tint = Tm.colors.primary)
                    }
                    Text(lanes, style = MaterialTheme.typography.bodySmall, color = Tm.Ink400)
                }
            }
        }
        if (canKick && summonerId != null) {
            IconButton(onClick = { actions.run("kick:$summonerId", "POST", "/lol-lobby/v2/lobby/members/$summonerId/kick") }, enabled = actions.idle) {
                Icon(Icons.Filled.Close, contentDescription = stringResource(R.string.play_kick), tint = Tm.Ink400)
            }
        }
    }
}
