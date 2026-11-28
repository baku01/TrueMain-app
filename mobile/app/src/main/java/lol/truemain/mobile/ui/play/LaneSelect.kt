package lol.truemain.mobile.ui.play

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import lol.truemain.mobile.R
import lol.truemain.mobile.data.Position
import lol.truemain.mobile.ui.components.Eyebrow
import lol.truemain.mobile.ui.components.Panel
import lol.truemain.mobile.ui.components.PositionIcon
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
            LaneSlot(stringResource(R.string.play_lane_primary), first, primary = true, enabled = actions.idle, modifier = Modifier.weight(1f)) { choose(true, it) }
            LaneSlot(stringResource(R.string.play_lane_secondary), second, primary = false, enabled = actions.idle && first != FILL, modifier = Modifier.weight(1f)) { choose(false, it) }
        }
    }
}

@Composable
private fun LaneSlot(title: String, value: String, primary: Boolean, enabled: Boolean, modifier: Modifier, onPick: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(10.dp)
    val selected = value.isNotEmpty() && value != UNSELECTED
    val iconTint = when {
        !enabled -> Tm.Ink500
        primary && selected -> Tm.Gold
        selected -> Tm.colors.primary
        else -> Tm.Ink400
    }
    val borderColor = when {
        !enabled -> Tm.colors.border.copy(alpha = 0.4f)
        primary && selected -> Tm.Gold.copy(alpha = 0.55f)
        selected -> Tm.colors.primary.copy(alpha = 0.45f)
        else -> Tm.colors.border
    }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(title, style = MaterialTheme.typography.labelMedium, color = Tm.Ink400)
        Box {
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(shape)
                    .background(Tm.colors.pane2)
                    .border(1.dp, borderColor, shape)
                    .alpha(if (enabled) 1f else 0.5f)
                    .clickable(enabled = enabled) { open = true }
                    .padding(horizontal = 12.dp, vertical = 11.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                PositionIcon(value, size = 20.dp, tint = iconTint)
                Text(
                    laneLabel(value),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = if (enabled) Tm.Ink100 else Tm.Ink500,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Icon(Icons.Filled.ArrowDropDown, contentDescription = null, tint = if (enabled) Tm.Ink400 else Tm.Ink500)
            }
            DropdownMenu(
                expanded = open,
                onDismissRequest = { open = false },
                containerColor = Tm.colors.bgElevated,
            ) {
                for (lane in Position.entries.map { it.api } + FILL) {
                    val isCurrent = lane == value
                    DropdownMenuItem(
                        leadingIcon = {
                            PositionIcon(
                                lane,
                                size = 20.dp,
                                tint = if (isCurrent) Tm.Gold else Tm.colors.primary,
                            )
                        },
                        text = {
                            Text(
                                laneLabel(lane),
                                fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Medium,
                                color = if (isCurrent) Tm.Gold else Tm.Ink100,
                            )
                        },
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
