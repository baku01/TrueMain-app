package lol.truemain.mobile

import android.app.Application
import android.content.Context
import coil3.ImageLoader
import coil3.PlatformContext
import coil3.SingletonImageLoader
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import coil3.request.crossfade
import kotlinx.coroutines.launch

class TrueMainApp : Application(), SingletonImageLoader.Factory {
    lateinit var graph: AppGraph
        private set

    override fun onCreate() {
        super.onCreate()
        graph = AppGraph(this)
        graph.link.start()
        graph.scope.launch { graph.staticData.load() }
    }

    /** Coil shares the app's HTTP client: one connection pool for Data Dragon. */
    override fun newImageLoader(context: PlatformContext): ImageLoader = ImageLoader.Builder(context)
        .components { add(OkHttpNetworkFetcherFactory(callFactory = { graph.http })) }
        .crossfade(true)
        .build()
}

val Context.graph: AppGraph get() = (applicationContext as TrueMainApp).graph
