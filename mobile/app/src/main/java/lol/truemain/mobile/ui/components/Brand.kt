package lol.truemain.mobile.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import lol.truemain.mobile.ui.theme.Tm

/**
 * TrueMain's M-check mark (`desktop/app/app/components/AppMark.vue`):
 * an M whose last stroke becomes a checkmark, painted in the active theme's primary ramp.
 */
@Composable
fun TmMark(size: Dp = 22.dp, modifier: Modifier = Modifier) {
    val primary = Tm.colors.primary
    val top = lerp(primary, Color.White, 0.45f)
    val bottom = lerp(primary, Color.Black, 0.35f)
    Canvas(modifier.size(size)) {
        val sx = this.size.width / 64f
        val sy = this.size.height / 64f
        val stroke = Path().apply {
            moveTo(13f * sx, 47f * sy)
            lineTo(13f * sx, 21f * sy)
            lineTo(28f * sx, 38f * sy)
            lineTo(51f * sx, 15f * sy)
        }
        drawPath(
            path = stroke,
            brush = Brush.verticalGradient(
                0f to top,
                0.55f to primary,
                1f to bottom,
            ),
            style = Stroke(
                width = 8f * sx,
                cap = StrokeCap.Round,
                join = StrokeJoin.Round,
            ),
        )
    }
}

/**
 * TrueMain's wordmark (`desktop/app/app/components/AppWordmark.vue`):
 * the M-check mark beside "True" (in the accent gradient) + "Main" (in highlighted text).
 */
@Composable
fun TmWordmark(
    modifier: Modifier = Modifier,
    fontSize: TextUnit = 16.sp,
    markSize: Dp = 20.dp,
) {
    val primary = Tm.colors.primary
    val primaryBright = lerp(primary, Color.White, if (Tm.colors.light) 0.12f else 0.38f)
    val mainText = Tm.colors.textHighlighted
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(if (markSize > 0.dp) 6.dp else 0.dp),
    ) {
        if (markSize > 0.dp) TmMark(size = markSize)
        Text(
            text = buildAnnotatedString {
                withStyle(
                    SpanStyle(
                        brush = Brush.horizontalGradient(listOf(primary, primaryBright)),
                        fontWeight = FontWeight.Bold,
                    ),
                ) { append("True") }
                withStyle(SpanStyle(color = mainText, fontWeight = FontWeight.Bold)) { append("Main") }
            },
            style = TextStyle(
                fontFamily = Tm.DisplayFont,
                fontSize = fontSize,
                letterSpacing = (-0.4).sp,
            ),
        )
    }
}

private data class TierMetal(val light: Color, val dark: Color, val shine: Color)

private fun metalFor(tier: String): TierMetal? = when (tier.uppercase()) {
    "S", "S+" -> TierMetal(Color(0xFFD6E8FF), Color(0xFF2F6FE4), Color(0xFFF2F8FF))
    "A" -> TierMetal(Color(0xFFFFE7A0), Color(0xFFC8921F), Color(0xFFFFF6D6))
    "B" -> TierMetal(Color(0xFFF3F6FA), Color(0xFF97A2B2), Color(0xFFFFFFFF))
    "C" -> TierMetal(Color(0xFFF3BF8C), Color(0xFF9B5A27), Color(0xFFFFE2C6))
    "D" -> TierMetal(Color(0xFFA7A2A8), Color(0xFF56525A), Color(0xFFCFCBD0))
    else -> null
}

/**
 * The desktop app's metallic tier crest (`desktop/app/app/components/TierBadge.vue`):
 * a beveled shield in blue steel (S), gold (A), silver (B), bronze (C) or iron (D),
 * with a chevron under its point and a specular top highlight.
 */
