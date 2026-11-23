package lol.truemain.mobile.data

import java.io.File
import java.util.Locale
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import lol.truemain.mobile.lcu.get
import lol.truemain.mobile.lcu.int
import lol.truemain.mobile.lcu.items
import lol.truemain.mobile.lcu.list
import lol.truemain.mobile.lcu.str
import lol.truemain.mobile.lcu.string
import okhttp3.OkHttpClient
import okhttp3.Request

data class Champion(val id: Int, val alias: String, val name: String, val title: String, val tags: List<String>)

data class SummonerSpell(
    val id: Int,
    val key: String,
    val name: String,
    val description: String,
    val image: String,
    /** Game modes the spell exists in (`CLASSIC`, `ARAM`…). */
    val modes: List<String>,
)

data class Perk(val id: Int, val name: String, val icon: String, val shortDesc: String)

data class PerkStyle(val id: Int, val name: String, val icon: String, val slots: List<List<Int>>)

data class Item(val id: Int, val name: String, val iconUrl: String? = null)

/** Everything the screens name and draw: champions, spells, runes, items. */
class GameData(
    val version: String,
    val champions: Map<Int, Champion>,
    val spells: Map<Int, SummonerSpell>,
    val perks: Map<Int, Perk>,
    val styles: List<PerkStyle>,
    val items: Map<Int, Item>,
) {
    fun champion(id: Int?): Champion? = id?.let(champions::get)
    fun championName(id: Int?): String = champion(id)?.name ?: ""
    fun championSplash(id: Int?): String? = champion(id)?.alias?.takeIf { it.isNotEmpty() }?.let { "$DDRAGON/cdn/img/champion/splash/${it}_0.jpg" }
    fun spellIcon(id: Int?): String? = id?.let(spells::get)?.let { "$DDRAGON/cdn/$version/img/spell/${it.image}" }
    fun itemIcon(id: Int?): String? = id?.takeIf { it > 0 }?.let {
        items[it]?.iconUrl ?: "$DDRAGON/cdn/$version/img/item/$it.png"
    }
    fun profileIcon(id: Int?): String? = id?.let { "$DDRAGON/cdn/$version/img/profileicon/$it.png" }
    fun perkIcon(id: Int?): String? = id?.let(perks::get)?.icon
    fun styleIcon(id: Int?): String? = styles.firstOrNull { it.id == id }?.icon

    /** The stat shards' three rows, as the client lists them since patch 14.1. */
    val shardRows: List<List<Int>> = listOf(listOf(5008, 5005, 5007), listOf(5008, 5010, 5001), listOf(5011, 5013, 5001))
}

/** Image addresses that need no game data: Community Dragon serves the client's own assets. */
object Art {
    private const val GAME_DATA = "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default"

    fun championIcon(id: Int?): String? = id?.takeIf { it > 0 }?.let { "$GAME_DATA/v1/champion-icons/$it.png" }
    fun championTile(championId: Int, skinId: Int): String = "$GAME_DATA/v1/champion-tiles/$championId/$skinId.jpg"
    fun championSplash(championId: Int, skinId: Int): String = "$GAME_DATA/v1/champion-splashes/$championId/$skinId.jpg"

    /** A client asset path (`/lol-game-data/assets/ASSETS/…`) as Community Dragon serves it. */
    fun lcuAsset(path: String?): String? {
        if (path.isNullOrBlank()) return null
        val relative = path.substringAfter("/lol-game-data/assets/", missingDelimiterValue = "").ifEmpty { return null }
        return "$GAME_DATA/${relative.lowercase()}"
    }
}

const val DDRAGON = "https://ddragon.leagueoflegends.com"

/**
 * Data Dragon's data for the current patch, in the phone's language when Riot
 * has it, kept on disk so a second launch draws at once and a phone offline
 * from the internet (but on the desktop's Wi-Fi) still names its champions.
 */
class StaticData(private val http: OkHttpClient, private val cacheDir: File) {
    private val _data = MutableStateFlow<GameData?>(null)
    val data: StateFlow<GameData?> = _data.asStateFlow()
    private val loading = Mutex()

    private val language: String = when (Locale.getDefault().language) {
        "pt" -> "pt_BR"
        "es" -> "es_ES"
        "fr" -> "fr_FR"
        "de" -> "de_DE"
        else -> "en_US"
    }

    suspend fun load(): GameData? = loading.withLock {
        _data.value?.let { return it }
        val loaded = withContext(Dispatchers.IO) { runCatching { read() }.getOrNull() }
        _data.value = loaded
        loaded
    }

