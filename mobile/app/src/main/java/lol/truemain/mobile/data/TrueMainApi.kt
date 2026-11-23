package lol.truemain.mobile.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import lol.truemain.mobile.BuildConfig
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request

/**
 * TrueMain's public API, read straight from the phone (it has the internet;
 * the desktop is only its way to the client): the tier list, and a champion's
 * build on a lane — the same answers the site's pages show.
 */
class TrueMainApi(private val http: OkHttpClient) {
    private val base = "${BuildConfig.SITE_URL.trimEnd('/')}/api"

    /** `GET /champions/tierlist` (`position`: `TOP`, `JUNGLE`, `MIDDLE`, `BOTTOM`, `UTILITY`, or every lane). */
    suspend fun tierList(position: String? = null): JsonElement =
        get("/champions/tierlist", listOfNotNull(position?.let { "position" to it }))

    /** `GET /champions/{id}`: builds, runes, spells and skill order, narrowed to an opponent when known. */
    suspend fun championBuild(championId: Int, position: String? = null, opponentChampionId: Int? = null): JsonElement =
        get(
            "/champions/$championId",
            listOfNotNull(position?.let { "position" to it }, opponentChampionId?.let { "opponentChampionId" to it.toString() }),
        )

    private suspend fun get(path: String, query: List<Pair<String, String>>): JsonElement = withContext(Dispatchers.IO) {
        val url = "$base$path".toHttpUrl().newBuilder().apply { query.forEach { (k, v) -> addQueryParameter(k, v) } }.build()
        http.newCall(Request.Builder().url(url).header("Accept", "application/json").build()).execute().use { response ->
            check(response.isSuccessful) { "TrueMain answered ${response.code} for $path" }
            Json.parseToJsonElement(response.body.string())
        }
    }
}
