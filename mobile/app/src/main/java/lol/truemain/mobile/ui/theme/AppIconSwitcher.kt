package lol.truemain.mobile.ui.theme

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb

/**
 * Switches the Android launcher `<activity-alias>` to match the active desktop
 * theme so the home-screen / app-drawer icon changes colour with the theme and
 * stays themed even when the app is closed or the device restarts.
 */
object AppIconSwitcher {
    enum class Variant(val aliasSuffix: String) {
        Default(".MainActivityDefault"),
        Light(".MainActivityLight"),
        Blue(".MainActivityBlue"),
        Purple(".MainActivityPurple"),
        Pink(".MainActivityPink"),
        Red(".MainActivityRed"),
        Amber(".MainActivityAmber"),
        Green(".MainActivityGreen"),
    }

    /** Maps a desktop theme id + resolved colours to the closest launcher icon variant. */
    fun variantFor(themeId: String?, colors: TmColors): Variant {
        if (themeId.equals("truemain", ignoreCase = true) || themeId.isNullOrBlank()) {
            return if (colors.light) Variant.Light else Variant.Default
        }
        val (hue, sat) = rgbToHueSat(colors.primary)
        if (colors.light && sat < 0.22f) return Variant.Light
        return when {
            hue < 20f || hue >= 340f -> Variant.Red
            hue < 70f -> Variant.Amber
            hue < 185f -> Variant.Green
            hue < 245f -> Variant.Blue
            hue < 295f -> Variant.Purple
            else -> Variant.Pink
        }
    }

    /**
     * Enables the alias for [variant] and disables all others. No-ops if that
     * alias is already the sole active one so switching themes never churns
     * the launcher unnecessarily.
     */
    fun apply(context: Context, variant: Variant) {
        val pm = context.packageManager
        val pkg = context.packageName
        val target = ComponentName(pkg, pkg + variant.aliasSuffix)
        val currentState = runCatching { pm.getComponentEnabledSetting(target) }.getOrNull()
        val alreadyActive = currentState == PackageManager.COMPONENT_ENABLED_STATE_ENABLED ||
            (variant == Variant.Default && currentState == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT)
        if (alreadyActive && othersDisabled(pm, pkg, variant)) return

        // Enable the new alias first so Android never sees zero launcher activities.
        runCatching {
            pm.setComponentEnabledSetting(
                target,
                PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                PackageManager.DONT_KILL_APP,
            )
        }
        for (other in Variant.entries) {
            if (other == variant) continue
            val component = ComponentName(pkg, pkg + other.aliasSuffix)
            val state = runCatching { pm.getComponentEnabledSetting(component) }.getOrNull()
            if (state != PackageManager.COMPONENT_ENABLED_STATE_DISABLED) {
                runCatching {
                    pm.setComponentEnabledSetting(
                        component,
                        PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                        PackageManager.DONT_KILL_APP,
                    )
                }
            }
        }
    }

    private fun othersDisabled(pm: PackageManager, pkg: String, active: Variant): Boolean {
        for (other in Variant.entries) {
            if (other == active) continue
            val component = ComponentName(pkg, pkg + other.aliasSuffix)
            val state = runCatching { pm.getComponentEnabledSetting(component) }.getOrNull()
            val expectedDisabled = state == PackageManager.COMPONENT_ENABLED_STATE_DISABLED ||
                (other != Variant.Default && state == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT)
            if (!expectedDisabled) return false
        }
        return true
    }

    internal fun rgbToHueSat(color: Color): Pair<Float, Float> {
        val argb = color.toArgb()
        val r = ((argb shr 16) and 0xFF) / 255f
        val g = ((argb shr 8) and 0xFF) / 255f
        val b = (argb and 0xFF) / 255f
        val max = maxOf(r, g, b)
        val min = minOf(r, g, b)
        val delta = max - min
        val sat = if (max == 0f) 0f else delta / max
        val hue = when {
            delta == 0f -> 0f
            max == r -> 60f * (((g - b) / delta) % 6f)
            max == g -> 60f * (((b - r) / delta) + 2f)
            else -> 60f * (((r - g) / delta) + 4f)
        }.let { if (it < 0f) it + 360f else it }
        return hue to sat
    }
}
