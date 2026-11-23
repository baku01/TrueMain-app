package lol.truemain.mobile.ui.game

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import lol.truemain.mobile.R
import lol.truemain.mobile.data.GameData
import lol.truemain.mobile.ui.components.ChampionIcon
import lol.truemain.mobile.ui.components.Eyebrow
import lol.truemain.mobile.ui.components.Panel
import lol.truemain.mobile.ui.components.RemoteImage
import lol.truemain.mobile.ui.theme.Tm

/** `754.3` → `12:34`; never negative. */
internal fun clockText(seconds: Double): String {
    val whole = seconds.coerceAtLeast(0.0).toLong()
    return "%d:%02d".format(whole / 60, whole % 60)
}

/** A side's colour, as the client draws it. */
@Composable
internal fun sideColor(side: Side) = if (side == Side.Order) Tm.Blue else Tm.Red

/** One side of the board: its players, ours first when it is ours. */
@Composable
internal fun TeamPanel(game: LiveGame, side: Side, clock: Double, data: GameData?) {
    Panel(padding = 12.dp) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            val sideName = stringResource(if (side == Side.Order) R.string.game_side_blue else R.string.game_side_red)
            Eyebrow(if (game.mySide == side) stringResource(R.string.game_your_team, sideName) else sideName, color = sideColor(side))
            Text(stringResource(R.string.game_team_kills, game.kills(side)), style = MaterialTheme.typography.labelMedium, color = Tm.Ink300)
        }
        game.team(side).forEach { PlayerRow(it, clock, data) }
    }
}

@Composable
private fun PlayerRow(player: LivePlayer, clock: Double, data: GameData?) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(if (player.isMe) Tm.Rose950 else Tm.Ink900)
            .padding(4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Box {
            ChampionIcon(player.championId, 40.dp, grayscale = player.dead)
            if (player.dead && player.respawnAt != null) {
                Text(
                    clockText(player.respawnAt - clock),
                    Modifier.align(Alignment.Center),
                    style = MaterialTheme.typography.labelMedium,
                    color = Tm.Ink100,
                    fontWeight = FontWeight.Bold,
                )
            }
            LevelBadge(player.level)
        }
        SpellStack(player.spellIds, 18.dp, data)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                player.name.substringBefore('#').ifEmpty { player.championName },
                style = MaterialTheme.typography.bodyMedium,
                color = if (player.isMe) Tm.Rose300 else Tm.Ink100,
                fontWeight = if (player.isMe) FontWeight.SemiBold else FontWeight.Normal,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            ItemStrip(player.items, 20.dp, data)
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(kdaText(player.kills, player.deaths, player.assists), style = MaterialTheme.typography.bodyMedium, color = Tm.Ink100, fontWeight = FontWeight.Medium)
            Text(stringResource(R.string.game_cs, player.creepScore), style = MaterialTheme.typography.bodySmall, color = Tm.Ink400)
        }
    }
}

internal fun kdaText(kills: Int, deaths: Int, assists: Int) = "$kills / $deaths / $assists"

/** The champion's level in the icon's corner, as the scoreboard prints it. */
@Composable
internal fun BoxScope.LevelBadge(level: Int) {
    if (level <= 0) return
    Text(
        level.toString(),
        Modifier
            .align(Alignment.BottomEnd)
            .clip(RoundedCornerShape(4.dp))
            .background(Tm.Ink950)
            .padding(horizontal = 3.dp),
        fontSize = 10.sp,
        lineHeight = 12.sp,
        color = Tm.Ink200,
    )
}

/** The two summoner spells, stacked. */
@Composable
internal fun SpellStack(spellIds: List<Int?>, size: Dp, data: GameData?) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        spellIds.take(2).forEach { id -> RemoteImage(data?.spellIcon(id), size, shape = RoundedCornerShape(4.dp)) }
    }
}

/** Seven slots, empty ones kept so the trinket stays last. */
@Composable
internal fun ItemStrip(items: List<Int?>, size: Dp, data: GameData?) {
    Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        items.forEach { id ->
            RemoteImage(data?.itemIcon(id), size, shape = RoundedCornerShape(4.dp), contentDescription = id?.let { data?.items?.get(it)?.name })
        }
    }
}
