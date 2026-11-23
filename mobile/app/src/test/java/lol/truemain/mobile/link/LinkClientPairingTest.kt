package lol.truemain.mobile.link

import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.io.OutputStream
import java.net.InetAddress
import java.net.ServerSocket
import java.security.MessageDigest
import java.util.Base64
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import lol.truemain.mobile.store.PairedDesktop
import lol.truemain.mobile.store.PairingStore
import okhttp3.OkHttpClient
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/**
 * End-to-end tests of `LinkClient.pair()` over a real local WebSocket, including
 * the `MainActivity.onResume()` -> `retry()` race right after scanning a QR code.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class LinkClientPairingTest {

    @Test
    fun pairingSurvivesOnResumeRetryAndCompletesHandshake() = runBlocking {
        val pcKeys = KeyPair.generate()
        val token = randomBytes(TOKEN_LEN)
        val server = FakeDesktopServer(pcKeys, token, "TEST-PC")
        server.start()
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        try {
            val context = RuntimeEnvironment.getApplication()
            val store = InMemoryPairingStore(context)
            val http = OkHttpClient()
            val client = LinkClient(store, Discovery(context, http), http, scope)
            val invite = Invite(
                pcKey = pcKeys.public,
                token = token,
                addresses = listOf("127.0.0.1:${server.port}"),
                name = "TEST-PC",
            )

            client.pair(invite)
            // Simulate MainActivity.onResume() firing right as the QR scanner closes.
            delay(5)
            client.retry()

            val open = withTimeout(5_000) { client.state.first { it is LinkState.Open } } as LinkState.Open
            assertEquals("TEST-PC", open.pc.name)
            assertTrue("client should be marked paired", client.paired.value)
            assertEquals("TEST-PC", store.desktop()?.name)
        } finally {
            scope.cancel()
            server.close()
        }
    }

    @Test
    fun pairingToUnreachableAddressTransitionsToOfflineInsteadOfHanging() = runBlocking {
        val closedPort = ServerSocket(0).use { it.localPort }
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        try {
            val context = RuntimeEnvironment.getApplication()
            val store = InMemoryPairingStore(context)
            val http = OkHttpClient()
            val client = LinkClient(store, Discovery(context, http), http, scope)
            val invite = Invite(
                pcKey = KeyPair.generate().public,
                token = randomBytes(TOKEN_LEN),
                addresses = listOf("127.0.0.1:$closedPort"),
                name = "DEAD-PC",
            )

            client.pair(invite)
            client.retry()

            val offline = withTimeout(10_000) { client.state.first { it is LinkState.Offline } } as LinkState.Offline
            assertEquals("unreachable", offline.code)
            assertFalse("unpaired client must stay on ConnectScreen", client.paired.value)
        } finally {
            scope.cancel()
        }
    }

    /** Minimal PairingStore without AndroidKeyStore (not present on Robolectric). */
    private class InMemoryPairingStore(context: android.content.Context) : PairingStore(context) {
        private val id = PhoneIdentity(B64.encode(randomBytes(16)), KeyPair.generate(), "TestPhone")
        private var saved: PairedDesktop? = null
        override fun identity(): PhoneIdentity = id
        override fun desktop(): PairedDesktop? = saved
        override fun saveDesktop(desktop: PairedDesktop) { saved = desktop }
        override fun forgetDesktop() { saved = null }
    }

    /** Minimal RFC 6455 WebSocket server implementing the desktop side of the pairing handshake. */
    private class FakeDesktopServer(
        private val pcKeys: KeyPair,
        private val expectedToken: ByteArray,
        private val pcName: String,
    ) : AutoCloseable {
        private val socket = ServerSocket(0, 5, InetAddress.getByName("127.0.0.1"))
        val port: Int get() = socket.localPort
        private var worker: Thread? = null

        fun start() {
            worker = Thread {
                runCatching {
                    val conn = socket.accept()
                    conn.use { s ->
                        val input = s.getInputStream()
                        val output = s.getOutputStream()
                        val headers = readHttpHeaders(input)
                        val key = headers.lines()
                            .first { it.startsWith("Sec-WebSocket-Key:", ignoreCase = true) }
                            .substringAfter(":").trim()
                        val accept = Base64.getEncoder().encodeToString(
                            MessageDigest.getInstance("SHA-1")
                                .digest((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").toByteArray()),
                        )
                        output.write(
                            ("HTTP/1.1 101 Switching Protocols\r\n" +
                                "Upgrade: websocket\r\n" +
                                "Connection: Upgrade\r\n" +
                                "Sec-WebSocket-Accept: $accept\r\n\r\n").toByteArray(),
                        )
                        output.flush()

                        // 1. Read Hello (text frame)
                        val (_, helloBytes) = readWsFrame(input)
                        val hello = linkJson.decodeFromString(Plain.serializer(), helloBytes.decodeToString()) as Plain.Hello
                        val phoneStatic = B64.decode(hello.sk!!, KEY_LEN)
                        val phoneEphemeral = B64.decode(hello.ek, KEY_LEN)
                        val phoneNonce = B64.decode(hello.n, NONCE_LEN)

                        // 2. Send Welcome (text frame)
                        val pcEphemeral = KeyPair.generate()
                        val pcNonce = randomBytes(NONCE_LEN)
                        val welcome = Plain.Welcome(B64.encode(pcEphemeral.public), B64.encode(pcNonce))
                        writeWsFrame(output, 0x1, linkJson.encodeToString(Plain.serializer(), welcome).toByteArray())

                        // 3. Derive desktop channel keys (same 4-DH + HKDF as phoneKeys, with Channel.pc)
                        val transcript = transcriptHash(
                            hello.mode, hello.id, phoneStatic, pcKeys.public,
                            phoneEphemeral, pcEphemeral.public, phoneNonce, pcNonce,
                        )
                        val ikm = pcEphemeral.dh(phoneEphemeral) + pcKeys.dh(phoneStatic) +
                            pcEphemeral.dh(phoneStatic) + pcKeys.dh(phoneEphemeral)
                        val okm = ByteArray(KEY_LEN * 2)
                        org.bouncycastle.crypto.generators.HKDFBytesGenerator(
                            org.bouncycastle.crypto.digests.SHA256Digest(),
                        ).apply {
                            init(org.bouncycastle.crypto.params.HKDFParameters(ikm, transcript, "truemain-link/1 keys".toByteArray()))
                            generateBytes(okm, 0, okm.size)
                        }
                        val desktopChannel = Channel.pc(SessionKeys(okm.copyOfRange(0, 32), okm.copyOfRange(32, 64)))

                        // 4. Read sealed Pair frame and verify token
                        val (_, sealedPairBytes) = readWsFrame(input)
                        val pairMsg = linkJson.decodeFromString(
                            Sealed.serializer(),
                            desktopChannel.open(sealedPairBytes).decodeToString(),
                        ) as Sealed.Pair
                        check(B64.decode(pairMsg.token, TOKEN_LEN).contentEquals(expectedToken))

                        // 5. Send sealed Open frame
                        val openMsg = Sealed.Open(
                            paired = true,
                            pc = PcInfo(name = pcName, addresses = listOf("127.0.0.1:$port"), version = "0.5.183"),
                        )
                        val openBytes = desktopChannel.seal(linkJson.encodeToString(Sealed.serializer(), openMsg).toByteArray())
                        writeWsFrame(output, 0x2, openBytes)

                        // Keep open briefly so the client observes LinkState.Open
                        Thread.sleep(1_000)
                    }
                }
            }.apply { isDaemon = true; start() }
        }

        override fun close() {
            runCatching { socket.close() }
        }

        private fun readHttpHeaders(input: InputStream): String {
            val out = ByteArrayOutputStream()
            var state = 0
            while (true) {
                val b = input.read()
                if (b < 0) break
                out.write(b)
                state = when {
                    state == 0 && b == '\r'.code -> 1
                    state == 1 && b == '\n'.code -> 2
                    state == 2 && b == '\r'.code -> 3
                    state == 3 && b == '\n'.code -> break
                    else -> 0
                }
            }
            return out.toString("UTF-8")
        }

        private fun readWsFrame(input: InputStream): Pair<Int, ByteArray> {
            val b0 = input.read()
            val b1 = input.read()
            val opcode = b0 and 0x0F
            val masked = (b1 and 0x80) != 0
            var len = (b1 and 0x7F).toLong()
            if (len == 126L) len = ((input.read() shl 8) or input.read()).toLong()
            else if (len == 127L) {
                len = 0
                repeat(8) { len = (len shl 8) or input.read().toLong() }
            }
            val mask = if (masked) ByteArray(4).also { input.readNBytes(it, 0, 4) } else null
            val payload = ByteArray(len.toInt()).also { input.readNBytes(it, 0, it.size) }
            if (mask != null) for (i in payload.indices) payload[i] = (payload[i].toInt() xor mask[i % 4].toInt()).toByte()
            return opcode to payload
        }

        private fun writeWsFrame(output: OutputStream, opcode: Int, payload: ByteArray) {
            output.write(0x80 or opcode)
            when {
                payload.size < 126 -> output.write(payload.size)
                payload.size < 65536 -> {
                    output.write(126)
                    output.write((payload.size ushr 8) and 0xFF)
                    output.write(payload.size and 0xFF)
                }
                else -> error("frame too large")
            }
            output.write(payload)
            output.flush()
        }
    }
}
