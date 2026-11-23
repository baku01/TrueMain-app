package lol.truemain.mobile.link

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import java.net.Inet4Address
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.OkHttpClient
import okhttp3.Request

/** A desktop that answered on this network. */
data class FoundDesktop(val address: String, val name: String)

/**
 * Finds the paired desktop again when its address changed (a new DHCP lease):
 * it listens on a fixed port, so every address of the phone's own /24 is
 * asked who it is (`GET /truemain-link`). Only Wi-Fi and Ethernet are
 * scanned: a phone on mobile data shares no network with the desktop.
 */
class Discovery(private val context: Context, client: OkHttpClient) {
    private val http = client.newBuilder()
        .connectTimeout(700, TimeUnit.MILLISECONDS)
        .readTimeout(700, TimeUnit.MILLISECONDS)
        .callTimeout(1500, TimeUnit.MILLISECONDS)
        .build()

    /** The phone's own IPv4 address on a local network, or null off Wi-Fi. */
    fun localAddress(): Inet4Address? {
        val connectivity = context.getSystemService(ConnectivityManager::class.java) ?: return null
        val network = connectivity.activeNetwork ?: return null
        val capabilities = connectivity.getNetworkCapabilities(network) ?: return null
        val local = capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
        if (!local) return null
        return connectivity.getLinkProperties(network)?.linkAddresses
            ?.map { it.address }
            ?.filterIsInstance<Inet4Address>()
            ?.firstOrNull { it.isSiteLocalAddress }
    }

    suspend fun scan(): List<FoundDesktop> = withContext(Dispatchers.IO) {
        val own = localAddress() ?: return@withContext emptyList()
        val prefix = own.address.take(3).joinToString(".") { (it.toInt() and 0xff).toString() }
        val self = own.address[3].toInt() and 0xff
        val gate = Semaphore(48)
        coroutineScope {
            (1..254).filter { it != self }.map { host ->
                async { gate.withPermit { ask("$prefix.$host:$PORT") } }
            }.awaitAll().filterNotNull()
        }
    }

    /** The desktop at `address`, if it is a TrueMain desktop speaking this version. */
    fun ask(address: String): FoundDesktop? = runCatching {
        http.newCall(Request.Builder().url("http://$address$DISCOVERY_PATH").build()).execute().use { response ->
            if (!response.isSuccessful) return null
            val body = Json.parseToJsonElement(response.body.string()).jsonObject
            if (body["app"]?.jsonPrimitive?.content != "truemain" || body["v"]?.jsonPrimitive?.int != VERSION) return null
            FoundDesktop(address, body["name"]?.jsonPrimitive?.content.orEmpty())
        }
    }.getOrNull()
}