@Composable
fun TmTierBadge(tier: String, size: Dp = 26.dp, modifier: Modifier = Modifier) {
    val label = tier.uppercase()
    val metal = metalFor(label)
    if (metal == null) {
        Box(modifier.size(size), contentAlignment = Alignment.Center) {
            Text("–", fontFamily = Tm.MonoFont, fontWeight = FontWeight.Bold, color = Tm.Ink400, fontSize = 14.sp)
        }
        return
    }
    val rim = Color(0xFF0C0E13)
    Box(modifier.size(size), contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(size)) {
            val sx = this.size.width / 28f
            val sy = this.size.height / 28f
            fun p(x: Float, y: Float) = Offset(x * sx, y * sy)

            // Outer dark rim shield
            val outerShield = Path().apply {
                moveTo(7.5f * sx, 2.5f * sy)
                lineTo(20.5f * sx, 2.5f * sy)
                cubicTo(22.7f * sx, 2.5f * sy, 24.5f * sx, 4.3f * sy, 24.5f * sx, 6.5f * sy)
                lineTo(24.5f * sx, 16.5f * sy)
                lineTo(14f * sx, 24.2f * sy)
                lineTo(3.5f * sx, 16.5f * sy)
                lineTo(3.5f * sx, 6.5f * sy)
                cubicTo(3.5f * sx, 4.3f * sy, 5.3f * sx, 2.5f * sy, 7.5f * sx, 2.5f * sy)
                close()
            }
            drawPath(outerShield, color = rim)

            // Outer dark chevron
            val outerChevron = Path().apply {
                moveTo(3.8f * sx, 19.2f * sy)
                lineTo(14f * sx, 25.8f * sy)
                lineTo(24.2f * sx, 19.2f * sy)
                lineTo(24.2f * sx, 21.3f * sy)
                lineTo(14f * sx, 27.9f * sy)
                lineTo(3.8f * sx, 21.3f * sy)
                close()
            }
            drawPath(outerChevron, color = rim)

            // Metallic shield face
            val face = Path().apply {
                moveTo(8f * sx, 4.2f * sy)
                lineTo(20f * sx, 4.2f * sy)
                cubicTo(21.6f * sx, 4.2f * sy, 22.8f * sx, 5.4f * sy, 22.8f * sx, 7f * sy)
                lineTo(22.8f * sx, 16f * sy)
                lineTo(14f * sx, 22.3f * sy)
                lineTo(5.2f * sx, 16f * sy)
                lineTo(5.2f * sx, 7f * sy)
                cubicTo(5.2f * sx, 5.4f * sy, 6.4f * sx, 4.2f * sy, 8f * sx, 4.2f * sy)
                close()
            }
            drawPath(face, brush = Brush.verticalGradient(listOf(metal.light, metal.dark)))

            // Metallic chevron
            val chevron = Path().apply {
                moveTo(5.2f * sx, 19.8f * sy)
                lineTo(14f * sx, 25.4f * sy)
                lineTo(22.8f * sx, 19.8f * sy)
                lineTo(22.8f * sx, 20.9f * sy)
                lineTo(14f * sx, 26.5f * sy)
                lineTo(5.2f * sx, 20.9f * sy)
                close()
            }
            drawPath(chevron, color = metal.dark)

            // Top specular shine
            drawLine(
                color = metal.shine.copy(alpha = 0.85f),
                start = p(7.4f, 4.9f),
                end = p(20.6f, 4.9f),
                strokeWidth = 0.9f * sx,
                cap = StrokeCap.Round,
            )
        }
        Text(
            text = label.take(2),
            fontFamily = Tm.DisplayFont,
            fontWeight = FontWeight.ExtraBold,
            fontSize = (size.value * 0.42f).sp,
            color = rim,
            lineHeight = (size.value * 0.44f).sp,
        )
    }
}

/**
 * Crisp 2dp-stroke geometric icons matching the desktop rail's Tabler icon language,
 * replacing generic filled Material icons in the bottom navigation.
 */
