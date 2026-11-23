package lol.truemain.mobile.link

import androidx.annotation.VisibleForTesting
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.channels.Channel as Queue
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.JsonElement
import lol.truemain.mobile.store.PairedDesktop
import lol.truemain.mobile.store.PairingStore
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString
import okio.ByteString.Companion.toByteString

/** Where the link to the desktop stands. */
sealed interface LinkState {
    /** No desktop paired yet. */
    data object NotPaired : LinkState

    data class Connecting(val address: String?) : LinkState

    /** Asking every address of the network where the desktop went. */
    data object Searching : LinkState

    data class Open(val pc: PcInfo, val address: String) : LinkState

    /** Not reachable now; retried on its own. `code` says why when the desktop said. */
    data class Offline(val code: String?) : LinkState

    /** The desktop no longer knows this phone (forgotten, its key changed): pair again. */
    data class Revoked(val code: String) : LinkState
}

data class LinkEvent(val uri: String, val payload: JsonElement)

data class LinkResponse(val status: Int, val body: JsonElement) {
    val ok: Boolean get() = status in 200..299
}

/** The request could not be carried: no link, or no answer in time. */
class LinkUnavailable(message: String) : Exception(message)

/**
 * The phone's connection to its desktop: pairs from a QR code, then keeps a
 * link open for as long as the app runs — reconnecting with a growing pause,
 * looking for the desktop on the network when its address stops answering.
 *
 * Every touch of the `PhoneLink` goes through one queue, in order: the
 * channel's counter nonces make any reordering fatal.
 */
