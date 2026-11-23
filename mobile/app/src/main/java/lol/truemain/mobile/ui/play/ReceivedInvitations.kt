package lol.truemain.mobile.ui.play

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.JsonElement
import lol.truemain.mobile.R
import lol.truemain.mobile.lcu.get
import lol.truemain.mobile.lcu.int
import lol.truemain.mobile.lcu.items
import lol.truemain.mobile.lcu.str
import lol.truemain.mobile.ui.components.Eyebrow
import lol.truemain.mobile.ui.components.Panel
import lol.truemain.mobile.ui.theme.Tm

/**
 * The invitations waiting for an answer, over whatever the tab shows: one
 * can come in at any time, in a lobby or out of one. Answered ones stay in
 * the client's list a while, so only the pending ones are drawn.
 */
@Composable
fun ReceivedInvitations(invitations: JsonElement?, catalog: QueueCatalog?, actions: PlayActions) {
    val pending = invitations.items.filter { it.str("state") == "Pending" && !it.str("invitationId").isNullOrEmpty() }
    if (pending.isEmpty()) return
    Panel {
        Eyebrow(stringResource(R.string.play_invites_received), color = Tm.Rose300)
        for (invite in pending) {
            val id = invite.str("invitationId").orEmpty()
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Column(Modifier.weight(1f)) {
                    Text(
                        invite.str("fromSummonerName")?.takeIf { it.isNotBlank() } ?: stringResource(R.string.play_invite_someone),
                        color = Tm.Ink100,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        catalog?.name(invite["gameConfig"].int("queueId")) ?: stringResource(R.string.play_queue_unknown),
                        style = MaterialTheme.typography.bodySmall,
                        color = Tm.Ink400,
                    )
                }
                IconButton(
                    onClick = { actions.run("decline:$id", "POST", "/lol-lobby/v2/received-invitations/$id/decline") },
                    enabled = actions.idle,
                ) { Icon(Icons.Filled.Close, contentDescription = stringResource(R.string.play_decline), tint = Tm.Ink300) }
                FilledIconButton(
                    onClick = { actions.run("accept:$id", "POST", "/lol-lobby/v2/received-invitations/$id/accept") },
                    enabled = actions.idle,
                    colors = IconButtonDefaults.filledIconButtonColors(containerColor = Tm.Rose400, contentColor = Tm.Ink950),
                ) { Icon(Icons.Filled.Check, contentDescription = stringResource(R.string.play_accept)) }
            }
        }
    }
}
