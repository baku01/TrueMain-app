package lol.truemain.mobile.screens

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive

/**
 * What the client would answer through the desktop, shaped as the LCU and the
 * desktop send it (`desktop/crates/lcu`, `live-client/src/game.rs`): real
 * champion, item, spell and rune ids, so Data Dragon and Community Dragon
 * draw them.
 */
object Fixtures {
    private fun json(text: String): JsonElement = Json.parseToJsonElement(text)

    fun phase(name: String): JsonElement = JsonPrimitive(name)

    val appState = json("""{"connected": true, "phase": "None"}""")

    val summoner = json(
        """{"gameName": "Faker", "tagLine": "KR1", "profileIconId": 6, "summonerLevel": 812,
            "puuid": "p-faker", "summonerId": 1001}""",
    )

    val ranked = json(
        """{"queueMap": {
              "RANKED_SOLO_5x5": {"tier": "CHALLENGER", "division": "NA", "leaguePoints": 1523, "wins": 312, "losses": 241},
              "RANKED_FLEX_SR": {"tier": "DIAMOND", "division": "II", "leaguePoints": 47, "wins": 23, "losses": 17}
            }}""",
    )

    private data class Line(
        val champion: Int, val spells: Pair<Int, Int>, val win: Boolean, val k: Int, val d: Int, val a: Int,
        val cs: Int, val level: Int, val items: List<Int>, val queue: Int = 420, val minutes: Int = 28,
        val remake: Boolean = false,
    )

    private val lines = listOf(
        Line(103, 4 to 14, true, 9, 2, 11, 241, 17, listOf(3118, 3020, 3089, 3100, 3135, 0, 3363)),
        Line(61, 4 to 12, true, 5, 1, 14, 268, 16, listOf(6655, 3020, 3089, 3157, 0, 0, 3363), minutes = 31),
        Line(4, 4 to 14, false, 3, 6, 4, 198, 14, listOf(6653, 3020, 3157, 1026, 0, 0, 3340), minutes = 25),
        Line(238, 4 to 14, true, 14, 3, 6, 214, 16, listOf(6692, 3071, 3047, 6333, 0, 0, 3363), queue = 440, minutes = 27),
        Line(7, 4 to 14, false, 1, 0, 0, 34, 4, listOf(1056, 2003, 0, 0, 0, 0, 3340), minutes = 3, remake = true),
        Line(517, 4 to 12, true, 7, 4, 9, 233, 16, listOf(6655, 3020, 3157, 3089, 0, 0, 3363), queue = 450, minutes = 19),
        Line(134, 4 to 14, false, 6, 5, 3, 205, 15, listOf(6653, 3020, 4645, 0, 0, 0, 3363), minutes = 33),
    )

    /** `/lol-match-history/v1/products/lol/current-summoner/matches`, newest first. */
    fun history(now: Long = System.currentTimeMillis()): JsonElement {
        val games = lines.mapIndexed { index, line ->
            val items = line.items.mapIndexed { slot, id -> "\"item$slot\": $id" }.joinToString(", ")
            """{"gameId": ${7_412_000_000L + index}, "gameCreation": ${now - (index + 1) * 5_400_000L - index * 3_600_000L},
                "gameDuration": ${line.minutes * 60 + 17}, "queueId": ${line.queue},
                "gameMode": "${if (line.queue == 450) "ARAM" else "CLASSIC"}",
                "participants": [{"participantId": 1, "teamId": 100, "championId": ${line.champion},
                  "spell1Id": ${line.spells.first}, "spell2Id": ${line.spells.second},
                  "stats": {"win": ${line.win}, "gameEndedInEarlySurrender": ${line.remake}, "kills": ${line.k},
                    "deaths": ${line.d}, "assists": ${line.a}, "totalMinionsKilled": ${line.cs - 12},
                    "neutralMinionsKilled": 12, "champLevel": ${line.level}, "goldEarned": ${line.cs * 50},
                    "totalDamageDealtToChampions": ${line.k * 2400 + 9000}, $items}}]}"""
        }
        return json("""{"games": {"games": [${games.joinToString(",")}]}}""")
    }

