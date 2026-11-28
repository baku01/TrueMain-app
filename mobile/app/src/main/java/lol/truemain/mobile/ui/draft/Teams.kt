package lol.truemain.mobile.ui.draft

import android.os.SystemClock
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import kotlinx.coroutines.delay
import lol.truemain.mobile.R
import lol.truemain.mobile.data.Art
import lol.truemain.mobile.data.GameData
import lol.truemain.mobile.data.Position
import lol.truemain.mobile.ui.components.ChampionIcon
import lol.truemain.mobile.ui.components.Chip
import lol.truemain.mobile.ui.components.Eyebrow
import lol.truemain.mobile.ui.components.Panel
import lol.truemain.mobile.ui.components.PositionIcon
import lol.truemain.mobile.ui.components.RemoteImage
import lol.truemain.mobile.ui.theme.Tm

/**
 * Milliseconds left in the phase, ticked on the phone. The client only sends
 * the remaining time when the session changes, so the count is anchored to the
 * last value received and re-anchored on each new one.
 */
@Composable
fun rememberCountdown(timeLeftMs: Long, phase: String, running: Boolean = true): Long {
    var left by remember { mutableLongStateOf(timeLeftMs) }
    LaunchedEffect(timeLeftMs, phase, running) {
        left = timeLeftMs
        if (!running) return@LaunchedEffect
        val deadline = SystemClock.elapsedRealtime() + timeLeftMs
        while (true) {
            left = (deadline - SystemClock.elapsedRealtime()).coerceAtLeast(0)
            if (left == 0L) break
            delay(250)
        }
    }
    return left
}

@Composable
private fun draftPhaseLabel(phase: String): String = stringResource(
    when (phase) {
        Draft.PLANNING -> R.string.draft_phase_planning
        "BAN_PICK" -> R.string.draft_phase_ban_pick
        "FINALIZATION" -> R.string.draft_phase_finalization
        "GAME_STARTING" -> R.string.draft_phase_starting
        else -> R.string.draft_phase_other
    },
)

/** The phase, its countdown, and where the player stands in the turn order. */
@Composable
fun DraftHeader(draft: Draft, online: Boolean = true) {
    val left = rememberCountdown(draft.timeLeftMs, draft.phase, running = online)
    // The longest time seen in this phase stands for its length: the client never sends the total.
    var total by remember(draft.phase) { mutableLongStateOf(0L) }
    if (draft.timeLeftMs > total) total = draft.timeLeftMs
    val current = draft.current
    val yourTurn = current != null
    val primary = Tm.colors.primary
    val shape = RoundedCornerShape(12.dp)
    Column(
        Modifier.fillMaxWidth()
            .clip(shape)
            .background(Tm.colors.pane)
            .then(
                if (yourTurn) {
                    Modifier
                        .background(Brush.verticalGradient(listOf(primary.copy(alpha = 0.18f), Color.Transparent)))
                        .border(1.dp, primary.copy(alpha = 0.55f), shape)
                } else if (Tm.colors.light) {
                    Modifier.border(1.dp, Tm.colors.border.copy(alpha = 0.7f), shape)
                } else {
                    Modifier
                },
            )
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Eyebrow(draftPhaseLabel(draft.phase), color = if (yourTurn) Tm.Rose300 else Tm.Ink400)
                val headline = when {
                    current?.kind == ActionKind.Pick -> stringResource(R.string.draft_turn_pick)
                    current?.kind == ActionKind.Ban -> stringResource(R.string.draft_turn_ban)
                    draft.plannedPick != null -> stringResource(R.string.draft_turn_planning)
                    else -> draft.upcoming?.let { (action, turns) ->
                        when {
                            turns == 0 -> stringResource(R.string.draft_next_soon)
                            action.kind == ActionKind.Pick -> pluralStringResource(R.plurals.draft_next_pick, turns, turns)
                            else -> pluralStringResource(R.plurals.draft_next_ban, turns, turns)
                        }
                    } ?: stringResource(if (draft.locked) R.string.draft_locked_waiting else R.string.draft_waiting)
                }
                Text(
                    headline,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = if (yourTurn) Tm.Ink100 else Tm.Ink200,
                )
            }
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    stringResource(R.string.draft_seconds, ((left + 999) / 1000).toInt()),
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    color = if (!online) Tm.Ink400 else if (yourTurn && left < 10_000) Tm.Red else Tm.Ink100,
                )
                if (!online) Chip(stringResource(R.string.link_timer_paused), color = Tm.Red)
            }
        }
        if (total > 0) {
            LinearProgressIndicator(
                progress = { (left.toFloat() / total).coerceIn(0f, 1f) },
                color = if (yourTurn) Tm.Rose400 else Tm.Ink400,
                trackColor = Tm.Ink800,
                strokeCap = StrokeCap.Round,
                gapSize = 0.dp,
                drawStopIndicator = {},
                modifier = Modifier.fillMaxWidth().height(3.dp),
            )
        }
    }
}

/** Both teams side by side, allies on the blue left as the client draws them. */
@Composable
fun TeamsPanel(draft: Draft, data: GameData?) {
    Panel(padding = 12.dp) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Eyebrow(stringResource(R.string.draft_my_team), color = Tm.Blue)
                draft.myTeam.forEach { cell ->
                    CellRow(cell, data, ally = true, me = cell.cellId == draft.localCellId, acting = draft.acting(cell.cellId, ally = true))
                }
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp), horizontalAlignment = Alignment.End) {
                Eyebrow(stringResource(R.string.draft_their_team), color = Tm.Red)
                draft.theirTeam.forEach { cell ->
                    CellRow(cell, data, ally = false, me = false, acting = draft.acting(cell.cellId, ally = false))
                }
            }
        }
        BansRow(draft)
    }
}

