package lol.truemain.mobile.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import lol.truemain.mobile.R
import lol.truemain.mobile.data.Art
import lol.truemain.mobile.data.GameData
import lol.truemain.mobile.data.Position
import lol.truemain.mobile.graph
import lol.truemain.mobile.ui.theme.Tm

/** The game data once loaded (null while Data Dragon is first read). */
@Composable
fun rememberGameData(): GameData? {
    val data by LocalContext.current.graph.staticData.data.collectAsState()
    return data
}

/** A remote image in a fixed square, the slot kept while it loads. */
@Composable
fun RemoteImage(
    url: String?,
    size: Dp,
    modifier: Modifier = Modifier,
    shape: Shape = RoundedCornerShape(6.dp),
    grayscale: Boolean = false,
    contentDescription: String? = null,
) {
    Box(modifier.size(size).clip(shape).background(Tm.Ink800)) {
        if (url != null) {
            AsyncImage(
                model = url,
                contentDescription = contentDescription,
                contentScale = ContentScale.Crop,
                colorFilter = if (grayscale) ColorFilter.colorMatrix(ColorMatrix().apply { setToSaturation(0f) }) else null,
                modifier = Modifier.fillMaxSize(),
            )
        }
    }
}

@Composable
fun ChampionIcon(
    championId: Int?,
    size: Dp,
    modifier: Modifier = Modifier,
    grayscale: Boolean = false,
    circle: Boolean = false,
    contentDescription: String? = null,
) {
    RemoteImage(Art.championIcon(championId), size, modifier, if (circle) CircleShape else RoundedCornerShape(size / 6), grayscale, contentDescription)
}

/** Official League client role icon (`TOP`, `JUNGLE`, `MIDDLE`, `BOTTOM`, `UTILITY`, `FILL`). */
@Composable
fun PositionIcon(
    position: String?,
    size: Dp = 18.dp,
    tint: Color = Tm.colors.primary,
    modifier: Modifier = Modifier,
) {
    val res = Position.iconOf(position) ?: return
    Image(
        painter = painterResource(res),
        contentDescription = null,
        colorFilter = ColorFilter.tint(tint),
        modifier = modifier.size(size),
    )
}

/**
 * A surface panel, matching the desktop's tone ladder (`main.css`):
 * - Dark: solid `pane` on `bg`, no outer box border — a whisper-faint top highlight lifts it.
 * - Light: white `pane` on `#eef1f6` with a subtle hairline border.
 */
@Composable
fun Panel(
    modifier: Modifier = Modifier,
    padding: Dp = 16.dp,
    elevated: Boolean = false,
    content: @Composable ColumnScope.() -> Unit,
) {
    val shape = RoundedCornerShape(12.dp)
    val light = Tm.colors.light
    val fill = if (elevated) Tm.colors.pane2 else Tm.colors.pane
    val borderColor = Tm.colors.border
    Column(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(fill)
            .then(
                if (light) {
                    Modifier.border(1.dp, borderColor.copy(alpha = 0.7f), shape)
                } else {
                    Modifier.drawBehind {
                        drawLine(
                            color = Color.White.copy(alpha = 0.045f),
                            start = Offset(0f, 0.5f),
                            end = Offset(size.width, 0.5f),
                            strokeWidth = 1f,
                        )
                    }
                },
            )
            .padding(padding),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        content = content,
    )
}

/**
 * Champion splash backdrop (`on-art` + `art-fade-x` / `art-fade-y` from desktop `main.css`):
 * always dark under its scrim so white text stays crisp in both dark and light themes.
 */
