package lol.truemain.mobile

import android.content.Intent
import android.os.Bundle
import android.graphics.Color
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import lol.truemain.mobile.link.Invite
import lol.truemain.mobile.ui.TrueMainRoot
import lol.truemain.mobile.ui.theme.AppIconSwitcher
import lol.truemain.mobile.ui.theme.TrueMainTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        handle(intent)
        setContent {
            val colors by graph.theme.colors.collectAsState()
            // The status and navigation bars' icons dark on a light theme, light on a dark one.
            LaunchedEffect(colors.light) {
                val style = if (colors.light) {
                    SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
                } else {
                    SystemBarStyle.dark(Color.TRANSPARENT)
                }
                enableEdgeToEdge(statusBarStyle = style, navigationBarStyle = style)
            }
            TrueMainTheme(colors) { TrueMainRoot() }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handle(intent)
    }

    override fun onStart() {
        super.onStart()
        AppIconSwitcher.onForeground()
    }

    override fun onResume() {
        super.onResume()
        // Back from the background: the Wi-Fi may have come back while the app slept, and a link
        // that still reads as open may be dead — `wake` checks it rather than trusting it.
        graph.link.wake()
    }

    override fun onStop() {
        super.onStop()
        // Apply any queued themed launcher icon only once the app leaves the foreground
        // so Android never closes the open window mid-session.
        if (!isChangingConfigurations) {
            AppIconSwitcher.onBackground(applicationContext)
        }
    }

    /** A `truemain://link?…` opened from the system camera pairs like a scan in the app. */
    private fun handle(intent: Intent?) {
        val invite = intent?.dataString?.let(Invite::parse) ?: return
        graph.link.pair(invite)
    }
}
