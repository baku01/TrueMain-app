package lol.truemain.mobile.ui.draft

import android.content.Context
import androidx.annotation.StringRes
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import lol.truemain.mobile.R
import lol.truemain.mobile.graph
import lol.truemain.mobile.session.Session

/**
 * Every write the Draft tab sends, through one door: one request at a time
 * (each button reads [busy] and disables itself, so a double tap can't lock
 * twice or hover over a lock), and a refusal always surfaces as a message
 * instead of a button that silently did nothing.
 */
@Stable
class DraftActions(
    val session: Session,
    private val scope: CoroutineScope,
    private val context: Context,
    val snackbar: SnackbarHostState,
) {
    var busy by mutableStateOf(false)
        private set

    internal var sheetSnackbar: SnackbarHostState? = null

    fun say(@StringRes text: Int) {
        val target = sheetSnackbar ?: snackbar
        scope.launch { target.showSnackbar(context.getString(text)) }
    }

    /** Runs a suspending job with the busy flag held; anything it throws reads as a failure. */
    fun run(block: suspend () -> Unit) {
        if (busy) return
        busy = true
        scope.launch {
            try {
                block()
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
                say(R.string.draft_error_request)
            } finally {
                busy = false
            }
        }
    }

    /** One client write; [failure] is said if the client refuses it or the link is down. */
    fun send(method: String, path: String, body: JsonElement? = null, @StringRes failure: Int = R.string.draft_error_request, onOk: () -> Unit = {}) = run {
        if (session.act(method, path, body)) onOk() else say(failure)
    }

    fun hover(action: Action, championId: Int) =
        send("PATCH", "/lol-champ-select/v1/session/actions/${action.id}", buildJsonObject { put("championId", JsonPrimitive(championId)) })

    fun complete(action: Action) =
        send("POST", "/lol-champ-select/v1/session/actions/${action.id}/complete", failure = R.string.draft_error_lock)

    fun selection(body: JsonElement) = send("PATCH", "/lol-champ-select/v1/session/my-selection", body)

    fun spells(spell1: Int, spell2: Int) = selection(
        buildJsonObject {
            put("spell1Id", JsonPrimitive(spell1))
            put("spell2Id", JsonPrimitive(spell2))
        },
    )

    fun skin(skinId: Int) = selection(buildJsonObject { put("selectedSkinId", JsonPrimitive(skinId)) })

    fun swap(swap: Swap, verb: String) = send("POST", "/lol-champ-select/v1/session/${swap.kind.path}/${swap.id}/$verb")
}

@Composable
fun rememberDraftActions(snackbar: SnackbarHostState): DraftActions {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    return remember(snackbar) { DraftActions(context.graph.session, scope, context.applicationContext, snackbar) }
}

/** Routes draft error/feedback snackbars to a ModalBottomSheet's own SnackbarHost while it is open. */
@Composable
fun rememberSheetSnackbar(actions: DraftActions): SnackbarHostState {
    val host = remember { SnackbarHostState() }
    DisposableEffect(actions, host) {
        actions.sheetSnackbar = host
        onDispose { if (actions.sheetSnackbar === host) actions.sheetSnackbar = null }
    }
    return host
}