object TmIcons {
    private fun icon(name: String, block: ImageVector.Builder.() -> Unit): ImageVector =
        ImageVector.Builder(
            name = name,
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply(block).build()

    private fun ImageVector.Builder.strokePath(d: androidx.compose.ui.graphics.vector.PathBuilder.() -> Unit) {
        path(
            stroke = SolidColor(Color.Black),
            strokeLineWidth = 1.9f,
            strokeLineCap = StrokeCap.Round,
            strokeLineJoin = StrokeJoin.Round,
            pathBuilder = d,
        )
    }

    val Home: ImageVector by lazy {
        icon("TmHome") {
            strokePath {
                moveTo(5f, 12f); lineTo(3f, 12f); lineTo(12f, 3f); lineTo(21f, 12f); lineTo(19f, 12f)
            }
            strokePath {
                moveTo(5f, 12f); lineTo(5f, 19f); curveTo(5f, 20.1f, 5.9f, 21f, 7f, 21f)
                lineTo(17f, 21f); curveTo(18.1f, 21f, 19f, 20.1f, 19f, 19f); lineTo(19f, 12f)
            }
            strokePath {
                moveTo(9f, 21f); lineTo(9f, 15f); curveTo(9f, 14.4f, 9.4f, 14f, 10f, 14f)
                lineTo(14f, 14f); curveTo(14.6f, 14f, 15f, 14.4f, 15f, 15f); lineTo(15f, 21f)
            }
        }
    }

    /** Crossed swords — Play / Lobby, matching `i-tabler-swords`. */
    val Play: ImageVector by lazy {
        icon("TmPlay") {
            strokePath {
                moveTo(21f, 3f); lineTo(16f, 3f); lineTo(6f, 13f); lineTo(11f, 18f); lineTo(21f, 8f); close()
            }
            strokePath {
                moveTo(5f, 12f); lineTo(12f, 19f)
            }
            strokePath {
                moveTo(7f, 17f); lineTo(4f, 20f)
            }
            strokePath {
                moveTo(3f, 3f); lineTo(8f, 3f); lineTo(12f, 7f)
            }
            strokePath {
                moveTo(17f, 17f); lineTo(20f, 20f)
            }
            strokePath {
                moveTo(19f, 12f); lineTo(14f, 17f)
            }
        }
    }

    /** Users group — Champion Select / Draft, matching `i-tabler-users-group`. */
    val Draft: ImageVector by lazy {
        icon("TmDraft") {
            strokePath {
                moveTo(9f, 7f); curveTo(9f, 5.3f, 10.3f, 4f, 12f, 4f); curveTo(13.7f, 4f, 15f, 5.3f, 15f, 7f)
                curveTo(15f, 8.7f, 13.7f, 10f, 12f, 10f); curveTo(10.3f, 10f, 9f, 8.7f, 9f, 7f)
            }
            strokePath {
                moveTo(6f, 20f); lineTo(6f, 18f); curveTo(6f, 15.8f, 7.8f, 14f, 10f, 14f)
                lineTo(14f, 14f); curveTo(16.2f, 14f, 18f, 15.8f, 18f, 18f); lineTo(18f, 20f)
            }
            strokePath {
                moveTo(17f, 9f); curveTo(18.1f, 9f, 19f, 8.1f, 19f, 7f); curveTo(19f, 5.9f, 18.1f, 5f, 17f, 5f)
            }
            strokePath {
                moveTo(21f, 19f); lineTo(21f, 17.5f); curveTo(21f, 16.1f, 20f, 15f, 18.8f, 14.7f)
            }
            strokePath {
                moveTo(7f, 9f); curveTo(5.9f, 9f, 5f, 8.1f, 5f, 7f); curveTo(5f, 5.9f, 5.9f, 5f, 7f, 5f)
            }
            strokePath {
                moveTo(3f, 19f); lineTo(3f, 17.5f); curveTo(3f, 16.1f, 4f, 15f, 5.2f, 14.7f)
            }
        }
    }

    /** Tactical crosshair — Live Game, matching `i-tabler-crosshair`. */
    val Game: ImageVector by lazy {
        icon("TmGame") {
            strokePath {
                moveTo(4f, 12f); curveTo(4f, 7.6f, 7.6f, 4f, 12f, 4f); curveTo(16.4f, 4f, 20f, 7.6f, 20f, 12f)
                curveTo(20f, 16.4f, 16.4f, 20f, 12f, 20f); curveTo(7.6f, 20f, 4f, 16.4f, 4f, 12f)
            }
            strokePath { moveTo(12f, 2f); lineTo(12f, 6f) }
            strokePath { moveTo(12f, 18f); lineTo(12f, 22f) }
            strokePath { moveTo(2f, 12f); lineTo(6f, 12f) }
            strokePath { moveTo(18f, 12f); lineTo(22f, 12f) }
        }
    }

    /** Tier & Builds chart — Builds, matching `i-tabler-chart-bar`. */
    val Builds: ImageVector by lazy {
        icon("TmBuilds") {
            strokePath {
                moveTo(3f, 20f); lineTo(21f, 20f)
            }
            strokePath {
                moveTo(5f, 20f); lineTo(5f, 13f); lineTo(9f, 13f); lineTo(9f, 20f)
            }
            strokePath {
                moveTo(10f, 20f); lineTo(10f, 8f); lineTo(14f, 8f); lineTo(14f, 20f)
            }
            strokePath {
                moveTo(15f, 20f); lineTo(15f, 4f); lineTo(19f, 4f); lineTo(19f, 20f)
            }
        }
    }
}
