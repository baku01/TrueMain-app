package lol.truemain.mobile.screens

import androidx.activity.ComponentActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import coil3.EventListener
import coil3.ImageLoader
import coil3.SingletonImageLoader
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import coil3.request.ErrorResult
import coil3.request.ImageRequest
import coil3.request.SuccessResult
import coil3.request.allowHardware
import com.github.takahirom.roborazzi.ExperimentalRoborazziApi
import com.github.takahirom.roborazzi.captureRoboImage
import com.github.takahirom.roborazzi.captureScreenRoboImage
import java.io.File
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import lol.truemain.mobile.TrueMainApp
import lol.truemain.mobile.link.LinkResponse
import lol.truemain.mobile.link.LinkState
import lol.truemain.mobile.link.PcInfo
import lol.truemain.mobile.session.Session
import lol.truemain.mobile.ui.TrueMainRoot
import lol.truemain.mobile.ui.theme.Tm
import lol.truemain.mobile.ui.theme.TrueMainTheme
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Every screen of the app rendered to a PNG on the JVM, with the client's
 * answers faked at the link (`LinkClient.fake`) and the real Data Dragon,
 * Community Dragon and truemain.lol over the network. Written to
 * `mobile/screenshots/`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w411dp-h891dp-xxhdpi", application = TrueMainApp::class)
class ScreenshotTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val app: TrueMainApp get() = ApplicationProvider.getApplicationContext()
    private val graph get() = app.graph
    private val answers = ConcurrentHashMap<String, JsonElement>()
    private val images = ImageWatch()

    private val pc = LinkState.Open(PcInfo(name = "BATTLESTATION", addresses = listOf("192.168.1.42:47615")), "192.168.1.42:47615")

    @Before
    fun setUp() {
        SingletonImageLoader.setUnsafe(
            ImageLoader.Builder(app)
                .components { add(OkHttpNetworkFetcherFactory(callFactory = { graph.http })) }
                .allowHardware(false)
                .eventListener(images)
                .build(),
        )
        graph.link.fake = { method, path, _ ->
            if (method == "GET") {
                answers[path.substringBefore('?')]?.let { LinkResponse(200, it) } ?: LinkResponse(404, JsonNull)
            } else {
                LinkResponse(204, JsonNull)
            }
        }
        checkNotNull(runBlocking { withTimeout(90_000) { graph.staticData.load() } }) { "Data Dragon did not load" }
        compose.mainClock.autoAdvance = false
    }

    @After
    fun tearDown() {
        graph.link.fake = null
    }

    @Test
    fun connect() {
        show()
        settle()
        capture("01-connect")
    }

    @Test
    fun home() {
        connected("None")
        show()
        settle { hasText("Faker#KR1").exists() && hasText("Victory").exists() }
        capture("02-home")
    }

    /** The desktop on Catppuccin Latte: the phone turns light with it. */
    @Test
    fun homeLatte() {
        connected("None", Session.THEME to Fixtures.latte)
        show()
        settle { hasText("Faker#KR1").exists() && hasText("Victory").exists() }
        capture("02b-home-latte")
    }

    /** The desktop on Catppuccin Mocha with the mauve accent. */
    @Test
    fun draftMocha() {
        connected("ChampSelect", Session.THEME to Fixtures.mocha, *draft(locked = false))
        show()
        settle { hasText("Lock in Ahri").exists() }
        capture("07b-draft-pick-mocha")
    }

    @Test
    fun playQueues() {
        connected("None")
        show()
        settle()
        compose.onNode(hasText("Play")).performClick()
        settle { hasText("Ranked Solo/Duo").exists() }
        capture("03-play-queues")
    }

    @Test
    fun playLobby() {
        connected("Matchmaking", Session.LOBBY to Fixtures.lobby, Session.SEARCH to Fixtures.searching)
        show()
        settle { hasText("Ranked Flex").exists() }
        capture("04-play-lobby")
        scrollTo(hasText("Leave the queue"))
        capture("05-play-lobby-queue")
    }

    @Test
    fun readyCheck() {
        connected(
            "ReadyCheck",
            Session.LOBBY to Fixtures.lobby,
            Session.SEARCH to Fixtures.found,
            Session.READY_CHECK to Fixtures.readyCheck,
        )
        show()
        settle { hasText("Accept", substring = true).exists() }
        capture("06-ready-check")
    }

    @Test
    fun draftPick() {
        connected("ChampSelect", *draft(locked = false))
        show()
        settle { hasText("Lock in Ahri").exists() }
        capture("07-draft-pick")
        scrollTo(hasText("Your team", ignoreCase = true))
        capture("08-draft-pick-teams")
    }

    @Test
    fun draftLocked() {
        connected("ChampSelect", *draft(locked = true))
        answers["/lol-champ-select/v1/skin-carousel-skins"] = Fixtures.skinCarousel
        show()
        settle(timeout = 60_000) { hasText("Apply these runes").exists() }
        capture("09-draft-locked")
        compose.onNode(hasText("Choose a skin")).performClick()
        settle { hasText("K/DA Ahri").exists() }
        captureScreen("10-draft-skins")
    }

    @Test
    fun game() {
        connected("InProgress", Session.GAME to Fixtures.game)
        show()
        settle { hasText("Faker").exists() }
        capture("11-game")
        scrollTo(hasText("Lehends"))
        capture("12-game-red-side")
    }

    @Test
    fun builds() {
        connected("None")
        show()
        settle()
        compose.onNode(hasText("Builds")).performClick()
        settle(timeout = 60_000) { hasText("Patch", substring = true).exists() }
        capture("13-builds-tier-list")
        compose.onNode(hasSetTextAction()).performTextInput("Ahri")
        settle { hasText("Ahri").exists() }
        // The tier row, not the search field that also reads "Ahri".
        compose.onAllNodes(hasText("games", substring = true) and hasClickAction()).onFirst().performClick()
        settle(timeout = 60_000) { hasText("Games analysed").exists() }
        capture("14-builds-champion")
        scrollTo(hasText("Core build", ignoreCase = true))
        capture("15-builds-champion-items")
    }

    private fun draft(locked: Boolean): Array<Pair<String, JsonElement>> = arrayOf(
        Session.CHAMP_SELECT to Fixtures.champSelect(locked),
        Session.GAMEFLOW_SESSION to Fixtures.gameflowSession,
        Session.CURRENT_RUNE_PAGE to Fixtures.currentRunePage,
        Session.RUNE_PAGES to Fixtures.runePages,
    )

    /** The link open on a PC whose client is in [phase], with [state] as the client's current answers. */
    private fun connected(phase: String, vararg state: Pair<String, JsonElement>) {
        answers[Session.APP_STATE] = Fixtures.appState
        answers[Session.GAMEFLOW_PHASE] = Fixtures.phase(phase)
        answers["/lol-summoner/v1/current-summoner"] = Fixtures.summoner
        answers["/lol-ranked/v1/current-ranked-stats"] = Fixtures.ranked
        answers["/lol-match-history/v1/products/lol/current-summoner/matches"] = Fixtures.history()
        answers["/lol-game-queues/v1/queues"] = Fixtures.queues
        state.forEach { (uri, body) -> answers[uri] = body }
        graph.link.showState(pc)
        runBlocking { Session.FOLLOWED.forEach { graph.session.refresh(it) } }
        val deadline = System.currentTimeMillis() + 10_000
        while (graph.session.phase.value != phase && phase != "None" && System.currentTimeMillis() < deadline) Thread.sleep(20)
    }

    /**
     * Scrolls the screen's vertical list until [matcher]'s node is near its top (or the list ends).
     * `performScrollTo` refuses a clock driven by hand; the semantics scroll only needs frames.
     */
    private fun scrollTo(matcher: SemanticsMatcher) {
        val list = compose.onAllNodes(hasScrollAction() and verticalList).onFirst()
        val top = list.fetchSemanticsNode().boundsInRoot.top
        val target = compose.onAllNodes(matcher).onFirst().fetchSemanticsNode().boundsInRoot.top
        val margin = 16 * app.resources.displayMetrics.density
        list.performSemanticsAction(SemanticsActions.ScrollBy) { it(0f, target - top - margin) }
        settle()
    }

    private val verticalList = SemanticsMatcher("scrolls vertically") { SemanticsProperties.VerticalScrollAxisRange in it.config }

    /** Drawn as `MainActivity` draws: in the theme the desktop sent (`ThemeStore`). */
    private fun show() {
        compose.setContent {
            val colors by graph.theme.colors.collectAsState()
            TrueMainTheme(colors) {
                // The window's own background, which the test activity lacks.
                Box(Modifier.fillMaxSize().background(Tm.colors.bg)) { TrueMainRoot() }
            }
        }
    }

    private fun SemanticsMatcher.exists(): Boolean =
        compose.onAllNodes(this).fetchSemanticsNodes().isNotEmpty()

    /**
     * Runs frames until [ready] holds and no image has been loading for a
     * while: the clock is driven by hand, since the screens' timers never let
     * Compose idle on its own.
     */
    private fun settle(timeout: Long = 30_000, ready: () -> Boolean = { true }) {
        val deadline = System.currentTimeMillis() + timeout
        var quiet = 0
        while (System.currentTimeMillis() < deadline) {
            compose.mainClock.advanceTimeBy(100)
            compose.waitForIdle()
            Thread.sleep(30)
            if (images.loading.get() == 0 && ready()) {
                if (++quiet >= 20) return
            } else {
                quiet = 0
            }
        }
        println("settle: timed out (ready=${ready()}, images loading=${images.loading.get()}, failed=${images.failed})")
    }

    private fun file(name: String): String =
        File(System.getProperty("truemain.screenshots") ?: "build/screenshots", "$name.png").apply { parentFile?.mkdirs() }.path

    private fun capture(name: String) {
        compose.onRoot().captureRoboImage(file(name))
        println("screenshot $name: images failed so far=${images.failed}")
    }

    @OptIn(ExperimentalRoborazziApi::class)
    private fun captureScreen(name: String) {
        captureScreenRoboImage(file(name))
        println("screenshot $name: images failed so far=${images.failed}")
    }

    /** How many images are loading now, and which failed. */
    private class ImageWatch : EventListener() {
        val loading = AtomicInteger()
        val failed: MutableList<String> = java.util.Collections.synchronizedList(mutableListOf())

        override fun onStart(request: ImageRequest) {
            loading.incrementAndGet()
        }

        override fun onSuccess(request: ImageRequest, result: SuccessResult) {
            loading.decrementAndGet()
        }

        override fun onError(request: ImageRequest, result: ErrorResult) {
            loading.decrementAndGet()
            failed += "${request.data}: ${result.throwable.message}"
        }

        override fun onCancel(request: ImageRequest) {
            loading.decrementAndGet()
        }
    }
}
