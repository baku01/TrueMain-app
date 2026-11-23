package lol.truemain.mobile.ui.theme

import androidx.compose.ui.graphics.Color
import org.junit.Assert.assertEquals
import org.junit.Test

class AppIconSwitcherTest {
    private fun colorsWithPrimary(rgb: Long, light: Boolean = false): TmColors =
        (if (light) TmColors.TrueMainLight else TmColors.TrueMainDark)
            .copy(primary = Color(0xFF000000 or rgb))

    @Test
    fun mapsTrueMainThemesToDefaultAndLight() {
        assertEquals(
            AppIconSwitcher.Variant.Default,
            AppIconSwitcher.variantFor("truemain", TmColors.TrueMainDark),
        )
        assertEquals(
            AppIconSwitcher.Variant.Light,
            AppIconSwitcher.variantFor("truemain", TmColors.TrueMainLight),
        )
    }

    @Test
    fun mapsPaletteAccentsToMatchingIconBuckets() {
        assertEquals(AppIconSwitcher.Variant.Purple, AppIconSwitcher.variantFor("mocha", colorsWithPrimary(0xCBA6F7)))
        assertEquals(AppIconSwitcher.Variant.Blue, AppIconSwitcher.variantFor("nord", colorsWithPrimary(0x52A8FF)))
        assertEquals(AppIconSwitcher.Variant.Pink, AppIconSwitcher.variantFor("rose-pine", colorsWithPrimary(0xF5C2E7)))
        assertEquals(AppIconSwitcher.Variant.Red, AppIconSwitcher.variantFor("soviet", colorsWithPrimary(0xF38BA8)))
        assertEquals(AppIconSwitcher.Variant.Amber, AppIconSwitcher.variantFor("gruvbox", colorsWithPrimary(0xFAB387)))
        assertEquals(AppIconSwitcher.Variant.Green, AppIconSwitcher.variantFor("frappe", colorsWithPrimary(0xA6E3A1)))
    }
}
