package lol.truemain.mobile.link

import kotlinx.serialization.json.JsonElement

/** Who this phone is: kept for good once made (`store/Identity.kt`). */
data class PhoneIdentity(val phoneId: String, val keys: KeyPair, val name: String, val platform: String = "android")

sealed interface Target {
    /** A QR code just scanned. */
    data class Pair(val invite: Invite) : Target

    /** A desktop paired before, by the key pinned then. */
    class Resume(val pcKey: ByteArray) : Target
}

sealed interface PhoneStep {
    data class Send(val frame: Frame) : PhoneStep
    data class Opened(val paired: Boolean, val pc: PcInfo) : PhoneStep
    data class Response(val id: Long, val status: Int, val body: JsonElement) : PhoneStep
    data class Event(val uri: String, val payload: JsonElement) : PhoneStep
}

/**
 * The phone's end of one connection, a port of `phone_link::phone::PhoneLink`:
 * fed the desktop's frames, it returns what to send and what happened. Not
 * thread-safe — `LinkClient` drives it from one coroutine.
 */
class PhoneLink private constructor(
    private val identity: PhoneIdentity,
    private var mode: Mode,
    private val pcKey: ByteArray,
    private var token: ByteArray?,
    private var ephemeral: KeyPair?,
    private val nonce: ByteArray,
) {
    private var channel: Channel? = null
    private var state = State.Welcome
    private var nextId = 1L

    private enum class State { Welcome, AwaitOpen, Open, Closed }

    val isOpen: Boolean get() = state == State.Open

    /** Feed one frame. Throws `LinkException` when the link is over. */
    fun receive(frame: Frame): List<PhoneStep> = try {
        step(frame)
    } catch (error: LinkException) {
        state = State.Closed
        throw error
    } catch (error: Exception) {
        state = State.Closed
        throw LinkException("unexpected")
    }

    private fun step(frame: Frame): List<PhoneStep> = when (state) {
        State.Welcome -> {
            val text = (frame as? Frame.Text)?.text ?: throw LinkException("unexpected")
            when (val message = decodePlain(text)) {
                is Plain.Welcome -> onWelcome(message)
                is Plain.Error -> throw LinkException(message.code)
                else -> throw LinkException("unexpected")
            }
        }
        State.AwaitOpen -> when (frame) {
            is Frame.Text -> when (val message = decodePlain(frame.text)) {
                is Plain.Error -> throw LinkException(message.code)
                else -> throw LinkException("unexpected")
            }
            is Frame.Binary -> when (val message = open(frame.bytes)) {
                is Sealed.Open -> {
                    state = State.Open
                    // Spent: a reconnect resumes with the key, never the token again.
                    token = null
                    mode = Mode.Resume
                    listOf(PhoneStep.Opened(message.paired, message.pc))
                }
                is Sealed.Error -> throw LinkException(message.code)
                else -> throw LinkException("unexpected")
            }
        }
        State.Open -> {
            val bytes = (frame as? Frame.Binary)?.bytes ?: throw LinkException("unexpected")
            when (val message = open(bytes)) {
                is Sealed.Res -> listOf(PhoneStep.Response(message.id, message.s, message.b))
                is Sealed.Evt -> listOf(PhoneStep.Event(message.u, message.p))
                is Sealed.Error -> throw LinkException(message.code)
                else -> emptyList()
            }
        }
        State.Closed -> throw LinkException("broken")
    }

    private fun onWelcome(welcome: Plain.Welcome): List<PhoneStep> {
        val ephemeral = ephemeral ?: throw LinkException("unexpected")
        val pcEphemeral = B64.decode(welcome.ek, KEY_LEN)
        val pcNonce = B64.decode(welcome.n, NONCE_LEN)
        val transcript = transcriptHash(
            mode, identity.phoneId, identity.keys.public, pcKey, ephemeral.public, pcEphemeral, nonce, pcNonce,
        )
        val channel = Channel.phone(phoneKeys(identity.keys, ephemeral, pcKey, pcEphemeral, transcript))
        this.channel = channel
        this.ephemeral = null
        val first: Sealed = token?.let { Sealed.Pair(B64.encode(it), identity.name, identity.platform) } ?: Sealed.Resume
        state = State.AwaitOpen
        return listOf(PhoneStep.Send(Frame.Binary(channel.seal(encode(first)))))
    }

    private fun open(bytes: ByteArray): Sealed {
        val plain = (channel ?: throw LinkException("unexpected")).open(bytes)
        return try {
            linkJson.decodeFromString(Sealed.serializer(), plain.decodeToString())
        } catch (_: Exception) {
            throw LinkException("bad-json")
        }
    }

    /** A request for the client: its id (echoed by the response) and the frame to send. */
    fun request(method: String, path: String, body: JsonElement?): kotlin.Pair<Long, Frame> {
        val channel = channel?.takeIf { state == State.Open } ?: throw LinkException("unexpected")
        val id = nextId++
        return id to Frame.Binary(channel.seal(encode(Sealed.Req(id, method, path, body))))
    }

    fun ping(): Frame {
        val channel = channel?.takeIf { state == State.Open } ?: throw LinkException("unexpected")
        return Frame.Binary(channel.seal(encode(Sealed.Ping)))
    }

    companion object {
        /** The link and the hello to send first. */
        fun start(identity: PhoneIdentity, target: Target): kotlin.Pair<PhoneLink, Frame> =
            startWith(identity, target, KeyPair.generate(), randomBytes(NONCE_LEN))

        /** `start` with the ephemeral key and nonce given: for the test vectors. */
        fun startWith(identity: PhoneIdentity, target: Target, ephemeral: KeyPair, nonce: ByteArray): kotlin.Pair<PhoneLink, Frame> {
            val (mode, pcKey, token) = when (target) {
                is Target.Pair -> Triple(Mode.Pair, target.invite.pcKey, target.invite.token)
                is Target.Resume -> Triple(Mode.Resume, target.pcKey, null)
            }
            val hello = Plain.Hello(
                v = VERSION,
                mode = mode,
                id = identity.phoneId,
                sk = if (mode == Mode.Pair) B64.encode(identity.keys.public) else null,
                ek = B64.encode(ephemeral.public),
                n = B64.encode(nonce),
            )
            val text = linkJson.encodeToString(Plain.serializer(), hello)
            return PhoneLink(identity, mode, pcKey, token, ephemeral, nonce) to Frame.Text(text)
        }

        fun encode(message: Sealed): ByteArray = linkJson.encodeToString(Sealed.serializer(), message).toByteArray()

        private fun decodePlain(text: String): Plain = try {
            linkJson.decodeFromString(Plain.serializer(), text)
        } catch (_: Exception) {
            throw LinkException("bad-json")
        }
    }
}