@Composable
fun SplashHero(
    splashUrl: String?,
    modifier: Modifier = Modifier,
    shape: Shape = RoundedCornerShape(12.dp),
    fadeHorizontal: Boolean = true,
    content: @Composable BoxScope.() -> Unit,
) {
    val darkBase = Color(0xFF0D1422)
    Box(modifier.fillMaxWidth().clip(shape).background(darkBase)) {
        if (splashUrl != null) {
            AsyncImage(
                model = splashUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                alignment = Alignment.TopCenter,
                modifier = Modifier.matchParentSize(),
            )
            Box(
                Modifier
                    .matchParentSize()
                    .background(
                        if (fadeHorizontal) {
                            Brush.horizontalGradient(
                                0f to darkBase.copy(alpha = 0.96f),
                                0.45f to darkBase.copy(alpha = 0.84f),
                                0.78f to darkBase.copy(alpha = 0.42f),
                                1f to darkBase.copy(alpha = 0.20f),
                            )
                        } else {
                            Brush.verticalGradient(
                                0f to darkBase.copy(alpha = 0.30f),
                                0.45f to darkBase.copy(alpha = 0.70f),
                                1f to darkBase.copy(alpha = 0.97f),
                            )
                        },
                    ),
            )
        }
        content()
    }
}

/** Desktop-style compact search well (`bg-muted` + hairline border, `rounded-lg`) with 48dp touch height and clear button. */
@Composable
fun TmSearchField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(8.dp)
    Row(
        modifier
            .fillMaxWidth()
            .height(48.dp)
            .clip(shape)
            .background(Tm.colors.bgMuted)
            .border(1.dp, Tm.colors.border, shape)
            .padding(start = 12.dp, end = if (value.isNotEmpty()) 4.dp else 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(Icons.Filled.Search, contentDescription = null, tint = Tm.Ink400, modifier = Modifier.size(18.dp))
        Box(Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
            if (value.isEmpty()) {
                Text(placeholder, style = MaterialTheme.typography.bodyMedium, color = Tm.Ink400)
            }
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                singleLine = true,
                textStyle = MaterialTheme.typography.bodyMedium.copy(color = Tm.Ink100),
                cursorBrush = SolidColor(Tm.colors.primary),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (value.isNotEmpty()) {
            IconButton(onClick = { onValueChange("") }, modifier = Modifier.size(40.dp)) {
                Icon(Icons.Filled.Close, contentDescription = stringResource(R.string.search_clear), tint = Tm.Ink400, modifier = Modifier.size(18.dp))
            }
        }
    }
}

/** Sentence-case section heading, matching desktop's `.stat-label`. */
@Composable
fun Eyebrow(text: String, modifier: Modifier = Modifier, color: Color = Tm.Ink300) {
    Text(text, modifier = modifier, style = MaterialTheme.typography.labelSmall, color = color)
}

@Composable
fun Chip(text: String, color: Color = Tm.Ink300, background: Color = Tm.Ink800, modifier: Modifier = Modifier) {
    // Nuxt UI's badge: a small rounded rectangle, not a pill.
    Text(
        text,
        modifier = modifier.clip(RoundedCornerShape(6.dp)).background(background).padding(horizontal = 8.dp, vertical = 3.dp),
        style = MaterialTheme.typography.labelMedium,
        color = color,
    )
}

@Composable
fun Loading(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = Tm.Rose400, strokeWidth = 2.dp, modifier = Modifier.size(28.dp))
    }
}

/** What a screen shows when it has nothing: a line of why, and maybe one action. */
@Composable
fun EmptyState(title: String, body: String? = null, modifier: Modifier = Modifier, action: Pair<String, () -> Unit>? = null) {
    Column(
        modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 48.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(title, style = MaterialTheme.typography.titleMedium, color = Tm.Ink100, textAlign = TextAlign.Center)
        if (body != null) Text(body, style = MaterialTheme.typography.bodyMedium, color = Tm.Ink400, textAlign = TextAlign.Center)
        if (action != null) TextButton(shape = Tm.ButtonShape, onClick = action.second) { Text(action.first, color = Tm.Rose400) }
    }
}

/** Label on the left, value on the right. */
@Composable
fun StatRow(label: String, value: String, valueColor: Color = Tm.Ink100) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = Tm.Ink400)
        Text(value, style = MaterialTheme.typography.bodyMedium, color = valueColor, fontWeight = FontWeight.Medium)
    }
}

/** `0.5234` → `52.3%`. */
fun percent(value: Double?, digits: Int = 1): String = value?.let { "%.${digits}f%%".format(it * 100) } ?: "—"
