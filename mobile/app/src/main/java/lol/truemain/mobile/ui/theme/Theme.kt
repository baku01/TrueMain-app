package lol.truemain.mobile.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.serialization.json.JsonElement
import lol.truemain.mobile.R
import lol.truemain.mobile.lcu.bool
import lol.truemain.mobile.lcu.get
import lol.truemain.mobile.lcu.string

/**
 * The desktop app's design tokens (`desktop/app/app/assets/css/main.css`),
 * named as Nuxt UI names them. The phone draws in the theme the player chose on
 * the computer: the desktop resolves its tokens and sends them
 * (`utils/phone-theme.ts` → `/truemain/theme`); until it has, TrueMain's own.
 */
@Immutable
data class TmColors(
    val light: Boolean,
    val bg: Color,
    val bgMuted: Color,
    val bgElevated: Color,
    val bgAccented: Color,
    val pane: Color,
    val pane2: Color,
    val border: Color,
    val borderAccented: Color,
    val primary: Color,
    val textInverted: Color,
    val text: Color,
    val textHighlighted: Color,
    val textToned: Color,
    val textMuted: Color,
    val textDimmed: Color,
    val success: Color,
    val warning: Color,
    val error: Color,
    val gold: Color,
    val dataGood: Color,
    val dataMid: Color,
    val dataBad: Color,
    val ally: Color,
    val enemy: Color,
    val tierS: Color,
    val tierA: Color,
    val tierB: Color,
    val tierC: Color,
    val tierD: Color,
) {
    companion object {
        /** TrueMain's dark theme, the app's default. */
        val TrueMainDark = TmColors(
            light = false,
            bg = c(0x080C14), bgMuted = c(0x0D121C), bgElevated = c(0x131A27), bgAccented = c(0x1B2434),
            pane = c(0x101827), pane2 = c(0x141D2D), border = c(0x1C2535), borderAccented = c(0x2D3A4F),
            primary = c(0x52A8FF), textInverted = c(0x080C14),
            text = c(0xE8EEF9), textHighlighted = c(0xFFFFFF), textToned = c(0xD1D9E6), textMuted = c(0xAEB9CC), textDimmed = c(0x8693AB),
            success = c(0x4ADE80), warning = c(0xFBBF24), error = c(0xF87171),
            gold = c(0xD9B676), dataGood = c(0x52A8FF), dataMid = c(0x8693AB), dataBad = c(0x61708A),
            ally = c(0x4F8FFF), enemy = c(0xFF4D5E),
            tierS = c(0x52A8FF), tierA = c(0xE2B95C), tierB = c(0xB9C2CD), tierC = c(0xB3763F), tierD = c(0x837A7C),
        )

        /** TrueMain's light theme, the fallback for a light theme's missing tokens. */
        val TrueMainLight = TmColors(
            light = true,
            bg = c(0xEEF1F6), bgMuted = c(0xF3F5F9), bgElevated = c(0xFFFFFF), bgAccented = c(0xE4E9F1),
            pane = c(0xFFFFFF), pane2 = c(0xF3F5F9), border = c(0xD6DCE6), borderAccented = c(0xB9C3D3),
            primary = c(0x1A6FD6), textInverted = c(0xFFFFFF),
            text = c(0x1C2535), textHighlighted = c(0x111827), textToned = c(0x2D3A4F), textMuted = c(0x45536B), textDimmed = c(0x61708A),
            success = c(0x16A34A), warning = c(0xD97706), error = c(0xDC2626),
            gold = c(0xA37A2C), dataGood = c(0x1A6FD6), dataMid = c(0x61708A), dataBad = c(0x45536B),
            ally = c(0x4F8FFF), enemy = c(0xFF4D5E),
            tierS = c(0x1A6FD6), tierA = c(0xA8741A), tierB = c(0x647083), tierC = c(0x9A5A22), tierD = c(0x6B6265),
        )

        private fun c(rgb: Long) = Color(0xFF000000 or rgb)

        private fun parse(text: String?): Color? {
            val hex = text?.removePrefix("#")?.takeIf { it.length == 6 } ?: return null
            return hex.toLongOrNull(16)?.let(::c)
        }

        /** The desktop's `{ theme, light, colors: { bg: "#rrggbb", … } }`; a token it left out keeps TrueMain's. */
        fun fromJson(json: JsonElement?): TmColors? {
            val colors = json["colors"] ?: return null
            val light = json["light"].bool ?: return null
            val base = if (light) TrueMainLight else TrueMainDark
            fun t(name: String, fallback: Color) = parse(colors[name].string) ?: fallback
            return TmColors(
                light = light,
                bg = t("bg", base.bg), bgMuted = t("bgMuted", base.bgMuted), bgElevated = t("bgElevated", base.bgElevated),
                bgAccented = t("bgAccented", base.bgAccented), pane = t("pane", base.pane), pane2 = t("pane2", base.pane2),
                border = t("border", base.border), borderAccented = t("borderAccented", base.borderAccented),
                primary = t("primary", base.primary), textInverted = t("textInverted", base.textInverted),
                text = t("text", base.text), textHighlighted = t("textHighlighted", base.textHighlighted),
                textToned = t("textToned", base.textToned), textMuted = t("textMuted", base.textMuted),
                textDimmed = t("textDimmed", base.textDimmed),
                success = t("success", base.success), warning = t("warning", base.warning), error = t("error", base.error),
                gold = t("gold", base.gold), dataGood = t("dataGood", base.dataGood), dataMid = t("dataMid", base.dataMid),
                dataBad = t("dataBad", base.dataBad), ally = t("ally", base.ally), enemy = t("enemy", base.enemy),
                tierS = t("tierS", base.tierS), tierA = t("tierA", base.tierA), tierB = t("tierB", base.tierB),
                tierC = t("tierC", base.tierC), tierD = t("tierD", base.tierD),
            )
        }
    }
}