    /** `/lol-game-queues/v1/queues`, a few of the client's own list (tutorials and TFT included, as it sends them). */
    val queues = json(
        """[
          {"id": 420, "name": "Ranked Solo/Duo", "description": "Ranked Solo/Duo", "category": "PvP", "mapId": 11, "gameMode": "CLASSIC", "queueAvailability": "Available", "isCustom": false, "isVisible": true},
          {"id": 440, "name": "Ranked Flex", "description": "Ranked Flex", "category": "PvP", "mapId": 11, "gameMode": "CLASSIC", "queueAvailability": "Available", "isCustom": false, "isVisible": true},
          {"id": 400, "name": "Normal Draft", "description": "Draft Pick", "category": "PvP", "mapId": 11, "gameMode": "CLASSIC", "queueAvailability": "Available", "isCustom": false, "isVisible": true},
          {"id": 490, "name": "Quickplay", "description": "Quickplay", "category": "PvP", "mapId": 11, "gameMode": "CLASSIC", "queueAvailability": "Available", "isCustom": false, "isVisible": true},
          {"id": 480, "name": "Swiftplay", "description": "Swiftplay", "category": "PvP", "mapId": 11, "gameMode": "SWIFTPLAY", "queueAvailability": "Available", "isCustom": false, "isVisible": true},
          {"id": 450, "name": "ARAM", "description": "ARAM", "category": "PvP", "mapId": 12, "gameMode": "ARAM", "queueAvailability": "Available", "isCustom": false, "isVisible": true},
          {"id": 1700, "name": "Arena", "description": "Arena", "category": "PvP", "mapId": 30, "gameMode": "CHERRY", "queueAvailability": "Available", "isCustom": false, "isVisible": true},
          {"id": 870, "name": "Intro", "description": "Co-op vs. AI Intro Bots", "category": "VersusAi", "mapId": 11, "gameMode": "CLASSIC", "queueAvailability": "Available", "isCustom": false, "isVisible": true},
          {"id": 880, "name": "Beginner", "description": "Co-op vs. AI Beginner Bots", "category": "VersusAi", "mapId": 11, "gameMode": "CLASSIC", "queueAvailability": "Available", "isCustom": false, "isVisible": true},
          {"id": 890, "name": "Intermediate", "description": "Co-op vs. AI Intermediate Bots", "category": "VersusAi", "mapId": 11, "gameMode": "CLASSIC", "queueAvailability": "Available", "isCustom": false, "isVisible": true},
          {"id": 2000, "name": "Tutorial 1", "description": "Tutorial", "category": "VersusAi", "mapId": 11, "gameMode": "TUTORIAL_MODULE_1", "queueAvailability": "Available", "isCustom": false, "isVisible": true},
          {"id": 1090, "name": "Teamfight Tactics", "description": "TFT", "category": "PvP", "mapId": 22, "gameMode": "TFT", "queueAvailability": "Available", "isCustom": false, "isVisible": true}
        ]""",
    )

