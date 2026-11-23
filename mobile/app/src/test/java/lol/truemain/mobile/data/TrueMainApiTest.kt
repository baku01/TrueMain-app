package lol.truemain.mobile.data

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import lol.truemain.mobile.lcu.double
import lol.truemain.mobile.lcu.get
import lol.truemain.mobile.lcu.int
import lol.truemain.mobile.lcu.list
import lol.truemain.mobile.lcu.str
import lol.truemain.mobile.lcu.string
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TrueMainApiTest {
    @Test
    fun parsesLolalyticsTierListAndRecentersWinRates() {
        val raw = Json.parseToJsonElement(
            """
            {
              "tier": {
                "1": {
                  "lane": {
                    "middle": {
                      "cid": {
                        "103": { "rank": 1, "pctLane": 96.0, "wr": 53.0, "pr": 11.4, "br": 4.1, "games": 10000 }
                      }
                    }
                  }
                },
                "5": {
                  "lane": {
                    "top": {
                      "cid": {
                        "266": { "rank": 8, "pctLane": 94.0, "wr": 51.0, "pr": 8.0, "br": 5.0, "games": 10000 }
                      }
                    }
                  }
                }
              }
            }
            """.trimIndent(),
        ).jsonObject

        val result = TrueMainApi.parseTierList(raw, filterByLane = false)
        val tiers = result.list("tiers")
        assertEquals(2, tiers.size)
        assertEquals("S", tiers[0].str("tier"))
        val ahri = tiers[0].list("entries").first()
        assertEquals(103, ahri.int("championId"))
        assertEquals("MIDDLE", ahri.str("position"))
        // Average WR across both entries is 52%, so lift is +2% -> 53% becomes ~51%.
        assertEquals(0.51, ahri.double("winRate")!!, 0.001)
    }

    @Test
    fun parsesLolalyticsBuildFullIntoMobileBuildSchema() {
        val raw = Json.parseToJsonElement(
            """
            {
              "header": { "patch": "16.23", "lane": "middle", "n": 100000, "wr": 53.0, "avgWr": 51.0 },
              "spells": [["4_14", 53.4, 70.0, 70000], ["4_12", 52.0, 28.0, 28000]],
              "boots": [[3020, 53.5, 60.0, 60000, 13], [3158, 53.2, 30.0, 30000, 12]],
              "summary": {
                "pick": {
                  "skillpriority": { "id": "QWE", "n": 90000, "wr": 53.2 },
                  "skillorder": { "id": 123114121242233, "n": 50000, "wr": 55.0 },
                  "sums": { "ids": [4, 14], "n": 70000, "wr": 53.4 },
                  "runes": {
                    "wr": 52.8, "n": 80000,
                    "set": { "pri": [8112, 8139, 8140, 8106], "sec": [8226, 8210], "mod": [5005, 5008, 5001] }
                  },
                  "items": {
                    "start": { "n": 95000, "wr": 53.0, "set": [1056, 2003, 2003] },
                    "core": { "set": [3118, 3020, 4645], "wr": 53.5, "n": 25000 },
                    "item4": [{ "id": 3157, "n": 20000, "wr": 56.0 }],
                    "item5": [{ "id": 3089, "n": 10000, "wr": 58.0 }]
                  }
                }
              }
            }
            """.trimIndent(),
        ).jsonObject

        val result = TrueMainApi.parseBuildFull(raw, data = null)
        assertEquals("16.23", result.str("patch"))
        assertEquals(100000, result.int("totalGames"))
        val build = result.list("builds").first()
        assertEquals(8112, build.int("primaryKeystoneId"))
        assertEquals(3118, build.int("firstItemId"))
        val core = build["core"]
        assertEquals(8100, core["runePage"].int("primaryStyleId"))
        assertEquals(8200, core["runePage"].int("secondaryStyleId"))
        assertEquals(4, core["summonerSpells"].int("spell1Id"))
        assertEquals(14, core["summonerSpells"].int("spell2Id"))
        assertEquals(listOf(3020), core["boots"].list("itemIds").mapNotNull { it.int })
        assertEquals(listOf(3118, 4645, 3157, 3089), core["itemPath"].list("itemIds").mapNotNull { it.int })
        val seq = core["skillOrder"].list("sequence").mapNotNull { it.string }
        assertEquals(15, seq.size)
        assertEquals(listOf("Q", "W", "E", "Q", "Q", "R"), seq.take(6))
        assertTrue(build["variations"].list("boots").size == 2)
    }

    @Test
    fun mapsChampionAliasesToLolalyticsSlugs() {
        val data = GameData(
            version = "16.23.1",
            champions = mapOf(
                62 to Champion(62, "MonkeyKing", "Wukong", "", emptyList()),
                64 to Champion(64, "LeeSin", "Lee Sin", "", emptyList()),
            ),
            spells = emptyMap(),
            perks = emptyMap(),
            styles = emptyList(),
            items = emptyMap(),
        )
        assertEquals("wukong", TrueMainApi.slugFor(62, data))
        assertEquals("leesin", TrueMainApi.slugFor(64, data))
    }
}
