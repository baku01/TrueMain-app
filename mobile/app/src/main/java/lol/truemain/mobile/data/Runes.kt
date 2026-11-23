package lol.truemain.mobile.data

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import lol.truemain.mobile.lcu.get
import lol.truemain.mobile.lcu.int
import lol.truemain.mobile.lcu.items
import lol.truemain.mobile.lcu.str
import lol.truemain.mobile.link.LinkUnavailable
import lol.truemain.mobile.session.Session

/** A rune page to push: the client knows perks by id only, in slot order. */
data class RuneDraft(
    val name: String,
    val primaryStyleId: Int,
    val subStyleId: Int,
    /** Keystone, three primary runes, two secondary runes, three shards. */
    val perkIds: List<Int>,
) {
    fun toJson(): JsonElement = buildJsonObject {
        put("name", name)
        put("primaryStyleId", primaryStyleId)
        put("subStyleId", subStyleId)
        put("selectedPerkIds", buildJsonArray { perkIds.forEach { add(JsonPrimitive(it)) } })
    }

    val complete: Boolean get() = perkIds.size == 9 && primaryStyleId != subStyleId
}

enum class RuneImport { Done, NoSlot, Failed }

/** `TrueMain Ahri`, the prefix the desktop recognises as its own page (`lcu::runes::OWNED_PAGE_PREFIX`). */
fun ownedPageName(championName: String): String = "TrueMain $championName".take(25)

/**
 * The page of a TrueMain build (`GET /champions/{id}` → `builds[i].core.runePage`),
 * or null when the build carries none.
 */
fun runeDraftOf(runePage: JsonElement?, name: String): RuneDraft? {
    val primary = runePage.int("primaryStyleId") ?: return null
    val sub = runePage.int("secondaryStyleId") ?: return null
    val perks = listOf(
        "primaryKeystoneId", "primaryPerk1Id", "primaryPerk2Id", "primaryPerk3Id",
        "secondaryPerk1Id", "secondaryPerk2Id", "statOffense", "statFlex", "statDefense",
    ).map { runePage.int(it) ?: return null }
    return RuneDraft(name, primary, sub, perks)
}

/** The most played build's page in a TrueMain champion answer. */
fun topRunePage(build: JsonElement?): JsonElement? = build["builds"].items.firstOrNull()?.get("core")?.get("runePage")

/**
 * Pushes the page through the desktop (`POST /truemain/runes`), which reuses
 * the app's own page and frees a slot the way the desktop does — never a page
 * the client generated — then selects it.
 */
suspend fun Session.importRunes(draft: RuneDraft): RuneImport = try {
    val response = post("/truemain/runes", draft.toJson())
    when {
        response.ok -> RuneImport.Done
        response.status == 409 || response.body.str("error") == "no-rune-page-slot" -> RuneImport.NoSlot
        else -> RuneImport.Failed
    }
} catch (_: LinkUnavailable) {
    RuneImport.Failed
}
