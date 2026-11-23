package lol.truemain.mobile.link

import java.net.URLDecoder
import java.net.URLEncoder

/**
 * The pairing QR code: `truemain://link?v=1&k=<desktop key>&t=<token>&a=<ip:port,…>&n=<name>`
 * (`desktop/crates/phone-link/src/invite.rs`).
 */
data class Invite(
    val pcKey: ByteArray,
    val token: ByteArray,
    val addresses: List<String>,
    val name: String,
) {
    fun encode(): String = buildString {
        append(PREFIX).append("v=").append(VERSION)
        append("&k=").append(B64.encode(pcKey))
        append("&t=").append(B64.encode(token))
        val valid = addresses.filter(::isAddress).take(MAX_ADDRESSES)
        if (valid.isNotEmpty()) append("&a=").append(valid.joinToString(","))
        val cleaned = cleanName(name)
        if (cleaned.isNotEmpty()) append("&n=").append(URLEncoder.encode(cleaned, "UTF-8").replace("+", "%20"))
    }

    override fun equals(other: Any?): Boolean = other is Invite && pcKey.contentEquals(other.pcKey) &&
        token.contentEquals(other.token) && addresses == other.addresses && name == other.name

    override fun hashCode(): Int = pcKey.contentHashCode()

    companion object {
        const val PREFIX = "truemain://link?"
        const val MAX_ADDRESSES = 4
        const val MAX_NAME_LEN = 40

        /** Null for anything that is not a version-1 invite. */
        fun parse(text: String): Invite? {
            val query = text.trim().removePrefix(PREFIX).takeIf { it != text.trim() } ?: return null
            var version: Int? = null
            var key: ByteArray? = null
            var token: ByteArray? = null
            var addresses = emptyList<String>()
            var name = ""
            for (part in query.split('&')) {
                val (field, value) = part.split('=', limit = 2).takeIf { it.size == 2 } ?: return null
                when (field) {
                    "v" -> version = value.toIntOrNull()
                    "k" -> key = runCatching { B64.decode(value, KEY_LEN) }.getOrNull()
                    "t" -> token = runCatching { B64.decode(value, TOKEN_LEN) }.getOrNull()
                    "a" -> addresses = value.split(',').filter(::isAddress).take(MAX_ADDRESSES)
                    "n" -> name = runCatching { cleanName(URLDecoder.decode(value.replace("+", "%2B"), "UTF-8")) }.getOrDefault("")
                }
            }
            if (version != VERSION) return null
            return Invite(key ?: return null, token ?: return null, addresses, name)
        }

        /** `a.b.c.d:port` and nothing else. */
        fun isAddress(text: String): Boolean {
            val ip = text.substringBeforeLast(':', "")
            val port = text.substringAfterLast(':', "").toIntOrNull() ?: return false
            val parts = ip.split('.')
            return port in 1..65535 && parts.size == 4 &&
                parts.all { p -> p.isNotEmpty() && p.length <= 3 && p.all(Char::isDigit) && p.toInt() <= 255 }
        }

        fun cleanName(name: String): String =
            name.filterNot { it.isISOControl() }.trim().take(MAX_NAME_LEN)
    }
}
