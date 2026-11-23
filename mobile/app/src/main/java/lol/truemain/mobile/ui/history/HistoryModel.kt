package lol.truemain.mobile.ui.history

import android.text.format.DateUtils
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.JsonElement
import lol.truemain.mobile.R
import lol.truemain.mobile.lcu.bool
import lol.truemain.mobile.lcu.get
import lol.truemain.mobile.lcu.int
import lol.truemain.mobile.lcu.list
import lol.truemain.mobile.lcu.long
import lol.truemain.mobile.lcu.str
import lol.truemain.mobile.link.LinkUnavailable
import lol.truemain.mobile.session.Session
import lol.truemain.mobile.ui.theme.Tm

/** One participant's line of a finished game (`lcu::record::HistoryParticipant`). */
data class PlayerLine(
    val participantId: Int,
    val teamId: Int,
    val championId: Int?,
    val spellIds: List<Int?>,
    val win: Boolean,
    val remake: Boolean,
    val kills: Int,
    val deaths: Int,
    val assists: Int,
    val creepScore: Int,
    val level: Int,
    val gold: Int,
    val damage: Int?,
    val items: List<Int?>,
)

/** A game of the player's history, as its row shows it. */
data class MatchSummary(
    val gameId: Long,
    /** Epoch milliseconds. */
    val creation: Long,
    val durationSeconds: Long,
    val queueId: Int,
    val gameMode: String,
    val me: PlayerLine,
)

/** Above this the client reported the duration in milliseconds (`lcu::record`, old games). */
private const val DURATION_IN_MS_ABOVE = 100_000L

internal fun durationOf(game: JsonElement?): Long {
    val raw = game.long("gameDuration") ?: 0L
    return if (raw > DURATION_IN_MS_ABOVE) raw / 1000 else raw
}

internal fun playerLineOf(participant: JsonElement?): PlayerLine {
    val stats = participant["stats"]
    return PlayerLine(
        participantId = participant.int("participantId") ?: 0,
        teamId = participant.int("teamId") ?: 0,
        championId = participant.int("championId"),
        spellIds = listOf(participant.int("spell1Id"), participant.int("spell2Id")),
        win = stats.bool("win") == true,
        remake = stats.bool("gameEndedInEarlySurrender") == true,
        kills = stats.int("kills") ?: 0,
        deaths = stats.int("deaths") ?: 0,
        assists = stats.int("assists") ?: 0,
        creepScore = (stats.int("totalMinionsKilled") ?: 0) + (stats.int("neutralMinionsKilled") ?: 0),
        level = stats.int("champLevel") ?: 0,
        gold = stats.int("goldEarned") ?: 0,
        damage = stats.int("totalDamageDealtToChampions"),
        items = (0..6).map { stats.int("item$it")?.takeIf { id -> id > 0 } },
    )
}

private fun summaryOf(game: JsonElement): MatchSummary? {
    val participant = game.list("participants").firstOrNull() ?: return null
    return MatchSummary(
        gameId = game.long("gameId") ?: return null,
        creation = game.long("gameCreation") ?: 0L,
        durationSeconds = durationOf(game),
        queueId = game.int("queueId") ?: -1,
        gameMode = game.str("gameMode").orEmpty(),
        me = playerLineOf(participant),
    )
}

/**
 * The player's history, ten games a page, read through the desktop. The
 * client pages with an inclusive end index, newest first (`LcuClient::match_history`).
 */
internal class HistoryPager(private val session: Session) {
    var games by mutableStateOf<List<MatchSummary>>(emptyList())
        private set
    var loading by mutableStateOf(false)
        private set
    var failed by mutableStateOf(false)
        private set
    var exhausted by mutableStateOf(false)
        private set
    private val lock = Mutex()

    suspend fun reload() = lock.withLock { page(0, replace = true) }

    suspend fun more() = lock.withLock { page(games.size, replace = false) }

    private suspend fun page(from: Int, replace: Boolean) {
        loading = true
        failed = false
        try {
            val response = session.get("$PATH?begIndex=$from&endIndex=${from + PAGE - 1}")
            if (!response.ok) {
                failed = true
                return
            }
            val page = response.body["games"].list("games").mapNotNull(::summaryOf)
            games = ((if (replace) emptyList() else games) + page).distinctBy { it.gameId }.sortedByDescending { it.creation }
            exhausted = page.size < PAGE
        } catch (_: LinkUnavailable) {
            failed = true
        } finally {
            loading = false
        }
    }

    private companion object {
        const val PATH = "/lol-match-history/v1/products/lol/current-summoner/matches"
        const val PAGE = 10
    }
}

/** Victory, defeat or remake, as the row and the detail colour them. */
@Composable
internal fun resultColor(line: PlayerLine): Color = when {
    line.remake -> Tm.Ink500
    line.win -> Tm.Blue
    else -> Tm.Red
}

@Composable
internal fun resultLabel(line: PlayerLine): String = stringResource(
    when {
        line.remake -> R.string.history_remake
        line.win -> R.string.history_victory
        else -> R.string.history_defeat
    },
)

/** The queue's name, the game mode's code where the queue is not one we name. */
@Composable
internal fun queueLabel(queueId: Int, gameMode: String): String = when (queueId) {
    420 -> stringResource(R.string.history_queue_solo)
    440 -> stringResource(R.string.history_queue_flex)
    400 -> stringResource(R.string.history_queue_draft)
    430 -> stringResource(R.string.history_queue_blind)
    450 -> stringResource(R.string.history_queue_aram)
    480 -> stringResource(R.string.history_queue_swiftplay)
    490 -> stringResource(R.string.history_queue_quickplay)
    700, 720 -> stringResource(R.string.history_queue_clash)
    900, 1900 -> stringResource(R.string.history_queue_urf)
    1700, 1710 -> stringResource(R.string.history_queue_arena)
    0 -> stringResource(R.string.history_queue_custom)
    in 830..899 -> stringResource(R.string.history_queue_bots)
    else -> gameMode.lowercase().replaceFirstChar(Char::uppercase)
}

internal fun durationText(seconds: Long): String = "%d:%02d".format(seconds / 60, seconds % 60)

/** "3 hours ago", in the phone's language. */
internal fun relativeDate(millis: Long): String =
    DateUtils.getRelativeTimeSpanString(millis, System.currentTimeMillis(), DateUtils.MINUTE_IN_MILLIS).toString()

/** `(K + A) / D` to two digits; null when deathless, which the row calls perfect. */
internal fun kdaRatio(line: PlayerLine): String? =
    line.deaths.takeIf { it > 0 }?.let { "%.2f".format((line.kills + line.assists).toDouble() / it) }

/** `12 345` → `12.3k`. */
internal fun thousands(value: Int): String = if (value >= 1000) "%.1fk".format(value / 1000.0) else value.toString()
