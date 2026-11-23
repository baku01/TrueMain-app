package lol.truemain.mobile.ui.draft

import kotlinx.serialization.json.JsonElement
import lol.truemain.mobile.lcu.bool
import lol.truemain.mobile.lcu.get
import lol.truemain.mobile.lcu.int
import lol.truemain.mobile.lcu.items
import lol.truemain.mobile.lcu.list
import lol.truemain.mobile.lcu.long
import lol.truemain.mobile.lcu.str

/** One seat of a team, as `myTeam[]`/`theirTeam[]` list it. */
data class Cell(
    val cellId: Int,
    val championId: Int,
    val pickIntent: Int,
    val position: String,
    val spell1: Int,
    val spell2: Int,
    val name: String,
    val skinId: Int,
) {
    /** What the seat shows: the champion picked or hovered, else the declared intent. */
    val shownChampion: Int get() = championId.takeIf { it > 0 } ?: pickIntent

    companion object {
        fun of(json: JsonElement) = Cell(
            cellId = json.int("cellId") ?: -1,
            championId = json.int("championId") ?: 0,
            pickIntent = json.int("championPickIntent") ?: 0,
            position = json.str("assignedPosition").orEmpty(),
            spell1 = json.int("spell1Id") ?: 0,
            spell2 = json.int("spell2Id") ?: 0,
            name = json.str("gameName")?.takeIf { it.isNotBlank() } ?: json.str("summonerName").orEmpty(),
            skinId = json.int("selectedSkinId") ?: 0,
        )
    }
}

enum class ActionKind(val lcu: String) { Pick("pick"), Ban("ban") }

/** A pick or ban turn; `ten_bans_reveal` and other bookkeeping steps never become one. */
data class Action(
    val id: Int,
    val actorCellId: Int,
    val championId: Int,
    val completed: Boolean,
    val inProgress: Boolean,
    val ally: Boolean,
    val kind: ActionKind,
)

/** A trade, pick-order swap or position swap the client offers with one ally. */
data class Swap(val kind: SwapKind, val id: Int, val cellId: Int, val state: String)

/** The three exchanges, by the path segment the client serves them under. */
enum class SwapKind(val path: String) { Trade("trades"), PickOrder("pick-order-swaps"), Position("position-swaps") }

/**
 * The session reduced to what the screen asks of it. The client's document is
 * re-read on every event, so this is rebuilt from scratch each time rather than
 * patched: a stale field can never survive an update.
 */