    /** `/lol-lobby/v2/lobby`: Faker leads a ranked flex lobby, a friend invited. */
    val lobby = json(
        """{
          "canStartActivity": true,
          "gameConfig": {"queueId": 440, "maxLobbySize": 5, "showPositionSelector": true, "isCustom": false},
          "localMember": {"puuid": "p-faker", "summonerId": 1001, "isLeader": true, "allowedInviteOthers": true,
            "firstPositionPreference": "MIDDLE", "secondPositionPreference": "TOP"},
          "members": [
            {"puuid": "p-faker", "gameName": "Faker", "tagLine": "KR1", "summonerName": "Faker", "summonerIconId": 6, "summonerId": 1001,
              "isLeader": true, "firstPositionPreference": "MIDDLE", "secondPositionPreference": "TOP"},
            {"puuid": "p-oner", "gameName": "Oner", "tagLine": "KR1", "summonerName": "Oner", "summonerIconId": 5367, "summonerId": 1002,
              "isLeader": false, "firstPositionPreference": "JUNGLE", "secondPositionPreference": "UTILITY"},
            {"puuid": "p-guma", "gameName": "Gumayusi", "tagLine": "KR1", "summonerName": "Gumayusi", "summonerIconId": 4568, "summonerId": 1003,
              "isLeader": false, "firstPositionPreference": "BOTTOM", "secondPositionPreference": "FILL"}
          ],
          "invitations": [
            {"invitationId": "inv-1", "state": "Pending", "toSummonerId": 1004, "toSummonerName": "Keria"},
            {"invitationId": "inv-0", "state": "Accepted", "toSummonerId": 1002, "toSummonerName": "Oner"}
          ]
        }""",
    )

    val searching = json(
        """{"searchState": "Searching", "timeInQueue": 83.0, "estimatedQueueTime": 142.0, "errors": [],
            "lowPriorityData": {"penaltyTime": 0.0, "penaltyTimeRemaining": 0.0}}""",
    )

    val found = json("""{"searchState": "Found", "timeInQueue": 97.0, "estimatedQueueTime": 142.0, "errors": []}""")

    val readyCheck = json(
        """{"state": "InProgress", "playerResponse": "None", "timer": 3.0, "declinerIds": [], "dodgeWarning": "None"}""",
    )

    val gameflowSession = json("""{"phase": "ChampSelect", "map": {"id": 11, "gameMode": "CLASSIC"}, "gameData": {"queue": {"id": 420, "gameMode": "CLASSIC"}}}""")

    private fun cell(cellId: Int, champion: Int, intent: Int, position: String, spells: Pair<Int, Int>, name: String, skin: Int = 0) =
        """{"cellId": $cellId, "championId": $champion, "championPickIntent": $intent, "assignedPosition": "$position",
            "spell1Id": ${spells.first}, "spell2Id": ${spells.second}, "gameName": "$name", "summonerName": "$name",
            "selectedSkinId": $skin, "team": ${if (cellId < 5) 1 else 2}}"""

    private fun action(id: Int, cell: Int, type: String, champion: Int, completed: Boolean, inProgress: Boolean = false) =
        """{"id": $id, "actorCellId": $cell, "type": "$type", "championId": $champion, "completed": $completed,
            "isInProgress": $inProgress, "isAllyAction": ${cell < 5}}"""

    private val myBans = listOf(157, 238, 555, 145, 84)
    private val theirBans = listOf(119, 39, 122, 875, 266)

