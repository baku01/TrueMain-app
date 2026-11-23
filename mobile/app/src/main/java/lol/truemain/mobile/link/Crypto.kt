package lol.truemain.mobile.link

import java.nio.ByteBuffer
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import org.bouncycastle.crypto.digests.SHA256Digest
import org.bouncycastle.crypto.generators.HKDFBytesGenerator
import org.bouncycastle.crypto.modes.ChaCha20Poly1305
import org.bouncycastle.crypto.params.AEADParameters
import org.bouncycastle.crypto.params.HKDFParameters
import org.bouncycastle.crypto.params.KeyParameter
import org.bouncycastle.math.ec.rfc7748.X25519

/**
 * The phone's half of the link's cryptography — a port of the desktop's
 * `phone-link` crate (`desktop/crates/phone-link/src/crypto.rs`), checked byte
 * for byte against its `vectors.json`.
 */
const val KEY_LEN = 32
const val NONCE_LEN = 16
const val TOKEN_LEN = 16
const val MAX_FRAME = 1 shl 20

private val LABEL = "truemain-link/1".toByteArray()
private val KEYS_INFO = "truemain-link/1 keys".toByteArray()
private val random = SecureRandom()

/** A refusal or a broken link, with the code both sides use. */
class LinkException(val code: String) : Exception(code)

fun randomBytes(size: Int): ByteArray = ByteArray(size).also(random::nextBytes)

object B64 {
    private val encoder = Base64.getUrlEncoder().withoutPadding()
    private val decoder = Base64.getUrlDecoder()

    fun encode(bytes: ByteArray): String = encoder.encodeToString(bytes)

    fun decode(text: String, length: Int): ByteArray {
        val bytes = try {
            decoder.decode(text)
        } catch (_: IllegalArgumentException) {
            throw LinkException("bad-encoding")
        }
        if (bytes.size != length) throw LinkException("bad-encoding")
        return bytes
    }
}

/** An X25519 key pair: the phone's static identity, or a connection's ephemeral key. */
class KeyPair private constructor(private val secret: ByteArray, val public: ByteArray) {
    fun secretBytes(): ByteArray = secret.copyOf()

    /** Refuses a desktop key giving the all-zero secret: it would contribute nothing. */
    fun dh(peer: ByteArray): ByteArray {
        val shared = ByteArray(KEY_LEN)
        if (peer.size != KEY_LEN || !X25519.calculateAgreement(secret, 0, peer, 0, shared, 0)) {
            throw LinkException("bad-key")
        }
        return shared
    }

    companion object {
        fun generate(): KeyPair = fromSecret(randomBytes(KEY_LEN))

        fun fromSecret(secret: ByteArray): KeyPair {
            require(secret.size == KEY_LEN)
            val public = ByteArray(KEY_LEN)
            X25519.scalarMultBase(secret, 0, public, 0)
            return KeyPair(secret.copyOf(), public)
        }
    }
}

/** Everything the handshake said, each field length-prefixed so none can be re-split. */
fun transcriptHash(
    mode: Mode,
    phoneId: String,
    phoneStatic: ByteArray,
    pcStatic: ByteArray,
    phoneEphemeral: ByteArray,
    pcEphemeral: ByteArray,
    phoneNonce: ByteArray,
    pcNonce: ByteArray,
): ByteArray {
    val digest = MessageDigest.getInstance("SHA-256")
    fun field(bytes: ByteArray) {
        digest.update(ByteBuffer.allocate(4).putInt(bytes.size).array())
        digest.update(bytes)
    }
    field(LABEL)
    field(mode.wire.toByteArray())
    field(phoneId.toByteArray())
    field(phoneStatic)
    field(pcStatic)
    field(phoneEphemeral)
    field(pcEphemeral)
    field(phoneNonce)
    field(pcNonce)
    return digest.digest()
}

class SessionKeys(val phoneToPc: ByteArray, val pcToPhone: ByteArray)

/** `ee`, `ss`, `se` (phone static × desktop ephemeral), `es` (phone ephemeral × desktop static). */
fun phoneKeys(
    phoneStatic: KeyPair,
    phoneEphemeral: KeyPair,
    pcStatic: ByteArray,
    pcEphemeral: ByteArray,
    transcript: ByteArray,
): SessionKeys {
    val input = phoneEphemeral.dh(pcEphemeral) + phoneStatic.dh(pcStatic) +
        phoneStatic.dh(pcEphemeral) + phoneEphemeral.dh(pcStatic)
    val okm = ByteArray(KEY_LEN * 2)
    HKDFBytesGenerator(SHA256Digest()).apply {
        init(HKDFParameters(input, transcript, KEYS_INFO))
        generateBytes(okm, 0, okm.size)
    }
    return SessionKeys(okm.copyOfRange(0, 32), okm.copyOfRange(32, 64))
}

/**
 * Both directions of an open link, one key and one counter each. Any frame
 * that does not open — tampered, replayed, out of order — breaks it for good.
 */
class Channel(private val sendKey: ByteArray, private val receiveKey: ByteArray) {
    private var sent = 0L
    private var received = 0L
    private var broken = false

    private fun nonce(counter: Long): ByteArray =
        ByteArray(12).also { ByteBuffer.wrap(it, 4, 8).putLong(counter) }

    private fun cipher(encrypt: Boolean, key: ByteArray, counter: Long) =
        ChaCha20Poly1305().apply { init(encrypt, AEADParameters(KeyParameter(key), 128, nonce(counter))) }

    fun seal(plain: ByteArray): ByteArray {
        if (broken) throw LinkException("broken")
        val aead = cipher(true, sendKey, sent)
        val out = ByteArray(aead.getOutputSize(plain.size))
        val written = aead.processBytes(plain, 0, plain.size, out, 0)
        aead.doFinal(out, written)
        sent += 1
        return out
    }

    fun open(frame: ByteArray): ByteArray {
        if (broken) throw LinkException("broken")
        if (frame.size > MAX_FRAME) {
            broken = true
            throw LinkException("too-large")
        }
        return try {
            val aead = cipher(false, receiveKey, received)
            val out = ByteArray(aead.getOutputSize(frame.size))
            val written = aead.processBytes(frame, 0, frame.size, out, 0)
            aead.doFinal(out, written)
            received += 1
            out
        } catch (_: Exception) {
            broken = true
            throw LinkException("bad-frame")
        }
    }

    companion object {
        fun phone(keys: SessionKeys) = Channel(keys.phoneToPc, keys.pcToPhone)
        fun pc(keys: SessionKeys) = Channel(keys.pcToPhone, keys.phoneToPc)
    }
}
