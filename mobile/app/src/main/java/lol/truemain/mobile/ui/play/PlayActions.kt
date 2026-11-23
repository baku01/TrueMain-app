package lol.truemain.mobile.ui.play

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonElement
import lol.truemain.mobile.lcu.str
import lol.truemain.mobile.link.LinkResponse
import lol.truemain.mobile.session.Session

/** Why a write did not land: the client's own words when it gave some. */
data class PlayFailure(val reason: String?)

/**
 * The Play tab's writes to the client, one at a time. Every button reads
 * [busy] and disables itself while a write is in flight, so a double tap on a
 * slow link does not create two lobbies or cancel a queue just restarted. The
 * result needs no handling: the lobby and the search come back as events.
 */
@Stable
class PlayActions(private val session: Session, private val scope: CoroutineScope) {
    /** The key of the write in flight, null when idle. */
    var busy by mutableStateOf<String?>(null)
        private set

    var failure by mutableStateOf<PlayFailure?>(null)
        private set

    val idle: Boolean get() = busy == null

    fun dismiss() {
        failure = null
    }

    /** Sends one write unless another is in flight; [onDone] hears whether it landed. */
    fun run(key: String, method: String, path: String, body: JsonElement? = null, onDone: (Boolean) -> Unit = {}) {
        if (busy != null) return
        busy = key
        failure = null
        scope.launch {
            val response = runCatching { send(method, path, body) }.getOrNull()
            val ok = response?.ok == true
            // The LCU answers a refusal with `{ errorCode, httpStatus, message }`.
            if (!ok) failure = PlayFailure(response?.body.str("message")?.takeIf { it.isNotBlank() })
            busy = null
            onDone(ok)
        }
    }

    private suspend fun send(method: String, path: String, body: JsonElement?): LinkResponse = when (method) {
        "POST" -> session.post(path, body)
        "PUT" -> session.put(path, body)
        "PATCH" -> session.patch(path, body)
        "DELETE" -> session.delete(path)
        else -> session.get(path)
    }
}

/** `95` → `1:35`, the client's way of writing a queue time. */
fun clock(seconds: Long): Pair<Long, Long> = seconds.coerceAtLeast(0).let { it / 60 to it % 60 }