    /**
     * Ranked champion select, Faker in the middle seat. [locked] false: his
     * pick is open with Ahri hovered; true: every pick is in, finalization.
     */
    fun champSelect(locked: Boolean): JsonElement {
        val bans = (0 until 10).map { cell ->
            action(cell + 1, cell, "ban", if (cell < 5) myBans[cell] else theirBans[cell - 5], completed = true)
        }
        val ally3 = if (locked) 222 else 0
        val ally4 = if (locked) 497 else 0
        val enemy7 = if (locked) 61 else 0
        val enemy8 = if (locked) 110 else 0
        val enemy9 = if (locked) 111 else 0
        val picks = listOf(
            listOf(action(11, 0, "pick", 897, true)),
            listOf(action(12, 5, "pick", 58, true), action(13, 6, "pick", 254, true)),
            listOf(action(14, 1, "pick", 64, true), action(15, 2, "pick", 103, completed = locked, inProgress = !locked)),
            listOf(action(16, 7, "pick", enemy7, locked), action(17, 8, "pick", enemy8, locked)),
            listOf(action(18, 3, "pick", ally3, locked), action(19, 4, "pick", ally4, locked)),
            listOf(action(20, 9, "pick", enemy9, locked)),
        )
        val actions = (listOf(bans, listOf("""{"id": 99, "actorCellId": -1, "type": "ten_bans_reveal", "championId": 0, "completed": true, "isInProgress": false, "isAllyAction": false}""")) + picks)
            .joinToString(",") { turn -> "[" + turn.joinToString(",") + "]" }
        val myTeam = listOf(
            cell(0, 897, 0, "top", 4 to 12, "Zeus"),
            cell(1, 64, 0, "jungle", 4 to 11, "Oner"),
            cell(2, 103, 0, "middle", 4 to 14, "Faker", skin = if (locked) 103015 else 0),
            cell(3, ally3, 222, "bottom", 4 to 7, "Gumayusi"),
            cell(4, ally4, 497, "utility", 4 to 3, "Keria"),
        )
        val theirTeam = listOf(
            cell(5, 58, 0, "", 0 to 0, ""),
            cell(6, 254, 0, "", 0 to 0, ""),
            cell(7, enemy7, 0, "", 0 to 0, ""),
            cell(8, enemy8, 0, "", 0 to 0, ""),
            cell(9, enemy9, 0, "", 0 to 0, ""),
        )
        return json(
            """{
              "localPlayerCellId": 2, "isCustomGame": false, "benchEnabled": false, "benchChampions": [],
              "allowRerolling": false, "rerollsRemaining": 0,
              "myTeam": [${myTeam.joinToString(",")}], "theirTeam": [${theirTeam.joinToString(",")}],
              "bans": {"myTeamBans": [${myBans.joinToString(",")}], "theirTeamBans": [${theirBans.joinToString(",")}], "numBans": 10},
              "actions": [$actions],
              "timer": {"phase": "${if (locked) "FINALIZATION" else "BAN_PICK"}", "adjustedTimeLeftInPhase": ${if (locked) 27_000 else 23_500},
                "totalTimeInPhase": 30000, "isInfinite": false},
              "trades": [], "pickOrderSwaps": [], "positionSwaps": []
            }""",
        )
    }

    val currentRunePage = json(
        """{"id": 1801, "name": "Ahri Electrocute", "primaryStyleId": 8100, "subStyleId": 8200,
            "selectedPerkIds": [8112, 8139, 8140, 8106, 8210, 8226, 5005, 5008, 5001], "current": true, "isEditable": true}""",
    )

    val runePages = json(
        """[
          {"id": 1801, "name": "Ahri Electrocute", "primaryStyleId": 8100, "subStyleId": 8200,
            "selectedPerkIds": [8112, 8139, 8140, 8106, 8210, 8226, 5005, 5008, 5001], "current": true},
          {"id": 1802, "name": "Orianna Comet", "primaryStyleId": 8200, "subStyleId": 8300,
            "selectedPerkIds": [8229, 8226, 8210, 8237, 8345, 8347, 5008, 5008, 5001], "current": false},
          {"id": 1803, "name": "Conqueror bruiser", "primaryStyleId": 8000, "subStyleId": 8400,
            "selectedPerkIds": [8010, 9111, 9105, 8299, 8444, 8242, 5005, 5008, 5011], "current": false}
        ]""",
    )

