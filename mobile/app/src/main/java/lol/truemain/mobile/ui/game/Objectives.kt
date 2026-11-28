package lol.truemain.mobile.ui.game

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import lol.truemain.mobile.R
import lol.truemain.mobile.ui.components.Eyebrow
import lol.truemain.mobile.ui.components.Panel
import lol.truemain.mobile.ui.components.percent
import lol.truemain.mobile.ui.theme.Tm

/** Drake elements as the scoreboard tints them; unknown ones stay neutral. */
@Composable
private fun drakeColor(element: String?): Color = when (element) {
    "infernal" -> Color(0xFFE5703A)
    "ocean" -> Color(0xFF4FB3C9)
    "mountain" -> Color(0xFFA8865A)
    "cloud" -> if (Tm.colors.light) Color(0xFF5B7B9A) else Color(0xFFBFD3E6)
    "hextech" -> Color(0xFF5FC9C0)
    "chemtech" -> Color(0xFF8FC24A)
    else -> Tm.Ink500
}

/** What each side took, ours on the left; buffs count down against the running clock. */
@Composable
internal fun ObjectivesPanel(objectives: Map<Side, SideObjectives>, mySide: Side?, clock: Double) {
    val left = mySide ?: Side.Order
    val sides = listOf(left, left.other)
    Panel(padding = 12.dp) {
        Eyebrow(stringResource(R.string.game_objectives))
        Row(Modifier.fillMaxWidth()) {
            Box(Modifier.weight(1f))
            sides.forEach { side ->
                Text(
                    stringResource(if (side == Side.Order) R.string.game_side_blue else R.string.game_side_red),
                    Modifier.width(96.dp),
                    style = MaterialTheme.typography.labelMedium,
                    color = sideColor(side),
                )
            }
        }
        ObjectiveRow(stringResource(R.string.game_turrets), sides) { Value(objectives[it]?.turrets?.toString()) }
        ObjectiveRow(stringResource(R.string.game_inhibitors), sides) { side ->
            Value(objectives[side]?.inhibitors?.count { clock < it }?.toString())
        }
        ObjectiveRow(stringResource(R.string.game_dragons), sides) { side ->
            val team = objectives[side]
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                Value(team?.dragons?.toString())
                team?.drakes?.forEach { Box(Modifier.size(8.dp).background(drakeColor(it), CircleShape)) }
            }
        }
        val baron = sides.any { (objectives[it]?.baronUntil ?: 0.0) > clock }
        if (baron) ObjectiveRow(stringResource(R.string.game_baron_buff), sides) { Buff(objectives[it]?.baronUntil, clock) }
        val elder = sides.any { (objectives[it]?.elderUntil ?: 0.0) > clock }
        if (elder) ObjectiveRow(stringResource(R.string.game_elder_buff), sides) { Buff(objectives[it]?.elderUntil, clock) }
    }
}

@Composable
private fun ObjectiveRow(label: String, sides: List<Side>, cell: @Composable (Side) -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(label, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium, color = Tm.Ink400)
        sides.forEach { Box(Modifier.width(96.dp)) { cell(it) } }
    }
}

@Composable
private fun Value(text: String?) {
    Text(text ?: "—", style = MaterialTheme.typography.bodyMedium, color = Tm.Ink100, fontWeight = FontWeight.Medium)
}

@Composable
private fun Buff(until: Double?, clock: Double) {
    Value(until?.takeIf { it > clock }?.let { clockText(it - clock) })
}

/** When each neutral objective is next on the map, from the desktop's timers. */
@Composable
internal fun TimersPanel(timers: NeutralTimers, clock: Double) {
    Panel(padding = 12.dp) {
        Eyebrow(stringResource(R.string.game_timers))
        TimerRow(
            stringResource(if (timers.elder) R.string.game_elder else R.string.game_dragon),
            timers.dragon,
            clock,
            if (timers.elder) null else timers.drake,
        )
        TimerRow(stringResource(R.string.game_grubs), timers.grubs, clock)
        TimerRow(stringResource(R.string.game_herald), timers.herald, clock)
        TimerRow(stringResource(R.string.game_baron), timers.baron, clock)
    }
}

@Composable
private fun TimerRow(label: String, spawn: Spawn, clock: Double, element: String? = null) {
    val at = spawn.at
    val (text, color) = when {
        at == null || (spawn.until != null && clock >= spawn.until) -> stringResource(R.string.game_timer_gone) to Tm.Ink500
        clock >= at -> stringResource(R.string.game_timer_up) to Tm.Gold
        else -> clockText(at - clock) to Tm.Ink100
    }
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        if (element != null) Box(Modifier.size(8.dp).background(drakeColor(element), CircleShape))
        Text(label, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium, color = Tm.Ink300)
        Text(text, style = MaterialTheme.typography.bodyMedium, color = color, fontWeight = FontWeight.Medium)
    }
}

/** Our health and resource bars; the API has nobody else's. */
@Composable
internal fun VitalsPanel(vitals: Vitals) {
    Panel(padding = 12.dp) {
        VitalBar(stringResource(R.string.game_health), vitals.health, Tm.Success)
        val kind = vitals.resourceKind.uppercase()
        if (kind.isNotEmpty() && kind != "NONE") {
            val label = when (kind) {
                "MANA" -> stringResource(R.string.game_mana)
                "ENERGY" -> stringResource(R.string.game_energy)
                else -> stringResource(R.string.game_resource)
            }
            VitalBar(label, vitals.resource, if (kind == "MANA") Tm.Blue else Tm.Gold)
        }
    }
}

@Composable
private fun VitalBar(label: String, share: Double, color: Color) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(label, style = MaterialTheme.typography.labelMedium, color = Tm.Ink400)
            Text(percent(share, 0), style = MaterialTheme.typography.labelMedium, color = Tm.Ink200)
        }
        LinearProgressIndicator(
            progress = { share.toFloat().coerceIn(0f, 1f) },
            modifier = Modifier.fillMaxWidth().height(6.dp),
            color = color,
            trackColor = Tm.Ink800,
            strokeCap = StrokeCap.Round,
            gapSize = 0.dp,
            drawStopIndicator = {},
        )
    }
}