class LinkClient(
    private val store: PairingStore,
    private val discovery: Discovery,
    private val http: OkHttpClient,
    private val scope: CoroutineScope,
) {
    private val _state = MutableStateFlow<LinkState>(if (store.desktop() == null) LinkState.NotPaired else LinkState.Connecting(null))
    val state: StateFlow<LinkState> = _state.asStateFlow()

    /** True once a desktop has completed pairing (or was faked in screenshot tests). */
    private val _paired = MutableStateFlow(store.desktop() != null)
    val paired: StateFlow<Boolean> = _paired.asStateFlow()

    private val _events = MutableSharedFlow<LinkEvent>(extraBufferCapacity = 256)
    val events: SharedFlow<LinkEvent> = _events

    private val queue = Queue<suspend () -> Unit>(Queue.UNLIMITED)
    private val socketClient = http.newBuilder()
        .connectTimeout(3, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.SECONDS)
        .build()

    private var session: Session? = null
    private var loop: Job? = null

    init {
        scope.launch { for (work in queue) work() }
    }

    /** Keep the paired desktop's link open from now on. */
    fun start() {
        if (loop?.isActive == true || store.desktop() == null) return
        loop = scope.launch { keepConnected() }
    }

    /** Connect again at once (the player tapped retry, or came back to the app). */
    fun retry() {
        if (_state.value is LinkState.Open) return
        loop?.cancel()
        loop = null
        start()
    }

    /** Pair with the desktop whose QR code was scanned; the result shows in `state`. */
    fun pair(invite: Invite) {
        loop?.cancel()
        session?.close()
        loop = scope.launch {
            val addresses = invite.addresses.ifEmpty { discovery.scan().map { it.address } }
            for (address in addresses) {
                _state.value = LinkState.Connecting(address)
                val outcome = attempt(address, Target.Pair(invite))
                if (outcome is Outcome.Opened) {
                    store.saveDesktop(
                        PairedDesktop(B64.encode(invite.pcKey), outcome.pc.name.ifEmpty { invite.name }, (listOf(address) + outcome.pc.addresses).distinct()),
                    )
                    _paired.value = true
                    awaitClose(outcome)
                    keepConnected()
                    return@launch
                }
                if (outcome is Outcome.Refused) {
                    _state.value = LinkState.Offline(outcome.code)
                    return@launch
                }
            }
            _state.value = LinkState.Offline("unreachable")
        }
    }

    /** Unpair: this phone forgets the desktop (the desktop keeps its record until it forgets the phone too). */
    fun forget() {
        loop?.cancel()
        loop = null
        session?.close()
        store.forgetDesktop()
        _paired.value = false
        _state.value = LinkState.NotPaired
    }

    /** Answers every request in place of the desktop when set (screenshot tests); null in the app. */
    @VisibleForTesting
    internal var fake: (suspend (method: String, path: String, body: JsonElement?) -> LinkResponse)? = null

    /** Shows [state] as if the link had reached it (screenshot tests). */
    @VisibleForTesting
    internal fun showState(state: LinkState) {
        _paired.value = state !is LinkState.NotPaired && state !is LinkState.Revoked
        _state.value = state
    }

    suspend fun request(method: String, path: String, body: JsonElement? = null, timeoutMillis: Long = 10_000): LinkResponse {
        fake?.let { return it(method, path, body) }
        val current = session?.takeIf { it.isOpen } ?: throw LinkUnavailable("not connected")
        return current.request(method, path, body, timeoutMillis)
    }

    private sealed interface Outcome {
        data class Opened(val session: Session, val pc: PcInfo) : Outcome
        data class Refused(val code: String) : Outcome
        data object Unreachable : Outcome
    }

    private suspend fun keepConnected() {
        var pause = 1_000L
        while (scope.isActive) {
            val desktop = store.desktop() ?: run { _state.value = LinkState.NotPaired; return }
            val target = Target.Resume(B64.decode(desktop.pcKey, KEY_LEN))
            var outcome: Outcome = Outcome.Unreachable
            for (address in desktop.addresses) {
                _state.value = LinkState.Connecting(address)
                outcome = attempt(address, target)
                if (outcome !is Outcome.Unreachable) break
            }
            if (outcome is Outcome.Unreachable) {
                _state.value = LinkState.Searching
                for (found in discovery.scan()) {
                    outcome = attempt(found.address, target)
                    if (outcome !is Outcome.Unreachable) break
                }
            }
            when (outcome) {
                is Outcome.Opened -> {
                    pause = 1_000L
                    val code = awaitClose(outcome)
                    if (code in REVOKED) {
                        _state.value = LinkState.Revoked(code)
                        return
                    }
                    _state.value = LinkState.Offline(code)
                }
                is Outcome.Refused -> {
                    // A resume the desktop cannot open: it holds another key now (reset).
                    if (outcome.code in REVOKED || outcome.code == "bad-frame") {
                        _state.value = LinkState.Revoked(outcome.code)
                        return
                    }
                    _state.value = LinkState.Offline(outcome.code)
                }
                Outcome.Unreachable -> _state.value = LinkState.Offline(null)
            }
            delay(pause)
            pause = (pause * 2).coerceAtMost(15_000L)
        }
    }

    private suspend fun awaitClose(opened: Outcome.Opened): String {
        val code = opened.session.closed.await()
        if (session === opened.session) session = null
        return code
    }

    private suspend fun attempt(address: String, target: Target): Outcome {
        val attemptSession = Session(address, target)
        session = attemptSession
        return try {
            val pc = withTimeout(HANDSHAKE_TIMEOUT) { attemptSession.opened.await() }
            store.rememberAddress(address)
            _state.value = LinkState.Open(pc, address)
            Outcome.Opened(attemptSession, pc)
        } catch (error: LinkException) {
            attemptSession.close()
            if (error.code in TRANSPORT) Outcome.Unreachable else Outcome.Refused(error.code)
        } catch (_: TimeoutCancellationException) {
            attemptSession.close()
            Outcome.Unreachable
        }
    }

    private inner class Session(val address: String, target: Target) : WebSocketListener() {
        private val link: PhoneLink
        private val hello: Frame
        private val socket: WebSocket
        private val pending = HashMap<Long, CompletableDeferred<LinkResponse>>()
        private var pinger: Job? = null
        val opened = CompletableDeferred<PcInfo>()
        val closed = CompletableDeferred<String>()
        @Volatile var isOpen = false
            private set

        init {
            val started = PhoneLink.start(store.identity(), target)
            link = started.first
            hello = started.second
            socket = socketClient.newWebSocket(Request.Builder().url("ws://$address$PATH").build(), this)
        }

        override fun onOpen(webSocket: WebSocket, response: Response) {
            queue.trySend { send(hello) }
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            queue.trySend { receive(Frame.Text(text)) }
        }

        override fun onMessage(webSocket: WebSocket, bytes: ByteString) {
            queue.trySend { receive(Frame.Binary(bytes.toByteArray())) }
        }

        override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
            webSocket.close(1000, null)
            queue.trySend { finish(reason.ifEmpty { "closed" }) }
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            queue.trySend { finish(reason.ifEmpty { "closed" }) }
        }

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            queue.trySend { finish("unreachable") }
        }

        private fun send(frame: Frame) {
            when (frame) {
                is Frame.Text -> socket.send(frame.text)
                is Frame.Binary -> socket.send(frame.bytes.toByteString())
            }
        }

        private suspend fun receive(frame: Frame) {
            if (closed.isCompleted) return
            val steps = try {
                link.receive(frame)
            } catch (error: LinkException) {
                finish(error.code)
                return
            }
            for (step in steps) {
                when (step) {
                    is PhoneStep.Send -> send(step.frame)
                    is PhoneStep.Opened -> {
                        isOpen = true
                        opened.complete(step.pc)
                        pinger = scope.launch {
                            while (isActive && isOpen) {
                                delay(PING_EVERY)
                                queue.trySend { if (isOpen) runCatching { send(link.ping()) } }
                            }
                        }
                    }
                    is PhoneStep.Response -> pending.remove(step.id)?.complete(LinkResponse(step.status, step.body))
                    is PhoneStep.Event -> _events.emit(LinkEvent(step.uri, step.payload))
                }
            }
        }

        suspend fun request(method: String, path: String, body: JsonElement?, timeoutMillis: Long): LinkResponse {
            val answer = CompletableDeferred<LinkResponse>()
            var id = -1L
            queue.send {
                if (!isOpen) {
                    answer.completeExceptionally(LinkUnavailable("not connected"))
                } else {
                    val (requestId, frame) = link.request(method, path, body)
                    id = requestId
                    pending[requestId] = answer
                    send(frame)
                }
            }
            return try {
                withTimeout(timeoutMillis) { answer.await() }
            } catch (_: TimeoutCancellationException) {
                queue.trySend { pending.remove(id) }
                throw LinkUnavailable("no answer from the desktop")
            }
        }

        private fun finish(code: String) {
            if (closed.isCompleted) return
            isOpen = false
            pinger?.cancel()
            opened.completeExceptionally(LinkException(code))
            for (answer in pending.values) answer.completeExceptionally(LinkUnavailable(code))
            pending.clear()
            socket.cancel()
            closed.complete(code)
        }

        fun close() {
            queue.trySend { finish("closed") }
        }
    }

    private companion object {
        const val HANDSHAKE_TIMEOUT = 8_000L
        const val PING_EVERY = 20_000L

        /** The desktop dropped this phone for good: retrying cannot help. */
        val REVOKED = setOf("unknown-phone", "forgotten")

        /** Not a refusal by the desktop: the address did not answer as one. */
        val TRANSPORT = setOf("unreachable", "closed")
    }
}
