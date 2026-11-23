package lol.truemain.mobile.link

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

/**
 * The desktop's `vectors.json` (copied here; `phone-link`'s own test fails
 * while the copies differ): the same secrets must give the same keys, the
 * same transcript, the same sealed bytes and the same hello.
 */
class VectorsTest {
    private val vectors: JsonObject = Json.parseToJsonElement(
        javaClass.classLoader!!.getResource("link-vectors.json")!!.readText(),
    ) as JsonObject

    private fun text(name: String) = vectors[name]!!.jsonPrimitive.content
    private fun hex(name: String): ByteArray = text(name).chunked(2).map { it.toInt(16).toByte() }.toByteArray()
    private fun ByteArray.hex() = joinToString("") { "%02x".format(it) }

    private val phoneStatic = KeyPair.fromSecret(hex("phoneStaticSecret"))
    private val pcStatic = KeyPair.fromSecret(hex("pcStaticSecret"))
    private val phoneEphemeral = KeyPair.fromSecret(hex("phoneEphemeralSecret"))
    private val pcEphemeral = KeyPair.fromSecret(hex("pcEphemeralSecret"))

    private fun keys(): SessionKeys {
        val transcript = transcriptHash(
            Mode.Pair, text("phoneId"), phoneStatic.public, pcStatic.public,
            phoneEphemeral.public, pcEphemeral.public, hex("phoneNonce"), hex("pcNonce"),
        )
        assertEquals(text("transcript"), transcript.hex())
        return phoneKeys(phoneStatic, phoneEphemeral, pcStatic.public, pcEphemeral.public, transcript)
    }

    @Test
    fun publicKeysMatch() {
        assertEquals(text("phoneStaticPublic"), phoneStatic.public.hex())
        assertEquals(text("pcStaticPublic"), pcStatic.public.hex())
        assertEquals(text("phoneEphemeralPublic"), phoneEphemeral.public.hex())
        assertEquals(text("pcEphemeralPublic"), pcEphemeral.public.hex())
    }

    @Test
    fun sessionKeysMatch() {
        val keys = keys()
        assertEquals(text("phoneToPc"), keys.phoneToPc.hex())
        assertEquals(text("pcToPhone"), keys.pcToPhone.hex())
    }

    @Test
    fun sealedFramesMatch() {
        val keys = keys()
        val phone = Channel.phone(keys)
        assertEquals(text("pingSealed0"), phone.seal(text("pingPlain").toByteArray()).hex())
        assertEquals(text("pingSealed1"), phone.seal(text("pingPlain").toByteArray()).hex())
        assertEquals(text("pongPlain"), phone.open(hex("pongSealed0")).decodeToString())
    }

    @Test
    fun aReplayedFrameBreaksTheChannel() {
        val keys = keys()
        val pc = Channel.pc(keys)
        val phone = Channel.phone(keys)
        val frame = pc.seal("{}".toByteArray())
        phone.open(frame)
        try {
            phone.open(frame)
            fail("a replay opened")
        } catch (error: LinkException) {
            assertEquals("bad-frame", error.code)
        }
    }

    @Test
    fun inviteMatches() {
        val invite = Invite.parse(text("invite"))!!
        assertArrayEquals(pcStatic.public, invite.pcKey)
        assertArrayEquals(hex("token"), invite.token)
        assertEquals(listOf("192.168.0.12:42719"), invite.addresses)
        assertEquals("Desk PC", invite.name)
        assertEquals(text("invite"), invite.encode())
        assertNull(Invite.parse(text("invite").replace("v=1", "v=2")))
        assertNull(Invite.parse("192.168.0.12:42719"))
    }

    @Test
    fun helloMatches() {
        val identity = PhoneIdentity(text("phoneId"), phoneStatic, "Pixel")
        val (_, hello) = PhoneLink.startWith(identity, Target.Pair(Invite.parse(text("invite"))!!), phoneEphemeral, hex("phoneNonce"))
        assertEquals(text("hello"), (hello as Frame.Text).text)
    }

    @Test
    fun pairsThroughAWelcomeAndOpens() {
        val identity = PhoneIdentity(text("phoneId"), phoneStatic, "Pixel")
        val invite = Invite.parse(text("invite"))!!
        val (link, _) = PhoneLink.startWith(identity, Target.Pair(invite), phoneEphemeral, hex("phoneNonce"))
        val welcome = """{"t":"welcome","ek":"${B64.encode(pcEphemeral.public)}","n":"${B64.encode(hex("pcNonce"))}"}"""
        val steps = link.receive(Frame.Text(welcome))
        val first = ((steps.single() as PhoneStep.Send).frame as Frame.Binary).bytes

        // The desktop's end of the same keys reads the token the QR code carried.
        val pc = Channel.pc(keys())
        val pair = linkJson.decodeFromString(Sealed.serializer(), pc.open(first).decodeToString()) as Sealed.Pair
        assertEquals(B64.encode(hex("token")), pair.token)
        assertEquals("android", pair.platform)

        val open = pc.seal(PhoneLink.encode(Sealed.Open(true, PcInfo("Desk", listOf("192.168.0.12:42719"), "0.5.0"))))
        val opened = link.receive(Frame.Binary(open)).single() as PhoneStep.Opened
        assertTrue(opened.paired && link.isOpen)
        assertEquals("Desk", opened.pc.name)

        val (id, request) = link.request("GET", "/lol-gameflow/v1/session", null)
        val req = linkJson.decodeFromString(Sealed.serializer(), pc.open((request as Frame.Binary).bytes).decodeToString())
        assertEquals(Sealed.Req(id, "GET", "/lol-gameflow/v1/session"), req)
    }

    @Test
    fun aRefusalEndsTheLink() {
        val identity = PhoneIdentity(text("phoneId"), phoneStatic, "Pixel")
        val (link, _) = PhoneLink.start(identity, Target.Resume(pcStatic.public))
        try {
            link.receive(Frame.Text("""{"t":"error","code":"unknown-phone"}"""))
            fail("a refusal was accepted")
        } catch (error: LinkException) {
            assertEquals("unknown-phone", error.code)
        }
    }
}
