package lol.truemain.mobile.ui.theme

import android.content.Context
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import lol.truemain.mobile.lcu.get
import lol.truemain.mobile.lcu.string
import lol.truemain.mobile.session.Session

/**
 * The theme the desktop is in, followed live (`/truemain/theme`) and kept,
 * so the next launch opens in it before the link is back — never a flash of
 * TrueMain's theme for a player who chose another. Also updates the Android
 * launcher icon (`AppIconSwitcher`) so the themed icon persists while closed.
 */
class ThemeStore(context: Context, session: Session, scope: CoroutineScope) {
    private val appContext = context.applicationContext
    private val prefs = appContext.getSharedPreferences("theme", Context.MODE_PRIVATE)

    private val _colors = MutableStateFlow(
        prefs.getString(KEY, null)
            ?.let { runCatching { TmColors.fromJson(Json.parseToJsonElement(it)) }.getOrNull() }
            ?: TmColors.TrueMainDark,
    )
    val colors: StateFlow<TmColors> = _colors.asStateFlow()

    init {
        scope.launch {
            session.state(Session.THEME).collect { json ->
                val colors = TmColors.fromJson(json) ?: return@collect
                _colors.value = colors
                prefs.edit().putString(KEY, json.toString()).apply()
                AppIconSwitcher.schedule(
                    appContext,
                    AppIconSwitcher.variantFor(json["theme"].string, colors),
                )
            }
        }
    }

    private companion object {
        const val KEY = "desktop-theme"
    }
}
