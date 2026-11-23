package lol.truemain.mobile.ui.play

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import lol.truemain.mobile.R
import lol.truemain.mobile.data.Position
import lol.truemain.mobile.ui.components.Eyebrow
import lol.truemain.mobile.ui.components.Panel
import lol.truemain.mobile.ui.theme.Tm

private const val FILL = "FILL"
private const val UNSELECTED = "UNSELECTED"
private const val PATH = "/lol-lobby/v2/lobby/members/localMember/position-preferences"

/** The lobby's own spelling of a lane (`MIDDLE`, `FILL`, `UNSELECTED`) as a player reads it. */
@Composable
fun laneLabel(value: String?): String = when (value) {
    FILL -> stringResource(R.string.position_fill)
    null, "", UNSELECTED -> stringResource(R.string.play_lane_none)
    else -> Position.of(value)?.let { stringResource(it.label) } ?: value
}

/**
 * The two lanes the player queues for. A lane taken by the other slot swaps
 * the two, as the client does, rather than asking for the same lane twice; a
 * primary fill needs no secondary, so the client clears it.
 */
@Composable
fun LaneSelect(first: String, second: String, actions: PlayActions) {
    fun choose(primary: Boolean, value: String) {
        var f = first
        var s = second
        if (primary) {
            if (value == s) s = f
            f = value
            if (f == FILL) s = UNSELECTED
        } else {
            if (value == f) f = s
            s = value
        }
        actions.run("lanes", "PUT", PATH, buildJsonObject {
            put("firstPreference", f.ifEmpty { UNSELECTED })
            put("secondPreference", s.ifEmpty { UNSELECTED })
        })
    }

    Panel {
        Eyebrow(stringResource(R.string.play_lanes))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            LaneSlot(stringResource(R.string.play_lane_primary), first, actions.idle, Modifier.weight(1f)) { choose(true, it) }
            LaneSlot(stringResource(R.string.play_lane_secondary), second, actions.idle && first != FILL, Modifier.weight(1f)) { choose(false, it) }
        }
    }
}

@Composable
private fun LaneSlot(title: String, value: String, enabled: Boolean, modifier: Modifier, onPick: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Column(modifier) {
        Text(title, style = MaterialTheme.typography.bodySmall, color = Tm.Ink400)
        Box {
            OutlinedButton(shape = Tm.ButtonShape, onClick = { open = true }, enabled = enabled, modifier = Modifier.fillMaxWidth()) {
                Text(laneLabel(value), color = if (enabled) Tm.Rose300 else Tm.Ink500)
            }
            DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
                for (lane in Position.entries.map { it.api } + FILL) {
                    DropdownMenuItem(
                        text = { Text(laneLabel(lane), color = if (lane == value) Tm.Rose400 else Tm.Ink100) },
                        onClick = {
                            open = false
                            if (lane != value) onPick(lane)
                        },
                    )
                }
            }
        }
    }
}
