package lol.truemain.mobile

import android.content.Context
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import lol.truemain.mobile.data.StaticData
import lol.truemain.mobile.data.TrueMainApi
import lol.truemain.mobile.link.Discovery
import lol.truemain.mobile.link.LinkClient
import lol.truemain.mobile.session.Session
import lol.truemain.mobile.store.PairingStore
import lol.truemain.mobile.ui.theme.ThemeStore
import okhttp3.OkHttpClient

/** The app's long-lived parts, made once with the process (`TrueMainApp`). */
class AppGraph(context: Context) {
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()
    val store = PairingStore(context)
    val discovery = Discovery(context, http)
    val link = LinkClient(store, discovery, http, scope)
    val session = Session(link, scope)
    val theme = ThemeStore(context, session, scope)
    val staticData = StaticData(http, context.cacheDir)
    val api = TrueMainApi(http)
}
