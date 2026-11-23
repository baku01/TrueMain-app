package lol.truemain.mobile.store

import android.content.Context
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import lol.truemain.mobile.link.B64
import lol.truemain.mobile.link.KEY_LEN
import lol.truemain.mobile.link.KeyPair
import lol.truemain.mobile.link.PhoneIdentity
import lol.truemain.mobile.link.randomBytes

/** The desktop this phone paired with, as it pinned it. */
@Serializable
data class PairedDesktop(
    /** Its static key, base64url: what a resumed link proves it holds. */
    val pcKey: String,
    val name: String,
    /** `ip:port`, last known first. */
    val addresses: List<String>,
)

/**
 * What the phone keeps: its id and static key (made once, the secret wrapped
 * by a key that never leaves the Android Keystore) and the desktop it paired
 * with. One desktop at a time, as the player has one computer playing.
 */
open class PairingStore(context: Context) {
    private val prefs = context.getSharedPreferences("phone-link", Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true }

    open fun identity(): PhoneIdentity {
        val id = prefs.getString(KEY_ID, null)
        val secret = prefs.getString(KEY_SECRET, null)?.let(::unwrap)
        if (id != null && secret != null && secret.size == KEY_LEN) {
            return PhoneIdentity(id, KeyPair.fromSecret(secret), deviceName())
        }
        val keys = KeyPair.generate()
        val phoneId = B64.encode(randomBytes(16))
        prefs.edit()
            .putString(KEY_ID, phoneId)
            .putString(KEY_SECRET, wrap(keys.secretBytes()))
            // A new identity knows no desktop: the old pairing would only be refused.
            .remove(KEY_DESKTOP)
            .apply()
        return PhoneIdentity(phoneId, keys, deviceName())
    }

    open fun desktop(): PairedDesktop? = prefs.getString(KEY_DESKTOP, null)?.let {
        runCatching { json.decodeFromString(PairedDesktop.serializer(), it) }.getOrNull()
    }

    open fun saveDesktop(desktop: PairedDesktop) {
        prefs.edit().putString(KEY_DESKTOP, json.encodeToString(PairedDesktop.serializer(), desktop)).apply()
    }

    /** Remembers where the desktop answered, so the next launch tries it first. */
    open fun rememberAddress(address: String) {
        val desktop = desktop() ?: return
        saveDesktop(desktop.copy(addresses = (listOf(address) + desktop.addresses).distinct().take(6)))
    }

    open fun forgetDesktop() {
        prefs.edit().remove(KEY_DESKTOP).apply()
    }

    private fun keystoreKey(): SecretKey {
        val keystore = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        (keystore.getEntry(KEY_ALIAS, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
        generator.init(
            KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        return generator.generateKey()
    }

    private fun wrap(secret: ByteArray): String {
        val cipher = Cipher.getInstance(TRANSFORMATION).apply { init(Cipher.ENCRYPT_MODE, keystoreKey()) }
        return B64.encode(cipher.iv) + "." + B64.encode(cipher.doFinal(secret))
    }

    /** Null when the wrapped secret no longer opens (Keystore reset, backup restored elsewhere). */
    private fun unwrap(text: String): ByteArray? = runCatching {
        val (iv, sealed) = text.split('.', limit = 2)
        val ivBytes = B64.decode(iv, 12)
        val sealedBytes = java.util.Base64.getUrlDecoder().decode(sealed)
        Cipher.getInstance(TRANSFORMATION)
            .apply { init(Cipher.DECRYPT_MODE, keystoreKey(), GCMParameterSpec(128, ivBytes)) }
            .doFinal(sealedBytes)
    }.getOrNull()

    private companion object {
        const val KEYSTORE = "AndroidKeyStore"
        const val KEY_ALIAS = "truemain-phone-link"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val KEY_ID = "phoneId"
        const val KEY_SECRET = "secret"
        const val KEY_DESKTOP = "desktop"

        fun deviceName(): String {
            val model = Build.MODEL.orEmpty()
            val maker = Build.MANUFACTURER.orEmpty()
            val name = if (model.startsWith(maker, ignoreCase = true)) model else "$maker $model"
            return name.trim().ifEmpty { "Android" }.take(40)
        }
    }
}
