package lol.truemain.mobile.ui.draft

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import lol.truemain.mobile.R
import lol.truemain.mobile.data.GameData
import lol.truemain.mobile.data.Position
import lol.truemain.mobile.ui.components.ChampionIcon
import lol.truemain.mobile.ui.components.Eyebrow
import lol.truemain.mobile.ui.components.Panel
import lol.truemain.mobile.ui.theme.Tm

private const val RECEIVED = "RECEIVED"
private const val AVAILABLE = "AVAILABLE"
private const val SENT = "SENT"

/** How an ally is named on a swap: their Riot ID if visible, else what they play or where. */
@Composable
private fun allyName(cell: Cell?, data: GameData?): String =
    cell?.name?.takeIf { it.isNotBlank() }
        ?: data?.championName(cell?.championId)?.takeIf { it.isNotBlank() }
        ?: cell?.position?.let(Position::of)?.let { stringResource(it.label) }
        ?: stringResource(R.string.draft_ally)

/**
 * Requests waiting on the player's answer, at the top of the tab: the client
 * expires them within seconds, and declining is as deliberate a tap as accepting.
 */
@Composable
fun IncomingSwaps(draft: Draft, data: GameData?, actions: DraftActions) {
    val incoming = draft.swaps.filter { it.state == RECEIVED }
    if (incoming.isEmpty()) return
    Panel {
        Eyebrow(stringResource(R.string.draft_swaps_incoming), color = Tm.Gold)
        incoming.forEach { swap ->
            val ally = draft.ally(swap.cellId)
            val name = allyName(ally, data)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ChampionIcon(ally?.shownChampion?.takeIf { it > 0 }, 40.dp)
                Text(
                    stringResource(
                        when (swap.kind) {
                            SwapKind.Trade -> R.string.draft_swap_incoming_trade
                            SwapKind.PickOrder -> R.string.draft_swap_incoming_pick_order
                            SwapKind.Position -> R.string.draft_swap_incoming_position
                        },
                        name,
                    ),
                    style = MaterialTheme.typography.bodyMedium,
                    color = Tm.Ink100,
                    modifier = Modifier.weight(1f),
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(shape = Tm.ButtonShape, 
                    onClick = { actions.swap(swap, "accept") },
                    enabled = !actions.busy,
                    colors = ButtonDefaults.buttonColors(containerColor = Tm.Rose400, contentColor = Tm.Ink950),
                    modifier = Modifier.weight(1f),
                ) { Text(stringResource(R.string.draft_accept)) }
                OutlinedButton(shape = Tm.ButtonShape, onClick = { actions.swap(swap, "decline") }, enabled = !actions.busy, modifier = Modifier.weight(1f)) {
                    Text(stringResource(R.string.draft_decline), color = Tm.Ink300)
                }
            }
        }
    }
}

/** What the player can ask of each ally, and the asks still waiting on them. */
@Composable
fun SwapOffers(draft: Draft, data: GameData?, actions: DraftActions) {
    val offers = draft.swaps.filter { it.state == AVAILABLE || it.state == SENT }
    if (offers.isEmpty()) return
    Panel {
        Eyebrow(stringResource(R.string.draft_swaps))
        offers.groupBy { it.cellId }.forEach { (cellId, swaps) ->
            val ally = draft.ally(cellId)
            Row(verticalAlignment = Alignment.CenterVertically) {
                ChampionIcon(ally?.shownChampion?.takeIf { it > 0 }, 36.dp)
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(allyName(ally, data), style = MaterialTheme.typography.bodyMedium, color = Tm.Ink100, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    swaps.forEach { swap -> SwapLine(swap, actions) }
                }
            }
        }
    }
}

@Composable
private fun SwapLine(swap: Swap, actions: DraftActions) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(
            stringResource(
                when (swap.kind) {
                    SwapKind.Trade -> R.string.draft_swap_trade
                    SwapKind.PickOrder -> R.string.draft_swap_pick_order
                    SwapKind.Position -> R.string.draft_swap_position
                },
            ),
            style = MaterialTheme.typography.labelMedium,
            color = Tm.Ink400,
            modifier = Modifier.weight(1f),
        )
        if (swap.state == SENT) {
            Text(stringResource(R.string.draft_swap_waiting), style = MaterialTheme.typography.labelMedium, color = Tm.Gold)
            TextButton(shape = Tm.ButtonShape, onClick = { actions.swap(swap, "cancel") }, enabled = !actions.busy) {
                Text(stringResource(R.string.draft_cancel), color = Tm.Ink300)
            }
        } else {
            TextButton(shape = Tm.ButtonShape, onClick = { actions.swap(swap, "request") }, enabled = !actions.busy) {
                Text(stringResource(R.string.draft_swap_request), color = Tm.Rose400)
            }
        }
    }
}