val LocalTmColors = staticCompositionLocalOf { TmColors.TrueMainDark }

/**
 * The screens' colours, read from the theme in place. The names are the
 * palette's steps the screens were first written against (ink for the
 * neutrals, darkest first; rose for the accent), each now the token that
 * plays its part — so a light theme turns `Ink950` (the page) light and
 * `Ink100` (the headings) dark, as the desktop's own tokens do.
 */
object Tm {
    val colors: TmColors @Composable @ReadOnlyComposable get() = LocalTmColors.current

    val Ink950: Color @Composable @ReadOnlyComposable get() = colors.bg
    val Ink900: Color @Composable @ReadOnlyComposable get() = colors.pane
    val Ink800: Color @Composable @ReadOnlyComposable get() = colors.bgAccented
    val Ink700: Color @Composable @ReadOnlyComposable get() = colors.borderAccented
    val Ink600: Color @Composable @ReadOnlyComposable get() = lerp(colors.borderAccented, colors.textDimmed, 0.35f)
    val Ink500: Color @Composable @ReadOnlyComposable get() = lerp(colors.textDimmed, colors.bg, 0.25f)
    val Ink400: Color @Composable @ReadOnlyComposable get() = colors.textDimmed
    val Ink300: Color @Composable @ReadOnlyComposable get() = colors.textMuted
    val Ink200: Color @Composable @ReadOnlyComposable get() = colors.text
    val Ink100: Color @Composable @ReadOnlyComposable get() = colors.textHighlighted

    val Rose300: Color @Composable @ReadOnlyComposable get() = lerp(colors.primary, colors.textHighlighted, 0.25f)
    val Rose400: Color @Composable @ReadOnlyComposable get() = colors.primary
    val Rose500: Color @Composable @ReadOnlyComposable get() = colors.primary
    val Rose700: Color @Composable @ReadOnlyComposable get() = lerp(colors.primary, colors.bg, 0.35f)
    /** The accent's soft fill (Nuxt UI's `soft` variant): the primary laid thin over the page. */
    val Rose950: Color @Composable @ReadOnlyComposable get() = lerp(colors.bg, colors.primary, if (colors.light) 0.12f else 0.18f)
    val Gold: Color @Composable @ReadOnlyComposable get() = colors.gold

    /** Data colours: above average / win, average, below / loss. */
    val Good: Color @Composable @ReadOnlyComposable get() = colors.dataGood
    val Mid: Color @Composable @ReadOnlyComposable get() = colors.dataMid
    val Bad: Color @Composable @ReadOnlyComposable get() = colors.dataBad

    /** The two sides of a game, as the desktop's draft draws them. */
    val Blue: Color @Composable @ReadOnlyComposable get() = colors.ally
    val Red: Color @Composable @ReadOnlyComposable get() = colors.enemy
    val Success: Color @Composable @ReadOnlyComposable get() = colors.success

    /** Nuxt UI's buttons are `rounded-lg`, never Material's pills: every button takes this. */
    val ButtonShape = RoundedCornerShape(8.dp)