    private fun read(): GameData {
        val version = runCatching { fetch("$DDRAGON/api/versions.json") }.getOrNull()?.get(0).string
            ?: cached("version")?.string
            ?: error("no Data Dragon version")
        save("version", Json.parseToJsonElement("\"$version\""))
        val base = "$DDRAGON/cdn/$version/data/$language"
        val champions = load("champion-$version-$language", "$base/champion.json")
        val spells = load("summoner-$version-$language", "$base/summoner.json")
        val runes = load("runes-$version-$language", "$base/runesReforged.json")
        val items = load("item-$version-$language", "$base/item.json")
        val shardsLanguage = if (language == "en_US") "default" else language.lowercase()
        val perks = runCatching {
            load("perks-$shardsLanguage", "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/$shardsLanguage/v1/perks.json")
        }.getOrNull()
        // Community Dragon's items.json covers every client item (Arena, ARAM, Ornn, quest/boots upgrades)
        // that Data Dragon's item.json omits or renames.
        val cdragonItems = runCatching {
            load("cdragon-items-$version", "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/items.json")
        }.getOrNull()

        val perkMap = HashMap<Int, Perk>()
        for (perk in perks.items) {
            val id = perk.int("id") ?: continue
            perkMap[id] = Perk(id, perk.str("name").orEmpty(), Art.lcuAsset(perk.str("iconPath")).orEmpty(), perk.str("shortDesc").orEmpty())
        }
        val styles = runes.items.mapNotNull { style ->
            val id = style.int("id") ?: return@mapNotNull null
            val slots = style.list("slots").map { slot ->
                slot.list("runes").mapNotNull { rune ->
                    val runeId = rune.int("id") ?: return@mapNotNull null
                    // Data Dragon's own icon and text in the phone's language win over Community Dragon's.
                    perkMap[runeId] = Perk(
                        runeId,
                        rune.str("name").orEmpty(),
                        "$DDRAGON/cdn/img/${rune.str("icon")}",
                        rune.str("shortDesc").orEmpty().replace(Regex("<[^>]+>"), ""),
                    )
                    runeId
                }
            }
            PerkStyle(id, style.str("name").orEmpty(), "$DDRAGON/cdn/img/${style.str("icon")}", slots)
        }

        val itemMap = HashMap<Int, Item>()
        for (item in cdragonItems.items) {
            val id = item.int("id") ?: continue
            val icon = Art.lcuAsset(item.str("iconPath"))
            itemMap[id] = Item(id, item.str("name").orEmpty(), icon)
        }
        for ((key, item) in (items["data"] as? JsonObject).orEmpty()) {
            val id = key.toIntOrNull() ?: continue
            val image = item["image"].str("full")?.takeIf { it.isNotEmpty() }
            val ddIcon = image?.let { "$DDRAGON/cdn/$version/img/item/$it" } ?: itemMap[id]?.iconUrl
            itemMap[id] = Item(id, item.str("name").orEmpty(), ddIcon)
        }

        return GameData(
            version = version,
            champions = (champions["data"] as? JsonObject).orEmpty().values.mapNotNull { champion ->
                val id = champion.str("key")?.toIntOrNull() ?: return@mapNotNull null
                id to Champion(id, champion.str("id").orEmpty(), champion.str("name").orEmpty(), champion.str("title").orEmpty(), champion.list("tags").mapNotNull { it.string })
            }.toMap(),
            spells = (spells["data"] as? JsonObject).orEmpty().values.mapNotNull { spell ->
                val id = spell.str("key")?.toIntOrNull() ?: return@mapNotNull null
                id to SummonerSpell(
                    id, spell.str("id").orEmpty(), spell.str("name").orEmpty(), spell.str("description").orEmpty(),
                    spell["image"].str("full").orEmpty(), spell.list("modes").mapNotNull { it.string },
                )
            }.toMap(),
            perks = perkMap,
            styles = styles,
            items = itemMap,
        )
    }

    private fun load(name: String, url: String): JsonElement = cached(name) ?: fetch(url).also { save(name, it) }

    private fun fetch(url: String): JsonElement =
        http.newCall(Request.Builder().url(url).build()).execute().use { response ->
            check(response.isSuccessful) { "$url answered ${response.code}" }
            Json.parseToJsonElement(response.body.string())
        }

    private fun file(name: String) = File(cacheDir, "static/$name.json")

    private fun cached(name: String): JsonElement? =
        file(name).takeIf { it.exists() }?.let { runCatching { Json.parseToJsonElement(it.readText()) }.getOrNull() }

    private fun save(name: String, value: JsonElement) {
        runCatching { file(name).apply { parentFile?.mkdirs() }.writeText(value.toString()) }
    }
}