    /** `/lol-champ-select/v1/skin-carousel-skins` for Ahri. */
    val skinCarousel = json(
        """[
          {"id": 103000, "tilePath": "/lol-game-data/assets/ASSETS/Characters/Ahri/Skins/Base/Images/ahri_splash_tile_0.jpg", "name": "Ahri", "championId": 103, "unlocked": true, "childSkins": []},
          {"id": 103001, "tilePath": "/lol-game-data/assets/ASSETS/Characters/Ahri/Skins/Skin01/Images/ahri_splash_tile_1.jpg", "name": "Dynasty Ahri", "championId": 103, "unlocked": true, "childSkins": []},
          {"id": 103014, "tilePath": "/lol-game-data/assets/ASSETS/Characters/Ahri/Skins/Skin14/Images/ahri_splash_tile_14.jpg", "name": "Star Guardian Ahri", "championId": 103, "unlocked": false, "childSkins": []},
          {"id": 103015, "tilePath": "/lol-game-data/assets/ASSETS/Characters/Ahri/Skins/Skin15/Images/ahri_splash_tile_15.jpg", "name": "K/DA Ahri", "championId": 103, "unlocked": true, "childSkins": [
            {"id": 103085, "name": "Ruby", "championId": 103, "unlocked": true},
            {"id": 103086, "name": "Obsidian", "championId": 103, "unlocked": false}
          ]},
          {"id": 103027, "tilePath": "/lol-game-data/assets/ASSETS/Characters/Ahri/Skins/Skin27/Images/ahri_splash_tile_27.jpg", "name": "Spirit Blossom Ahri", "championId": 103, "unlocked": true, "childSkins": []}
        ]""",
    )

    private fun player(
        riotId: String, alias: String, name: String, team: String, position: String, me: Boolean, spells: Pair<String, String>,
        level: Int, items: List<Int>, k: Int, d: Int, a: Int, cs: Int, respawnAt: Double? = null,
    ): String {
        val slots = items.mapIndexedNotNull { slot, id -> if (id > 0) """{"itemId": $id, "slot": $slot, "count": 1}""" else null }
        return """{"riotId": "$riotId", "champion": "$alias", "championName": "$name", "team": "$team", "position": "$position",
            "isMe": $me, "isBot": false, "level": $level, "kills": $k, "deaths": $d, "assists": $a, "creepScore": $cs, "wardScore": 14,
            "spells": [{"key": "${spells.first}", "name": ""}, {"key": "${spells.second}", "name": ""}],
            "items": [${slots.joinToString(",")}], "dead": ${respawnAt != null}, "respawnAt": ${respawnAt ?: "null"}}"""
    }

    /** `/truemain/game`: the desktop's `GameState` at 24:51, T1 up a few kills. */
    val game: JsonElement = run {
        val f = "SummonerFlash"
        val players = listOf(
            player("Zeus#KR1", "KSante", "K'Sante", "ORDER", "TOP", false, f to "SummonerTeleport", 15, listOf(3068, 3111, 3075, 0, 0, 0, 3364), 2, 3, 7, 201),
            player("Oner#KR1", "LeeSin", "Lee Sin", "ORDER", "JUNGLE", false, f to "SummonerSmite", 14, listOf(6692, 3071, 3047, 0, 0, 0, 3364), 5, 2, 9, 156),
            player("Faker#KR1", "Ahri", "Ahri", "ORDER", "MIDDLE", true, f to "SummonerDot", 16, listOf(3118, 3020, 3089, 1026, 0, 0, 3363), 8, 1, 6, 228),
            player("Gumayusi#KR1", "Jinx", "Jinx", "ORDER", "BOTTOM", false, f to "SummonerHeal", 14, listOf(3031, 3006, 3046, 0, 0, 0, 3363), 6, 2, 5, 219),
            player("Keria#KR1", "Rakan", "Rakan", "ORDER", "UTILITY", false, f to "SummonerExhaust", 12, listOf(3190, 3009, 3107, 0, 0, 0, 3364), 0, 3, 16, 31),
            player("Kiin#KR1", "Renekton", "Renekton", "CHAOS", "TOP", false, f to "SummonerTeleport", 15, listOf(6333, 6631, 3047, 0, 0, 0, 3364), 3, 4, 2, 194),
            player("Canyon#KR1", "Vi", "Vi", "CHAOS", "JUNGLE", false, f to "SummonerSmite", 13, listOf(3071, 3047, 0, 0, 0, 0, 3364), 1, 5, 4, 142, respawnAt = 1508.0),
            player("Chovy#KR1", "Orianna", "Orianna", "CHAOS", "MIDDLE", false, f to "SummonerTeleport", 15, listOf(6655, 3020, 3157, 0, 0, 0, 3363), 2, 4, 3, 236),
            player("Peyz#KR1", "Varus", "Varus", "CHAOS", "BOTTOM", false, f to "SummonerHeal", 14, listOf(3153, 3006, 3091, 0, 0, 0, 3363), 3, 3, 1, 223),
            player("Lehends#KR1", "Nautilus", "Nautilus", "CHAOS", "UTILITY", false, f to "SummonerDot", 11, listOf(3109, 3047, 0, 0, 0, 0, 3364), 0, 5, 5, 28),
        )
        json(
            """{"revision": 412, "gameTime": 1491.4, "gameMode": "CLASSIC", "mapNumber": 11, "myTeam": "ORDER", "gold": 1150,
              "players": [${players.joinToString(",")}],
              "objectives": {
                "order": {"turrets": 5, "inhibitors": [], "dragons": 2, "drakes": ["infernal", "hextech"], "baronUntil": null, "elderUntil": null},
                "chaos": {"turrets": 2, "inhibitors": [], "dragons": 1, "drakes": ["ocean"], "baronUntil": null, "elderUntil": null},
                "timers": {"dragon": {"at": 1620.0, "until": null}, "elder": false, "drake": "hextech",
                  "grubs": {"at": null, "until": null}, "herald": {"at": null, "until": null}, "baron": {"at": 1500.0, "until": null}}
              },
              "pace": {}, "vitals": {"health": 0.72, "resource": 0.41, "resourceKind": "MANA"}}""",
        )
    }

