package lol.truemain.mobile.link

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull

/** The link's messages, as `desktop/crates/phone-link/src/message.rs` defines them. */
const val VERSION = 1
const val PORT = 42719
const val PATH = "/link/v1"
const val DISCOVERY_PATH = "/truemain-link"

val linkJson = Json {
    classDiscriminator = "t"
    ignoreUnknownKeys = true
    explicitNulls = false
    encodeDefaults = false
}

sealed interface Frame {
    data class Text(val text: String) : Frame
    class Binary(val bytes: ByteArray) : Frame
}

@Serializable
enum class Mode(val wire: String) {
    @SerialName("pair") Pair("pair"),
    @SerialName("resume") Resume("resume"),
}

/** The handshake, plaintext JSON in text frames. */
@Serializable
sealed class Plain {
    @Serializable
    @SerialName("hello")
    data class Hello(
        val v: Int,
        val mode: Mode,
        val id: String,
        val sk: String? = null,
        val ek: String,
        val n: String,
    ) : Plain()

    @Serializable
    @SerialName("welcome")
    data class Welcome(val ek: String, val n: String) : Plain()

    @Serializable
    @SerialName("error")
    data class Error(val code: String) : Plain()
}

@Serializable
data class PcInfo(
    val name: String = "",
    val addresses: List<String> = emptyList(),
    val version: String = "",
)

/** Everything after the handshake, sealed into binary frames. */
@Serializable
sealed class Sealed {
    @Serializable
    @SerialName("pair")
    data class Pair(val token: String, val name: String, val platform: String) : Sealed()

    @Serializable
    @SerialName("resume")
    data object Resume : Sealed()

    @Serializable
    @SerialName("open")
    data class Open(val paired: Boolean, val pc: PcInfo) : Sealed()

    @Serializable
    @SerialName("req")
    data class Req(val id: Long, val m: String, val p: String, val b: JsonElement? = null) : Sealed()

    @Serializable
    @SerialName("res")
    data class Res(val id: Long, val s: Int, val b: JsonElement = JsonNull) : Sealed()

    @Serializable
    @SerialName("evt")
    data class Evt(val u: String, val p: JsonElement = JsonNull) : Sealed()

    @Serializable
    @SerialName("ping")
    data object Ping : Sealed()

    @Serializable
    @SerialName("pong")
    data object Pong : Sealed()

    @Serializable
    @SerialName("error")
    data class Error(val code: String) : Sealed()
}
