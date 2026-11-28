package lol.truemain.mobile.data

import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request

/**
 * Fetches tier lists and champion builds from the same external source the
 * desktop app leads with (Lolalytics, Emerald+ — never TrueMain's own API),
 * shaping the response into the JSON structure the mobile screens consume.
 */
class TrueMainApi(
    private val http: OkHttpClient,
    private val staticData: StaticData,
) {
    @Volatile
    private var tierSnapshotCache: CachedSnapshot? = null
    private val buildCache = ConcurrentHashMap<String, Cached>()

    private data class Cached(val atMs: Long, val body: JsonElement)
    private data class CachedSnapshot(val atMs: Long, val snapshot: TierSnapshot)

    private suspend fun loadTierSnapshot(forceRefresh: Boolean = false): TierSnapshot {
        val now = System.currentTimeMillis()
        if (!forceRefresh) {
            tierSnapshotCache?.takeIf { now - it.atMs < CACHE_TTL_MS }?.let { return it.snapshot }
        }

        val raw = fetchLolalytics(
            mapOf(
                "ep" to "tier",
                "lane" to "all",
                "tier" to DEFAULT_TIER,
            ),
        )
        val fallbackPatch = runCatching { staticData.load()?.version?.split(".")?.take(2)?.joinToString(".") }.getOrNull()
        val snapshot = parseTierSnapshot(raw, fallbackPatch)
        tierSnapshotCache = CachedSnapshot(now, snapshot)
        return snapshot
    }

    /** `tier` endpoint: Emerald+ tier list, always read once from `lane=all` and filtered in memory. */
    suspend fun tierList(position: String? = null, forceRefresh: Boolean = false): JsonElement {
        val snapshot = loadTierSnapshot(forceRefresh)
        return formatTierList(snapshot, position)
    }

    /** `build-full` endpoint: runes, spells, starters, boots, core items, and skill order. */
    suspend fun championBuild(
        championId: Int,
        position: String? = null,
        opponentChampionId: Int? = null,
    ): JsonElement {
        val data = staticData.load()
        val slug = slugFor(championId, data)
            ?: error("Unknown champion $championId")
        val lane = position?.let(::toLolalyticsLane) ?: "default"
        val key = "$championId:$lane"
        val now = System.currentTimeMillis()
        buildCache[key]?.takeIf { now - it.atMs < CACHE_TTL_MS }?.let { return it.body }

        val snapshot = runCatching { loadTierSnapshot() }.getOrNull()
        val raw = fetchLolalytics(
            mapOf(
                "ep" to "build-full",
                "c" to slug,
                "lane" to lane,
                "tier" to DEFAULT_TIER,
            ),
        )
        val headerLane = (raw["header"] as? JsonObject)?.get("lane")?.jsonPrimitive?.content
        val resolvedPos = position?.uppercase() ?: headerLane?.let(::fromLolalyticsLane)
        val tierRow = resolvedPos?.let { pos -> snapshot?.rows?.firstOrNull { it.championId == championId && it.position == pos } }
        val parsed = parseBuildFull(raw, data, bracketLift = snapshot?.lift, tierRow = tierRow)
        buildCache[key] = Cached(now, parsed)
        return parsed
    }

    private suspend fun fetchLolalytics(params: Map<String, String>): JsonObject = withContext(Dispatchers.IO) {
        val url = LOLALYTICS_BASE.toHttpUrl().newBuilder().apply {
            addQueryParameter("p", "d")
            addQueryParameter("v", "1")
            addQueryParameter("queue", "420")
            addQueryParameter("region", "all")
            params.forEach { (k, v) -> addQueryParameter(k, v) }
        }.build()
        val request = Request.Builder()
            .url(url)
            .header("Accept", "application/json")
            .header("User-Agent", "TrueMain-Mobile")
            .build()
        http.newCall(request).execute().use { response ->
            check(response.isSuccessful) { "Lolalytics answered ${response.code}" }
            Json.parseToJsonElement(response.body.string()).jsonObject
        }
    }

    companion object {
        private const val LOLALYTICS_BASE = "https://a1.lolalytics.com/mega/"
        private const val DEFAULT_TIER = "emerald_plus"
        private const val CACHE_TTL_MS = 20 * 60 * 1000L
        private const val NO_BOOTS = 9999

        private val GRADES = listOf(
            "S+", "S", "S-", "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-",
        )
        private val BOOTS_IDS = setOf(1001, 3006, 3009, 3020, 3047, 3111, 3117, 3158, 3010, 3013)
        private val QUEST_REWARDS = setOf(3869, 3870, 3871, 3876, 3877)

        internal fun toLolalyticsLane(position: String): String = when (position.uppercase()) {
            "TOP" -> "top"
            "JUNGLE" -> "jungle"
            "MIDDLE" -> "middle"
            "BOTTOM" -> "bottom"
            "UTILITY" -> "support"
            else -> "default"
        }

        internal fun fromLolalyticsLane(lane: String): String = when (lane.lowercase()) {
            "top" -> "TOP"
            "jungle" -> "JUNGLE"
            "middle" -> "MIDDLE"
            "bottom" -> "BOTTOM"
            "support" -> "UTILITY"
            else -> lane.uppercase()
        }

        internal fun slugFor(championId: Int, data: GameData?): String? {
            val alias = data?.champion(championId)?.alias?.takeIf { it.isNotBlank() } ?: return null
            val clean = alias.lowercase().replace(Regex("[^a-z0-9]"), "")
            return when (clean) {
                "monkeyking" -> "wukong"
                "nunuwillump" -> "nunu"
                "renataglasc" -> "renata"
                else -> clean
            }
        }

        private fun lowered(wrPercent: Double, lift: Double): Double =
            ((wrPercent / 100.0) - lift).coerceIn(0.0, 1.0)

        internal data class TierRow(
            val tier: String,
            val tierScore: Int,
            val championId: Int,
            val position: String,
            val games: Int,
            val wrPercent: Double,
            val winRate: Double,
            val pickRate: Double,
            val banRate: Double,
            val lanePlayRate: Double,
        )

        internal data class TierSnapshot(
            val lift: Double,
            val rows: List<TierRow>,
            val patchVersion: String? = null,
        )

        internal fun parseTierSnapshot(raw: JsonObject, fallbackPatch: String? = null): TierSnapshot {
            val headerPatch = (raw["header"] as? JsonObject)?.get("patch")?.jsonPrimitive?.content?.takeIf { it.isNotBlank() }
            val patchVersion = headerPatch ?: fallbackPatch?.takeIf { it.isNotBlank() }
            val tierObj = raw["tier"] as? JsonObject ?: return TierSnapshot(0.0, emptyList(), patchVersion)
            val rawRows = mutableListOf<TierRow>()
            var totalGames = 0L
            var weightedWr = 0.0

            for ((gradeKey, gradeValue) in tierObj) {
                val step = gradeKey.toIntOrNull() ?: continue
                val letter = (GRADES.getOrNull(step - 1) ?: "D").first().toString()
                val laneMap = (gradeValue as? JsonObject)?.get("lane") as? JsonObject ?: continue
                for ((laneKey, laneValue) in laneMap) {
                    val cidMap = (laneValue as? JsonObject)?.get("cid") as? JsonObject ?: continue
                    val pos = fromLolalyticsLane(laneKey)
                    for ((cidKey, entryEl) in cidMap) {
                        val cid = cidKey.toIntOrNull() ?: continue
                        val entry = entryEl as? JsonObject ?: continue
                        val games = entry["games"]?.jsonPrimitive?.intOrNull ?: 0
                        val wr = entry["wr"]?.jsonPrimitive?.doubleOrNull ?: 50.0
                        val pr = entry["pr"]?.jsonPrimitive?.doubleOrNull ?: 0.0
                        val br = entry["br"]?.jsonPrimitive?.doubleOrNull ?: 0.0
                        val pctLane = entry["pctLane"]?.jsonPrimitive?.doubleOrNull ?: 100.0
                        totalGames += games
                        weightedWr += games * (wr / 100.0)
                        rawRows += TierRow(
                            tier = letter,
                            tierScore = 16 - step,
                            championId = cid,
                            position = pos,
                            games = games,
                            wrPercent = wr,
                            winRate = 0.0,
                            pickRate = pr / 100.0,
                            banRate = br / 100.0,
                            lanePlayRate = pctLane / 100.0,
                        )
                    }
                }
            }

            val lift = if (totalGames > 0) (weightedWr / totalGames) - 0.5 else 0.0
            val rows = rawRows.map { it.copy(winRate = lowered(it.wrPercent, lift)) }
            return TierSnapshot(lift, rows, patchVersion)
        }

        internal fun formatTierList(
            snapshot: TierSnapshot,
            position: String? = null,
            minLanePlayRate: Double = if (position == null) 0.08 else 0.02,
        ): JsonElement {
            val targetPos = position?.uppercase()
            val visible = snapshot.rows.filter { row ->
                (targetPos == null || row.position == targetPos) && row.lanePlayRate >= minLanePlayRate
            }

            return buildJsonObject {
                snapshot.patchVersion?.let { put("patchVersion", it) }
                put(
                    "tiers",
                    buildJsonArray {
                        for (tier in listOf("S", "A", "B", "C", "D")) {
                            val entries = visible
                                .filter { it.tier == tier }
                                .sortedWith(compareByDescending<TierRow> { it.tierScore }.thenByDescending { it.winRate })
                            if (entries.isEmpty()) continue
                            add(
                                buildJsonObject {
                                    put("tier", tier)
                                    put(
                                        "entries",
                                        buildJsonArray {
                                            for (row in entries) {
                                                add(
                                                    buildJsonObject {
                                                        put("championId", row.championId)
                                                        put("position", row.position)
                                                        put("games", row.games)
                                                        put("winRate", row.winRate)
                                                        put("pickRate", row.pickRate)
                                                        put("banRate", row.banRate)
                                                    },
                                                )
                                            }
                                        },
                                    )
                                },
                            )
                        }
                    },
                )
            }
        }

        internal fun parseTierList(raw: JsonObject, filterByLane: Boolean, position: String? = null): JsonElement {
            val snapshot = parseTierSnapshot(raw)
            return formatTierList(snapshot, position, minLanePlayRate = if (filterByLane && position == null) 0.0 else if (position == null) 0.08 else 0.02)
        }

        internal fun parseBuildFull(
            raw: JsonObject,
            data: GameData?,
            bracketLift: Double? = null,
            tierRow: TierRow? = null,
        ): JsonElement {
            val header = raw["header"] as? JsonObject ?: return buildJsonObject {
                put("builds", JsonArray(emptyList()))
            }
            val patch = header["patch"]?.jsonPrimitive?.content ?: ""
            val headerGames = header["n"]?.jsonPrimitive?.intOrNull ?: 0
            val rawWr = header["wr"]?.jsonPrimitive?.doubleOrNull ?: 50.0
            val avgWrDelta = header["avgWrDelta"]?.jsonPrimitive?.doubleOrNull
            val avgWr = header["avgWr"]?.jsonPrimitive?.doubleOrNull
            // Prefer the bracket's global lift from `ep=tier&lane=all` (identical to the tier list);
            // otherwise use `avgWrDelta` or `wr - avgWr` (`avgWr` is already the normalized win rate).
            val lift = bracketLift
                ?: avgWrDelta?.div(100.0)
                ?: avgWr?.let { (rawWr - it) / 100.0 }
                ?: 0.0
            val totalGames = tierRow?.games ?: headerGames
            val overallWr = tierRow?.winRate ?: lowered(rawWr, lift)
            val totalWins = kotlin.math.round(totalGames * overallWr).toInt()

            val spellVariations = parseSpellRows(raw["spells"] as? JsonArray, lift)
            val bootVariations = parseBootRows(raw["boots"] as? JsonArray, lift)

            val summary = raw["summary"] as? JsonObject
            val pickSummary = summary?.get("pick") as? JsonObject
            val winSummary = summary?.get("win") as? JsonObject

            val built = mutableListOf<JsonObject>()
            pickSummary?.let { buildOption(it, totalGames, lift, data, spellVariations, bootVariations)?.let(built::add) }
            winSummary?.let { winOpt ->
                val option = buildOption(winOpt, totalGames, lift, data, spellVariations, bootVariations)
                if (option != null && built.none { sameSignature(it, option) }) {
                    built.add(option)
                }
            }

            return buildJsonObject {
                put("patch", patch)
                put("totalGames", totalGames)
                put("totalWins", totalWins)
                put("minSampleMet", totalGames >= 50)
                put("builds", JsonArray(built))
            }
        }

        private fun sameSignature(a: JsonObject, b: JsonObject): Boolean =
            a["primaryKeystoneId"] == b["primaryKeystoneId"] && a["firstItemId"] == b["firstItemId"]

        private fun buildOption(
            summary: JsonObject,
            totalGames: Int,
            lift: Double,
            data: GameData?,
            spellVariations: List<JsonObject>,
            bootVariations: List<JsonObject>,
        ): JsonObject? {
            val runesObj = summary["runes"] as? JsonObject
            val runeSet = runesObj?.get("set") as? JsonObject
            val pri = (runeSet?.get("pri") as? JsonArray)?.mapNotNull { it.jsonPrimitive.intOrNull }.orEmpty()
            val sec = (runeSet?.get("sec") as? JsonArray)?.mapNotNull { it.jsonPrimitive.intOrNull }.orEmpty()
            val mod = (runeSet?.get("mod") as? JsonArray)?.mapNotNull { it.jsonPrimitive.intOrNull }.orEmpty()
            if (pri.size < 4 || sec.size < 2 || mod.size < 3) return null

            val primaryStyleId = styleOfPerk(pri[0], data) ?: 8000
            val secondaryStyleId = styleOfPerk(sec[0], data) ?: 8200
            val runeGames = runesObj?.get("n")?.jsonPrimitive?.intOrNull ?: 0
            val runeWr = lowered(runesObj?.get("wr")?.jsonPrimitive?.doubleOrNull ?: 50.0, lift)

            val sumsObj = summary["sums"] as? JsonObject
            val sumIds = (sumsObj?.get("ids") as? JsonArray)?.mapNotNull { it.jsonPrimitive.intOrNull }.orEmpty()
            val sumGames = sumsObj?.get("n")?.jsonPrimitive?.intOrNull ?: 0
            val sumWr = lowered(sumsObj?.get("wr")?.jsonPrimitive?.doubleOrNull ?: 50.0, lift)

            val itemsObj = summary["items"] as? JsonObject
            val startObj = itemsObj?.get("start") as? JsonObject
            val startIds = (startObj?.get("set") as? JsonArray)?.mapNotNull { it.jsonPrimitive.intOrNull }.orEmpty()
            val startGames = startObj?.get("n")?.jsonPrimitive?.intOrNull ?: 0
            val startWr = lowered(startObj?.get("wr")?.jsonPrimitive?.doubleOrNull ?: 50.0, lift)

            val coreObj = itemsObj?.get("core") as? JsonObject
            val rawCoreIds = (coreObj?.get("set") as? JsonArray)?.mapNotNull { it.jsonPrimitive.intOrNull }.orEmpty()
                .filterNot { it in QUEST_REWARDS }
            val coreGames = coreObj?.get("n")?.jsonPrimitive?.intOrNull ?: runeGames
            val coreWr = lowered(coreObj?.get("wr")?.jsonPrimitive?.doubleOrNull ?: 50.0, lift)

            val bootsInCore = rawCoreIds.firstOrNull { it in BOOTS_IDS }
            val topBoot = bootVariations.firstOrNull()
            val bootBlock = if (bootsInCore != null) {
                bootVariations.firstOrNull {
                    (it["itemIds"] as? JsonArray)?.firstOrNull()?.jsonPrimitive?.intOrNull == bootsInCore
                } ?: buildJsonObject {
                    put("itemIds", JsonArray(listOf(JsonPrimitive(bootsInCore))))
                    put("winRate", coreWr)
                    put("pickRate", share(coreGames, totalGames))
                    put("games", coreGames)
                }
            } else {
                topBoot ?: buildJsonObject {
                    put("itemIds", JsonArray(emptyList()))
                }
            }

            val coreItems = rawCoreIds.filterNot { it in BOOTS_IDS }.toMutableList()
            for (slot in listOf("item4", "item5", "item6")) {
                val topNext = (itemsObj?.get(slot) as? JsonArray)?.firstOrNull() as? JsonObject
                val id = topNext?.get("id")?.jsonPrimitive?.intOrNull ?: continue
                if (id > 0 && id !in coreItems && id !in BOOTS_IDS && id !in QUEST_REWARDS) {
                    coreItems.add(id)
                }
            }
            val firstItemId = coreItems.firstOrNull() ?: rawCoreIds.firstOrNull() ?: 0

            val skillOrderObj = summary["skillorder"] as? JsonObject
            val skillPrioObj = summary["skillpriority"] as? JsonObject
            val skillSeq = parseSkillSequence(skillOrderObj?.get("id")?.jsonPrimitive?.content)
                .ifEmpty { parseSkillPriority(skillPrioObj?.get("id")?.jsonPrimitive?.content) }
            val skillGames = (skillOrderObj ?: skillPrioObj)?.get("n")?.jsonPrimitive?.intOrNull ?: 0
            val skillWr = lowered((skillOrderObj ?: skillPrioObj)?.get("wr")?.jsonPrimitive?.doubleOrNull ?: 50.0, lift)

            val buildGames = if (coreGames > 0) coreGames else runeGames
            val buildPickRate = share(buildGames, totalGames)

            val spellsBlock = if (sumIds.size >= 2) {
                buildJsonObject {
                    put("spell1Id", sumIds[0])
                    put("spell2Id", sumIds[1])
                    put("winRate", sumWr)
                    put("pickRate", share(sumGames, totalGames))
                    put("games", sumGames)
                }
            } else {
                spellVariations.firstOrNull() ?: buildJsonObject {}
            }

            return buildJsonObject {
                put("primaryKeystoneId", pri[0])
                put("firstItemId", firstItemId)
                put("winRate", coreWr)
                put("pickRate", buildPickRate)
                put("games", buildGames)
                put(
                    "core",
                    buildJsonObject {
                        put(
                            "runePage",
                            buildJsonObject {
                                put("primaryStyleId", primaryStyleId)
                                put("primaryKeystoneId", pri[0])
                                put("primaryPerk1Id", pri[1])
                                put("primaryPerk2Id", pri[2])
                                put("primaryPerk3Id", pri[3])
                                put("secondaryStyleId", secondaryStyleId)
                                put("secondaryPerk1Id", sec[0])
                                put("secondaryPerk2Id", sec[1])
                                put("statOffense", mod[0])
                                put("statFlex", mod[1])
                                put("statDefense", mod[2])
                                put("winRate", runeWr)
                                put("pickRate", share(runeGames, totalGames))
                                put("games", runeGames)
                            },
                        )
                        put("summonerSpells", spellsBlock)
                        put(
                            "starterItems",
                            buildJsonObject {
                                put("itemIds", JsonArray(startIds.map(::JsonPrimitive)))
                                put("winRate", startWr)
                                put("pickRate", share(startGames, totalGames))
                                put("games", startGames)
                            },
                        )
                        put("boots", bootBlock)
                        put(
                            "itemPath",
                            buildJsonObject {
                                put("itemIds", JsonArray(coreItems.map(::JsonPrimitive)))
                                put("winRate", coreWr)
                                put("pickRate", buildPickRate)
                                put("games", buildGames)
                            },
                        )
                        put(
                            "skillOrder",
                            buildJsonObject {
                                put("sequence", JsonArray(skillSeq.map(::JsonPrimitive)))
                                put("winRate", skillWr)
                                put("pickRate", share(skillGames, totalGames))
                                put("games", skillGames)
                            },
                        )
                    },
                )
                put(
                    "variations",
                    buildJsonObject {
                        put("summonerSpells", JsonArray(spellVariations))
                        put("boots", JsonArray(bootVariations))
                    },
                )
            }
        }

        private fun parseSpellRows(rows: JsonArray?, lift: Double): List<JsonObject> =
            rows?.mapNotNull { el ->
                val arr = el as? JsonArray ?: return@mapNotNull null
                val ids = arr.getOrNull(0)?.jsonPrimitive?.content?.split("_")?.mapNotNull { it.toIntOrNull() }
                    ?: return@mapNotNull null
                if (ids.size < 2) return@mapNotNull null
                val wr = arr.getOrNull(1)?.jsonPrimitive?.doubleOrNull ?: return@mapNotNull null
                val pr = arr.getOrNull(2)?.jsonPrimitive?.doubleOrNull ?: 0.0
                val n = arr.getOrNull(3)?.jsonPrimitive?.intOrNull ?: 0
                buildJsonObject {
                    put("spell1Id", ids[0])
                    put("spell2Id", ids[1])
                    put("winRate", lowered(wr, lift))
                    put("pickRate", pr / 100.0)
                    put("games", n)
                }
            }?.take(4).orEmpty()

        private fun parseBootRows(rows: JsonArray?, lift: Double): List<JsonObject> =
            rows?.mapNotNull { el ->
                val arr = el as? JsonArray ?: return@mapNotNull null
                val id = arr.getOrNull(0)?.jsonPrimitive?.intOrNull ?: return@mapNotNull null
                if (id <= 0 || id == NO_BOOTS) return@mapNotNull null
                val wr = arr.getOrNull(1)?.jsonPrimitive?.doubleOrNull ?: return@mapNotNull null
                val pr = arr.getOrNull(2)?.jsonPrimitive?.doubleOrNull ?: 0.0
                val n = arr.getOrNull(3)?.jsonPrimitive?.intOrNull ?: 0
                buildJsonObject {
                    put("itemIds", JsonArray(listOf(JsonPrimitive(id))))
                    put("winRate", lowered(wr, lift))
                    put("pickRate", pr / 100.0)
                    put("games", n)
                }
            }?.take(4).orEmpty()

        private fun parseSkillSequence(digits: String?): List<String> {
            if (digits.isNullOrBlank()) return emptyList()
            return digits.mapNotNull { ch ->
                when (ch) {
                    '1' -> "Q"
                    '2' -> "W"
                    '3' -> "E"
                    '4' -> "R"
                    else -> null
                }
            }
        }

        private fun parseSkillPriority(prio: String?): List<String> =
            prio?.uppercase()?.mapNotNull { ch -> if (ch in "QWER") ch.toString() else null }.orEmpty()

        private fun styleOfPerk(perkId: Int, data: GameData?): Int? {
            data?.styles?.firstOrNull { style -> style.slots.any { perkId in it } }?.let { return it.id }
            return when (perkId / 100) {
                80 -> 8000 // Precision
                81, 99 -> 8100 // Domination
                82 -> 8200 // Sorcery
                83 -> 8300 // Inspiration
                84 -> 8400 // Resolve
                else -> null
            }
        }

        private fun share(part: Int, total: Int): Double =
            if (total > 0) (part.toDouble() / total.toDouble()).coerceIn(0.0, 1.0) else 0.0
    }
}
