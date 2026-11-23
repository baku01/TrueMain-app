package lol.truemain.mobile.ui.game

import kotlinx.serialization.json.JsonElement
import lol.truemain.mobile.data.GameData
import lol.truemain.mobile.lcu.bool
import lol.truemain.mobile.lcu.double
import lol.truemain.mobile.lcu.get
import lol.truemain.mobile.lcu.int
import lol.truemain.mobile.lcu.isNull
import lol.truemain.mobile.lcu.list
import lol.truemain.mobile.lcu.str
import lol.truemain.mobile.lcu.string

/** A side of the map, as the game names it (`ORDER` blue, `CHAOS` red). */
enum class Side {
    Order,
    Chaos;

    val other: Side get() = if (this == Order) Chaos else Order

    companion object {
        fun of(value: String?): Side? = when (value?.uppercase()) {
            "ORDER" -> Order
            "CHAOS" -> Chaos
            else -> null
        }
    }
}

data class LivePlayer(
    /** `Name#TAG`, or a bot's display name. */
    val name: String,
    val championId: Int?,
    val championName: String,
    val side: Side,
    val isMe: Boolean,
    val level: Int,
    val kills: Int,
    val deaths: Int,
    val assists: Int,
    val creepScore: Int,
    /** Item id by slot — `0..5` the inventory, `6` the trinket; null an empty slot. */
    val items: List<Int?>,
    val spellIds: List<Int?>,
    val dead: Boolean,
    /** The game time the player is back at, while dead. */
    val respawnAt: Double?,
)

data class SideObjectives(
    val turrets: Int,
    /** For each enemy inhibitor destroyed, the game time it stands again. */
    val inhibitors: List<Double>,
    val dragons: Int,
    /** Slain drakes' elements in order (`infernal`, `ocean`…). */
    val drakes: List<String>,
    val baronUntil: Double?,
    val elderUntil: Double?,
)

/** A neutral objective's next appearance: on the map from [at] (null: not again this game), gone at [until]. */
data class Spawn(val at: Double?, val until: Double?)

data class NeutralTimers(val dragon: Spawn, val elder: Boolean, val drake: String?, val grubs: Spawn, val herald: Spawn, val baron: Spawn)

/** Shares of the bar, 0–1. */
data class Vitals(val health: Double, val resource: Double, val resourceKind: String)

/**
 * One reading of the game, whichever source it came from. The desktop's
 * derived state carries the objectives and timers; the raw live client
 * fallback only what one payload says, so those stay null rather than guessed.
 */
data class LiveGame(
    val gameTime: Double,
    val gameMode: String,
    /** Null when spectating: no player is ours. */
    val mySide: Side?,
    val players: List<LivePlayer>,
    /** Our unspent gold; the API has no one else's. */
    val gold: Int?,
    val objectives: Map<Side, SideObjectives>?,
    val timers: NeutralTimers?,
    val vitals: Vitals?,
) {
    fun team(side: Side): List<LivePlayer> = players.filter { it.side == side }
    fun kills(side: Side): Int = team(side).sumOf { it.kills }
}

private const val CHAMPION_PREFIX = "game_character_displayname_"
private const val SPELL_PREFIX = "GeneratedTip_SummonerSpell_"
private const val SPELL_SUFFIX = "_DisplayName"

/** The live client names champions, not ids: the alias first (`MonkeyKing`), else the display name. */
internal fun GameData?.championIdOf(alias: String?, name: String?): Int? {
    val champions = this?.champions?.values ?: return null
    alias?.takeIf { it.isNotEmpty() }?.let { a -> champions.firstOrNull { it.alias.equals(a, ignoreCase = true) }?.let { return it.id } }
    val display = name?.takeIf { it.isNotEmpty() } ?: return null
    return champions.firstOrNull { it.name.equals(display, ignoreCase = true) || it.alias.equals(display, ignoreCase = true) }?.id
}

/** Data Dragon's spell key (`SummonerFlash`) first, its display name when the key is unknown. */
private fun GameData?.spellIdOf(key: String?, name: String?): Int? {
    val spells = this?.spells?.values ?: return null
    return (key?.takeIf { it.isNotEmpty() }?.let { k -> spells.firstOrNull { it.key == k } }
        ?: name?.takeIf { it.isNotEmpty() }?.let { n -> spells.firstOrNull { it.name.equals(n, ignoreCase = true) } })?.id
}

private fun slots(items: List<JsonElement>, idKey: String): List<Int?> =
    (0..6).map { slot -> items.firstOrNull { it.int("slot") == slot }?.int(idKey)?.takeIf { it > 0 } }

