package lol.truemain.mobile.ui.history

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlinx.serialization.json.JsonElement
import lol.truemain.mobile.R
import lol.truemain.mobile.data.GameData
import lol.truemain.mobile.graph
import lol.truemain.mobile.lcu.get
import lol.truemain.mobile.lcu.int
import lol.truemain.mobile.lcu.list
import lol.truemain.mobile.lcu.str
import lol.truemain.mobile.link.LinkUnavailable
import lol.truemain.mobile.ui.components.ChampionIcon
import lol.truemain.mobile.ui.components.EmptyState
import lol.truemain.mobile.ui.components.Eyebrow
import lol.truemain.mobile.ui.components.Loading
import lol.truemain.mobile.ui.components.Panel
import lol.truemain.mobile.ui.components.rememberGameData
import lol.truemain.mobile.ui.game.ItemStrip
import lol.truemain.mobile.ui.game.LevelBadge
import lol.truemain.mobile.ui.game.SpellStack
import lol.truemain.mobile.ui.game.kdaText
import lol.truemain.mobile.ui.theme.Tm

/** One side of a full game: its result, its players, and the objectives and bans the client recorded. */
private data class TeamSheet(val teamId: Int, val players: List<Pair<PlayerLine, String>>, val record: JsonElement?)

/** All ten players of a game, read from `GET /lol-match-history/v1/games/{id}` when the row is tapped. */
@Composable
internal fun GameDetailDialog(summary: MatchSummary, onDismiss: () -> Unit) {
    val graph = LocalContext.current.graph
    val data = rememberGameData()
    var game by remember { mutableStateOf<JsonElement?>(null) }
    var failed by remember { mutableStateOf(false) }
    var attempt by remember { mutableIntStateOf(0) }

    LaunchedEffect(summary.gameId, attempt) {
        failed = false
        val response = try {
            graph.session.get("/lol-match-history/v1/games/${summary.gameId}")
        } catch (_: LinkUnavailable) {
            null
        }
        if (response?.ok == true) game = response.body else failed = true
    }

    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize(), color = Tm.Ink950) {
            Column {
                Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 4.dp, top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            resultLabel(summary.me) + " · " + queueLabel(summary.queueId, summary.gameMode),
                            style = MaterialTheme.typography.titleMedium,
                            color = resultColor(summary.me),
                        )
                        Text(
                            durationText(summary.durationSeconds) + " · " + relativeDate(summary.creation),
                            style = MaterialTheme.typography.bodySmall,
                            color = Tm.Ink400,
                        )
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Filled.Close, contentDescription = stringResource(R.string.history_close), tint = Tm.Ink300)
                    }
                }
                val loaded = game
                when {
                    loaded != null -> Scoreboard(loaded, summary.me.participantId, data)
                    failed -> EmptyState(
                        stringResource(R.string.history_detail_error),
                        action = stringResource(R.string.history_retry) to { attempt++ },
                    )
                    else -> Loading()
                }
            }
        }
    }
}

@Composable
private fun Scoreboard(game: JsonElement, myParticipantId: Int, data: GameData?) {
    val names = game.list("participantIdentities").associate { identity ->
        val player = identity["player"]
        val riotId = player.str("gameName")?.takeIf { it.isNotEmpty() }?.let { name ->
            player.str("tagLine")?.takeIf { it.isNotEmpty() }?.let { "$name#$it" } ?: name
        }
        (identity.int("participantId") ?: 0) to (riotId ?: player.str("summonerName").orEmpty())
    }
    val lines = game.list("participants").map(::playerLineOf)
    val myTeam = lines.firstOrNull { it.participantId == myParticipantId }?.teamId ?: 100
    val sheets = listOf(myTeam, if (myTeam == 100) 200 else 100).map { teamId ->
        TeamSheet(
            teamId,
            lines.filter { it.teamId == teamId }.map { it to names[it.participantId].orEmpty() },
            game.list("teams").firstOrNull { it.int("teamId") == teamId },
        )
    }
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        sheets.forEach { sheet -> item(sheet.teamId) { TeamCard(sheet, myParticipantId, data) } }
    }
}

@Composable
private fun TeamCard(sheet: TeamSheet, myParticipantId: Int, data: GameData?) {
    val blue = sheet.teamId == 100
    val won = sheet.players.firstOrNull()?.first?.win == true
    Panel(padding = 12.dp) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Eyebrow(
                stringResource(if (blue) R.string.history_side_blue else R.string.history_side_red) + " · " +
                    stringResource(if (won) R.string.history_victory else R.string.history_defeat),
                Modifier.weight(1f),
                color = if (blue) Tm.Blue else Tm.Red,
            )
            Text(
                stringResource(
                    R.string.history_team_totals,
                    sheet.players.sumOf { it.first.kills },
                    sheet.players.sumOf { it.first.deaths },
                    sheet.players.sumOf { it.first.assists },
                    thousands(sheet.players.sumOf { it.first.gold }),
                ),
                style = MaterialTheme.typography.labelMedium,
                color = Tm.Ink300,
            )
        }
        sheet.record?.let { TeamRecord(it) }
        sheet.players.forEach { (line, name) -> DetailRow(line, name, line.participantId == myParticipantId, data) }
    }
}

/** Towers, drakes, Barons, Heralds and grubs, then the bans — each only when the client recorded it. */
@Composable
private fun TeamRecord(team: JsonElement) {
    val counts = listOfNotNull(
        team.int("towerKills")?.let { R.string.history_towers to it },
        team.int("dragonKills")?.let { R.string.history_dragons to it },
        team.int("baronKills")?.let { R.string.history_barons to it },
        team.int("riftHeraldKills")?.let { R.string.history_heralds to it },
        team.int("hordeKills")?.let { R.string.history_grubs to it },
    )
    if (counts.isNotEmpty()) {
        Text(
            counts.map { (label, count) -> stringResource(label, count) }.joinToString("  ·  "),
            style = MaterialTheme.typography.labelMedium,
            color = Tm.Ink400,
        )
    }
    val bans = team.list("bans").mapNotNull { it.int("championId")?.takeIf { id -> id > 0 } }
    if (bans.isNotEmpty()) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(stringResource(R.string.history_bans), style = MaterialTheme.typography.labelMedium, color = Tm.Ink500)
            bans.forEach { ChampionIcon(it, 22.dp, grayscale = true) }
        }
    }
}

@Composable
private fun DetailRow(line: PlayerLine, name: String, isMe: Boolean, data: GameData?) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(if (isMe) Tm.Rose950 else Tm.Ink900)
            .padding(4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Box {
            ChampionIcon(line.championId, 38.dp)
            LevelBadge(line.level)
        }
        SpellStack(line.spellIds, 17.dp, data)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(
                name.ifEmpty { data?.championName(line.championId).orEmpty() },
                style = MaterialTheme.typography.bodyMedium,
                color = if (isMe) Tm.Rose300 else Tm.Ink100,
                fontWeight = if (isMe) FontWeight.SemiBold else FontWeight.Normal,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            ItemStrip(line.items, 18.dp, data)
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(kdaText(line.kills, line.deaths, line.assists), style = MaterialTheme.typography.bodyMedium, color = Tm.Ink100, fontWeight = FontWeight.Medium)
            Text(stringResource(R.string.history_cs, line.creepScore), style = MaterialTheme.typography.labelSmall, color = Tm.Ink400)
            line.damage?.let { Text(stringResource(R.string.history_damage, thousands(it)), style = MaterialTheme.typography.labelSmall, color = Tm.Ink400) }
        }
    }
}
