package lol.truemain.mobile.session

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import lol.truemain.mobile.lcu.bool
import lol.truemain.mobile.lcu.isNull
import lol.truemain.mobile.lcu.str
import lol.truemain.mobile.lcu.string
import lol.truemain.mobile.link.LinkClient
import lol.truemain.mobile.link.LinkResponse
import lol.truemain.mobile.link.LinkState
import lol.truemain.mobile.link.LinkUnavailable

/**
 * The client as the phone sees it: one `StateFlow` per endpoint the desktop
 * forwards (`phone_link::allow::EVENTS`), filled by a read when the link
 * opens and kept current by the events after. A screen collects the
 * endpoints it shows; nothing polls.
 */
class Session(private val link: LinkClient, private val scope: CoroutineScope) {
    private val flows = FOLLOWED.associateWith { MutableStateFlow<JsonElement?>(null) }

    init {
        scope.launch {
            link.events.collect { event ->
                flows[event.uri]?.value = event.payload.takeUnless { it.isNull }
            }
        }
        scope.launch {
            link.state.collect { state ->
                if (state is LinkState.Open) refreshAll()
                if (state is LinkState.NotPaired || state is LinkState.Revoked) flows.values.forEach { it.value = null }
            }
        }
        // When the League client opens or finishes logging in after the phone was already connected,
        // re-read every followed LCU endpoint so phase, lobby, runes and history appear dynamically.
        scope.launch {
            state(APP_STATE)
                .map { (it.bool("connected") == true) to it.str("riotId") }
                .distinctUntilChanged()
                .collect { (connected, riotId) ->
                    if (connected && link.state.value is LinkState.Open) {
                        for (uri in FOLLOWED) if (uri != APP_STATE && uri != THEME) scope.launch { refresh(uri) }
                    } else if (!connected && riotId == null) {
                        for (uri in FOLLOWED) if (uri != APP_STATE && uri != THEME) flows[uri]?.value = null
                    }
                }
        }
    }

    /** The endpoint's current body; null while there is none (no lobby, no champion select). */
    fun state(uri: String): StateFlow<JsonElement?> =
        flows[uri]?.asStateFlow() ?: error("$uri is not an endpoint the desktop forwards")

    val phase: StateFlow<String> = state(GAMEFLOW_PHASE)
        .map { it.string ?: "None" }
        .stateIn(scope, SharingStarted.Eagerly, "None")

    /** Read every followed endpoint again: on opening, and when a screen asks. */
    fun refreshAll() {
        for (uri in FOLLOWED) scope.launch { refresh(uri) }
    }

    suspend fun refresh(uri: String) {
        val flow = flows[uri] ?: return
        val response = runCatching { link.request("GET", uri) }.getOrNull() ?: return
        flow.value = if (response.ok) response.body.takeUnless { it.isNull } else null
    }

    suspend fun get(path: String): LinkResponse = link.request("GET", path)
    suspend fun post(path: String, body: JsonElement? = null): LinkResponse = link.request("POST", path, body)
    suspend fun put(path: String, body: JsonElement? = null): LinkResponse = link.request("PUT", path, body)
    suspend fun patch(path: String, body: JsonElement? = null): LinkResponse = link.request("PATCH", path, body)
    suspend fun delete(path: String): LinkResponse = link.request("DELETE", path)

    /** A write, answered with whether the client took it; a lost link reads as refused. */
    suspend fun act(method: String, path: String, body: JsonElement? = null): Boolean = try {
        link.request(method, path, body).ok
    } catch (_: LinkUnavailable) {
        false
    }

    companion object {
        const val APP_STATE = "/truemain/state"
        const val GAME = "/truemain/game"
        /** The desktop's theme (`ui/theme/ThemeStore.kt`). */
        const val THEME = "/truemain/theme"
        const val GAMEFLOW_PHASE = "/lol-gameflow/v1/gameflow-phase"
        const val GAMEFLOW_SESSION = "/lol-gameflow/v1/session"
        const val LOBBY = "/lol-lobby/v2/lobby"
        const val INVITATIONS = "/lol-lobby/v2/received-invitations"
        const val SEARCH = "/lol-matchmaking/v1/search"
        const val READY_CHECK = "/lol-matchmaking/v1/ready-check"
        const val CHAMP_SELECT = "/lol-champ-select/v1/session"
        const val CURRENT_CHAMPION = "/lol-champ-select/v1/current-champion"
        const val PICKABLE = "/lol-champ-select/v1/pickable-champion-ids"
        const val RUNE_PAGES = "/lol-perks/v1/pages"
        const val CURRENT_RUNE_PAGE = "/lol-perks/v1/currentpage"

        /** Mirrors `phone_link::allow::EVENTS` on the desktop. */
        val FOLLOWED = listOf(
            APP_STATE, GAME, THEME, GAMEFLOW_PHASE, GAMEFLOW_SESSION, LOBBY, INVITATIONS, SEARCH, READY_CHECK,
            CHAMP_SELECT, CURRENT_CHAMPION, PICKABLE, RUNE_PAGES, CURRENT_RUNE_PAGE,
        )

        val EMPTY: JsonElement = JsonNull
    }
}