/**
 * Broadcast-style draft band matching desktop's `DraftCard.vue`:
 * champion splash faint behind the row, side colour bar on the outer edge,
 * dark scrim so text stays razor-sharp in both light and dark themes.
 */
@Composable
private fun CellRow(cell: Cell, data: GameData?, ally: Boolean, me: Boolean, acting: Boolean) {
    val side = if (ally) Tm.Blue else Tm.Red
    val name = when {
        me -> stringResource(R.string.draft_you)
        cell.name.isNotBlank() -> cell.name
        cell.championId > 0 -> data?.championName(cell.championId).orEmpty()
        else -> stringResource(if (ally) R.string.draft_ally else R.string.draft_enemy)
    }
    val lane = Position.of(cell.position)?.let { stringResource(it.label) }
    val championId = cell.shownChampion.takeIf { it > 0 }
    val tentative = cell.championId <= 0 && championId != null
    val hasArt = championId != null
    val shape = RoundedCornerShape(8.dp)
    val darkBase = Color(0xFF0A101C)

    val ringColor = when {
        acting -> Tm.Gold
        me -> Tm.colors.primary
        else -> Color.Transparent
    }

    Box(
        Modifier
            .fillMaxWidth()
            .height(54.dp)
            .clip(shape)
            .background(if (hasArt) darkBase else Tm.colors.pane2)
            .then(if (ringColor != Color.Transparent) Modifier.border(1.5.dp, ringColor, shape) else Modifier),
    ) {
        if (championId != null) {
            AsyncImage(
                model = data?.championSplash(championId),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                alignment = Alignment.TopCenter,
                colorFilter = if (tentative) ColorFilter.colorMatrix(ColorMatrix().apply { setToSaturation(0f) }) else null,
                modifier = Modifier.matchParentSize().alpha(if (tentative) 0.28f else 0.55f),
            )
            Box(
                Modifier
                    .matchParentSize()
                    .background(
                        if (ally) {
                            Brush.horizontalGradient(
                                0f to darkBase.copy(alpha = 0.94f),
                                0.55f to darkBase.copy(alpha = 0.72f),
                                1f to darkBase.copy(alpha = 0.22f),
                            )
                        } else {
                            Brush.horizontalGradient(
                                0f to darkBase.copy(alpha = 0.22f),
                                0.45f to darkBase.copy(alpha = 0.72f),
                                1f to darkBase.copy(alpha = 0.94f),
                            )
                        },
                    ),
            )
        }

        // Outer side accent bar (left for ally, right for enemy)
        Box(
            Modifier
                .align(if (ally) Alignment.CenterStart else Alignment.CenterEnd)
                .width(3.dp)
                .fillMaxHeight()
                .background(side),
        )

        val primaryText = if (hasArt) Color.White else Tm.Ink100
        val secondaryText = if (hasArt) Color(0xFFAEB9CC) else Tm.Ink400

        val icon = @Composable {
            ChampionIcon(championId, 36.dp, grayscale = tentative)
        }
        val text = @Composable { modifier: Modifier ->
            Column(modifier, horizontalAlignment = if (ally) Alignment.Start else Alignment.End) {
                Text(
                    name,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = if (me) FontWeight.Bold else FontWeight.SemiBold,
                    color = if (me) (if (hasArt) Color(0xFF86C2FF) else Tm.colors.primary) else primaryText,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    textAlign = if (ally) TextAlign.Start else TextAlign.End,
                )
                val sub = listOfNotNull(lane, data?.championName(cell.shownChampion)?.takeIf { it.isNotBlank() && it != name }).joinToString(" · ")
                if (sub.isNotBlank()) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        if (ally && cell.position.isNotBlank()) {
                            PositionIcon(cell.position, size = 12.dp, tint = Tm.Gold.copy(alpha = 0.85f))
                        }
                        Text(
                            sub,
                            style = MaterialTheme.typography.labelMedium,
                            color = secondaryText,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
            }
        }
        val spells = @Composable {
            if (ally && cell.spell1 > 0) {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    RemoteImage(data?.spellIcon(cell.spell1), 16.dp, shape = RoundedCornerShape(3.dp))
                    RemoteImage(data?.spellIcon(cell.spell2), 16.dp, shape = RoundedCornerShape(3.dp))
                }
            }
        }
        Row(
            Modifier
                .fillMaxWidth()
                .align(Alignment.Center)
                .padding(start = if (ally) 9.dp else 6.dp, end = if (ally) 6.dp else 9.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            if (ally) {
                icon(); text(Modifier.weight(1f)); spells()
            } else {
                text(Modifier.weight(1f)); icon()
            }
        }
    }
}

/** Each side's bans; an empty slot is a ban not made (or not revealed yet). */
@Composable
private fun BansRow(draft: Draft) {
    if (draft.myBans.isEmpty() && draft.theirBans.isEmpty()) return
    Column(Modifier.fillMaxWidth().padding(top = 4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Eyebrow(stringResource(R.string.draft_bans))
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
            Bans(draft.myBans, Tm.Blue)
            Bans(draft.theirBans, Tm.Red)
        }
    }
}

@Composable
private fun Bans(bans: List<Int>, color: Color) {
    Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        bans.forEach { id ->
            Box(Modifier.border(1.dp, color.copy(alpha = 0.55f), RoundedCornerShape(5.dp)).padding(1.dp)) {
                if (id > 0) ChampionIcon(id, 22.dp, grayscale = true) else Box(Modifier.size(22.dp).width(22.dp))
            }
        }
    }
}