    /** Desktop's display face (Sora) for titles and big figures. */
    val DisplayFont: FontFamily get() = Sora

    /** Monospace face (Geist Mono) for clocks, timers and aligned stats. */
    val MonoFont: FontFamily get() = GeistMono
}

/** Sora, geometric and wide — the desktop app's voice for titles and big figures. */
private val Sora = FontFamily(
    listOf(400, 500, 600, 700, 800).map { weight ->
        Font(R.font.sora, FontWeight(weight), variationSettings = FontVariation.Settings(FontVariation.weight(weight)))
    },
)

/** Figtree, a warm grotesque that stays legible at small sizes — the desktop app's body face. */
private val Figtree = FontFamily(
    listOf(400, 500, 600, 700).map { weight ->
        Font(R.font.figtree, FontWeight(weight), variationSettings = FontVariation.Settings(FontVariation.weight(weight)))
    },
)

/** Geist Mono, for clocks and timers. */
private val GeistMono = FontFamily(
    listOf(400, 500, 600, 700).map { weight ->
        Font(R.font.geist_mono, FontWeight(weight), variationSettings = FontVariation.Settings(FontVariation.weight(weight)))
    },
)

private fun typography(): Typography = Typography().run {
    fun TextStyle.display(weight: FontWeight? = null) =
        copy(fontFamily = Sora, fontWeight = weight ?: fontWeight, fontFeatureSettings = "tnum")
    fun TextStyle.sans(weight: FontWeight? = null) =
        copy(fontFamily = Figtree, fontWeight = weight ?: fontWeight, fontFeatureSettings = "tnum")
    copy(
        displayLarge = displayLarge.display(FontWeight.Bold),
        displayMedium = displayMedium.display(FontWeight.Bold),
        displaySmall = displaySmall.display(FontWeight.SemiBold),
        headlineLarge = headlineLarge.display(FontWeight.SemiBold),
        headlineMedium = headlineMedium.display(FontWeight.SemiBold),
        headlineSmall = headlineSmall.display(FontWeight.SemiBold),
        titleLarge = titleLarge.display(FontWeight.SemiBold),
        titleMedium = titleMedium.display(FontWeight.SemiBold),
        titleSmall = titleSmall.sans(FontWeight.SemiBold),
        bodyLarge = bodyLarge.sans(),
        bodyMedium = bodyMedium.sans(),
        bodySmall = bodySmall.sans(),
        labelLarge = labelLarge.sans(FontWeight.Medium),
        labelMedium = labelMedium.sans(FontWeight.Medium),
        // Sentence-case section label, matching desktop's `.stat-label`.
        labelSmall = TextStyle(fontFamily = Figtree, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.15.sp, fontFeatureSettings = "tnum"),
    )
}

private val shapes = Shapes(
    extraSmall = RoundedCornerShape(4.dp),
    small = RoundedCornerShape(6.dp),
    medium = RoundedCornerShape(8.dp),
    large = RoundedCornerShape(12.dp),
    extraLarge = RoundedCornerShape(16.dp),
)

@Composable
fun TrueMainTheme(colors: TmColors = TmColors.TrueMainDark, content: @Composable () -> Unit) {
    val scheme = (if (colors.light) lightColorScheme() else darkColorScheme()).copy(
        primary = colors.primary,
        onPrimary = colors.textInverted,
        primaryContainer = lerp(colors.bg, colors.primary, 0.18f),
        onPrimaryContainer = colors.primary,
        secondary = colors.gold,
        onSecondary = colors.textInverted,
        tertiary = colors.textMuted,
        background = colors.bg,
        onBackground = colors.text,
        surface = colors.bg,
        onSurface = colors.text,
        surfaceVariant = colors.bgAccented,
        onSurfaceVariant = colors.textMuted,
        surfaceContainerLowest = colors.bg,
        surfaceContainerLow = colors.bgMuted,
        surfaceContainer = colors.pane,
        surfaceContainerHigh = colors.bgElevated,
        surfaceContainerHighest = colors.bgAccented,
        inverseSurface = colors.textHighlighted,
        inverseOnSurface = colors.bg,
        outline = colors.borderAccented,
        outlineVariant = colors.border,
        error = colors.error,
        onError = colors.textInverted,
        scrim = Color.Black,
    )
    CompositionLocalProvider(LocalTmColors provides colors) {
        MaterialTheme(colorScheme = scheme, typography = typography(), shapes = shapes, content = content)
    }
}