/** The desktop's `GameState` (`live-client/src/game.rs`, camelCase), or null when it holds no game. */
fun liveGameOfState(state: JsonElement?, data: GameData?): LiveGame? {
    if (state.isNull) return null
    val players = state.list("players").mapNotNull { p ->
        val side = Side.of(p.str("team")) ?: return@mapNotNull null
        LivePlayer(
            name = p.str("riotId").orEmpty(),
            championId = data.championIdOf(p.str("champion"), p.str("championName")),
            championName = p.str("championName").orEmpty(),
            side = side,
            isMe = p.bool("isMe") == true,
            level = p.int("level") ?: 0,
            kills = p.int("kills") ?: 0,
            deaths = p.int("deaths") ?: 0,
            assists = p.int("assists") ?: 0,
            creepScore = p.int("creepScore") ?: 0,
            items = slots(p.list("items"), "itemId"),
            spellIds = p.list("spells").map { data.spellIdOf(it.str("key"), it.str("name")) },
            dead = p.bool("dead") == true,
            respawnAt = p.double("respawnAt"),
        )
    }
    if (players.isEmpty()) return null
    val playing = players.any { it.isMe }
    val objectives = state["objectives"]
    return LiveGame(
        gameTime = state.double("gameTime") ?: 0.0,
        gameMode = state.str("gameMode").orEmpty(),
        mySide = Side.of(state.str("myTeam")),
        players = players,
        gold = state.int("gold")?.takeIf { playing },
        objectives = if (objectives.isNull) null else mapOf(Side.Order to sideOf(objectives["order"]), Side.Chaos to sideOf(objectives["chaos"])),
        timers = objectives["timers"].takeUnless { it.isNull }?.let(::timersOf),
        vitals = state["vitals"].takeIf { playing && !it.isNull }?.let {
            Vitals(it.double("health") ?: 0.0, it.double("resource") ?: 0.0, it.str("resourceKind").orEmpty())
        },
    )
}

private fun sideOf(team: JsonElement?) = SideObjectives(
    turrets = team.int("turrets") ?: 0,
    inhibitors = team.list("inhibitors").mapNotNull { it.double },
    dragons = team.int("dragons") ?: 0,
    drakes = team.list("drakes").mapNotNull { it.string },
    baronUntil = team.double("baronUntil"),
    elderUntil = team.double("elderUntil"),
)

private fun spawnOf(spawn: JsonElement?) = Spawn(spawn.double("at"), spawn.double("until"))

private fun timersOf(timers: JsonElement) = NeutralTimers(
    dragon = spawnOf(timers["dragon"]),
    elder = timers.bool("elder") == true,
    drake = timers.str("drake"),
    grubs = spawnOf(timers["grubs"]),
    herald = spawnOf(timers["herald"]),
    baron = spawnOf(timers["baron"]),
)

/**
 * The game's own `GET /liveclientdata/allgamedata`, read while the desktop has
 * no state for the game yet. The loading screen (no players, or no
 * `GameStart` event) is no game, as the desktop reads it.
 */
fun liveGameOfPayload(payload: JsonElement?, data: GameData?): LiveGame? {
    if (payload.isNull) return null
    val started = payload["events"].list("Events").any { it.str("EventName") == "GameStart" }
    if (!started) return null
    val me = payload["activePlayer"]
    val time = payload["gameData"].double("gameTime") ?: 0.0
    val players = payload.list("allPlayers").mapNotNull { p ->
        val side = Side.of(p.str("team")) ?: return@mapNotNull null
        val riotId = p.str("riotId").orEmpty()
        val dead = p.bool("isDead") == true
        LivePlayer(
            name = riotId.ifEmpty { p.str("summonerName").orEmpty() },
            championId = data.championIdOf(p.str("rawChampionName")?.takeIf { it.startsWith(CHAMPION_PREFIX) }?.removePrefix(CHAMPION_PREFIX), p.str("championName")),
            championName = p.str("championName").orEmpty(),
            side = side,
            isMe = same(me.str("riotId"), riotId) || same(me.str("summonerName"), p.str("summonerName")) ||
                (riotId.isEmpty() && same(me.str("riotIdGameName"), p.str("riotIdGameName"))),
            level = p.int("level") ?: 0,
            kills = p["scores"].int("kills") ?: 0,
            deaths = p["scores"].int("deaths") ?: 0,
            assists = p["scores"].int("assists") ?: 0,
            creepScore = p["scores"].int("creepScore") ?: 0,
            items = slots(p.list("items"), "itemID"),
            spellIds = listOf("summonerSpellOne", "summonerSpellTwo").map { slot ->
                val spell = p["summonerSpells"][slot]
                val key = spell.str("rawDisplayName")?.takeIf { it.startsWith(SPELL_PREFIX) && it.endsWith(SPELL_SUFFIX) }
                    ?.removePrefix(SPELL_PREFIX)?.removeSuffix(SPELL_SUFFIX)
                data.spellIdOf(key, spell.str("displayName"))
            },
            dead = dead,
            respawnAt = if (dead) time + (p.double("respawnTimer") ?: 0.0).coerceAtLeast(0.0) else null,
        )
    }
    if (players.isEmpty()) return null
    val playing = players.any { it.isMe }
    val stats = me["championStats"]
    return LiveGame(
        gameTime = time,
        gameMode = payload["gameData"].str("gameMode").orEmpty(),
        mySide = players.firstOrNull { it.isMe }?.side,
        players = players,
        gold = me.double("currentGold")?.toInt()?.takeIf { playing },
        objectives = null,
        timers = null,
        vitals = if (playing) {
            Vitals(
                share(stats.double("currentHealth"), stats.double("maxHealth")),
                share(stats.double("resourceValue"), stats.double("resourceMax")),
                stats.str("resourceType").orEmpty(),
            )
        } else {
            null
        },
    )
}

private fun same(a: String?, b: String?): Boolean = !a.isNullOrEmpty() && a.equals(b, ignoreCase = true)

private fun share(value: Double?, max: Double?): Double =
    if (value == null || max == null || max <= 0.0) 0.0 else (value / max).coerceIn(0.0, 1.0)