data class Draft(
    val localCellId: Int,
    val myTeam: List<Cell>,
    val theirTeam: List<Cell>,
    val myBans: List<Int>,
    val theirBans: List<Int>,
    /** Turns that hold a pick or a ban, in draft order. */
    val turns: List<List<Action>>,
    val phase: String,
    val timeLeftMs: Long,
    val benchEnabled: Boolean,
    val bench: List<Int>,
    val allowRerolling: Boolean,
    val rerollsRemaining: Int,
    val swaps: List<Swap>,
    val isCustomGame: Boolean,
) {
    val me: Cell? get() = myTeam.firstOrNull { it.cellId == localCellId }

    private val mine: List<Action> get() = turns.flatten().filter { it.actorCellId == localCellId && it.ally }

    /** The action the client has open for us right now. */
    val current: Action? get() = mine.firstOrNull { it.inProgress && !it.completed }

    /** In planning, no turn is open but our first pick can carry an intent for the allies. */
    val plannedPick: Action? get() = if (phase == PLANNING) mine.firstOrNull { it.kind == ActionKind.Pick && !it.completed } else null

    /** What a champion tap writes to, if anything. */
    val target: Action? get() = current ?: plannedPick

    /** Our next action still to come, and how many turns away it opens. */
    val upcoming: Pair<Action, Int>? get() {
        if (current != null) return null
        val index = turns.indexOfFirst { turn -> turn.any { it.actorCellId == localCellId && it.ally && !it.completed } }
        if (index < 0) return null
        val open = turns.indexOfFirst { turn -> turn.any { it.inProgress } }
            .takeIf { it >= 0 } ?: turns.indexOfFirst { turn -> turn.any { !it.completed } }
        val action = turns[index].first { it.actorCellId == localCellId && it.ally && !it.completed }
        return action to (index - open).coerceAtLeast(0)
    }

    /** Locked in: our picks are all done, or there were none to do (ARAM gives the champion). */
    val locked: Boolean get() {
        val picks = mine.filter { it.kind == ActionKind.Pick }
        return (me?.championId ?: 0) > 0 && picks.all { it.completed }
    }

    /** The champion our runes and build are for: picked, hovered or planned. */
    val myChampion: Int get() = me?.shownChampion ?: 0

    /** Champions already committed by anyone, so the grid can say why one is out. */
    val taken: Set<Int> get() = buildSet {
        addAll(myBans); addAll(theirBans)
        turns.flatten().filter { it.completed && it.championId > 0 }.forEach { add(it.championId) }
        (myTeam + theirTeam).filter { it.championId > 0 }.forEach { add(it.championId) }
        remove(0)
    }

    /** Whether a cell is acting in the open turn: the client's "picking…" glow. */
    fun acting(cellId: Int, ally: Boolean): Boolean = turns.flatten().any { it.actorCellId == cellId && it.ally == ally && it.inProgress }

    fun ally(cellId: Int): Cell? = myTeam.firstOrNull { it.cellId == cellId }

    /** The enemy laning against us, when the client tells their lanes (it rarely does in ranked). */
    val opponentChampion: Int? get() {
        val lane = me?.position?.takeIf { it.isNotBlank() } ?: return null
        return theirTeam.firstOrNull { it.position == lane && it.championId > 0 }?.championId
    }

    companion object {
        const val PLANNING = "PLANNING"

        fun of(json: JsonElement): Draft = Draft(
            localCellId = json.int("localPlayerCellId") ?: -1,
            myTeam = json.list("myTeam").map(Cell::of),
            theirTeam = json.list("theirTeam").map(Cell::of),
            myBans = json["bans"].list("myTeamBans").mapNotNull { it.int },
            theirBans = json["bans"].list("theirTeamBans").mapNotNull { it.int },
            turns = json.list("actions").map { turn -> turn.items.mapNotNull(::actionOf) }.filter { it.isNotEmpty() },
            phase = json["timer"].str("phase").orEmpty(),
            timeLeftMs = json["timer"].long("adjustedTimeLeftInPhase") ?: 0L,
            benchEnabled = json.bool("benchEnabled") == true,
            bench = json.list("benchChampions").mapNotNull { it.int("championId") },
            allowRerolling = json.bool("allowRerolling") == true,
            rerollsRemaining = json.int("rerollsRemaining") ?: 0,
            swaps = SwapKind.entries.flatMap { kind ->
                json.list(kind.path.camel()).mapNotNull { swap ->
                    Swap(kind, swap.int("id") ?: return@mapNotNull null, swap.int("cellId") ?: -1, swap.str("state").orEmpty())
                }
            },
            isCustomGame = json.bool("isCustomGame") == true,
        )

        private fun actionOf(json: JsonElement): Action? {
            val kind = when (json.str("type")) {
                "pick" -> ActionKind.Pick
                "ban" -> ActionKind.Ban
                else -> return null
            }
            return Action(
                id = json.int("id") ?: return null,
                actorCellId = json.int("actorCellId") ?: -1,
                championId = json.int("championId") ?: 0,
                completed = json.bool("completed") == true,
                inProgress = json.bool("isInProgress") == true,
                ally = json.bool("isAllyAction") == true,
                kind = kind,
            )
        }

        /** `pick-order-swaps` → `pickOrderSwaps`, the session's field for the same list. */
        private fun String.camel(): String = split('-').mapIndexed { i, part -> if (i == 0) part else part.replaceFirstChar(Char::uppercase) }.joinToString("")
    }
}