    /**
     * What the desktop sends (`utils/phone-theme.ts`) on Catppuccin's Latte and
     * Mocha, its tokens laid out as `flavorTokens` lays them.
     */
    val latte: JsonElement = Json.parseToJsonElement(
        """{"theme": "latte", "light": true, "colors": {
          "bg": "#dce0e8", "bgMuted": "#e6e9ef", "bgElevated": "#eff1f5", "bgAccented": "#d9dde5",
          "pane": "#eff1f5", "pane2": "#e6e9ef", "border": "#ccd0da", "borderAccented": "#bcc0cc",
          "primary": "#1e66f5", "textInverted": "#eff1f5", "text": "#4c4f69", "textHighlighted": "#4c4f69",
          "textToned": "#5c5f77", "textMuted": "#6c6f85", "textDimmed": "#8c8fa1",
          "success": "#40a02b", "warning": "#df8e1d", "error": "#d20f39", "gold": "#df8e1d",
          "dataGood": "#1e66f5", "dataMid": "#8c8fa1", "dataBad": "#9ca0b0", "ally": "#1e66f5", "enemy": "#d20f39",
          "tierS": "#1e66f5", "tierA": "#df8e1d", "tierB": "#7c7f93", "tierC": "#fe640b", "tierD": "#9ca0b0"}}""",
    )

    val mocha: JsonElement = Json.parseToJsonElement(
        """{"theme": "mocha", "light": false, "colors": {
          "bg": "#181825", "bgMuted": "#11111b", "bgElevated": "#262637", "bgAccented": "#313244",
          "pane": "#1e1e2e", "pane2": "#24243a", "border": "#313244", "borderAccented": "#45475a",
          "primary": "#cba6f7", "textInverted": "#11111b", "text": "#cdd6f4", "textHighlighted": "#cdd6f4",
          "textToned": "#bac2de", "textMuted": "#a6adc8", "textDimmed": "#7f849c",
          "success": "#a6e3a1", "warning": "#f9e2af", "error": "#f38ba8", "gold": "#f9e2af",
          "dataGood": "#cba6f7", "dataMid": "#7f849c", "dataBad": "#6c7086", "ally": "#89b4fa", "enemy": "#f38ba8",
          "tierS": "#cba6f7", "tierA": "#f9e2af", "tierB": "#9399b2", "tierC": "#fab387", "tierD": "#6c7086"}}""",
    )
}
