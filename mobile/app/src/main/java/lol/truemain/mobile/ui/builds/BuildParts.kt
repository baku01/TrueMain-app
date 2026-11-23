package lol.truemain.mobile.ui.builds

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.serialization.json.JsonElement
import lol.truemain.mobile.R
import lol.truemain.mobile.data.GameData
import lol.truemain.mobile.lcu.double
import lol.truemain.mobile.lcu.get
import lol.truemain.mobile.lcu.int
import lol.truemain.mobile.lcu.list
import lol.truemain.mobile.lcu.string
import lol.truemain.mobile.ui.components.RemoteImage
import lol.truemain.mobile.ui.components.percent
import lol.truemain.mobile.ui.theme.Tm

/** Above, around or below an even game: a point either side of 50% reads as even. */
@Composable
internal fun winRateColor(winRate: Double?): Color = when {
    winRate == null -> Tm.Ink400
    winRate >= 0.51 -> Tm.Good
    winRate <= 0.49 -> Tm.Bad
    else -> Tm.Mid
}

/** A rate over its label, as the site's tables print them. */
@Composable
internal fun Rate(value: Double?, label: String, color: Color = Tm.Ink200, width: Dp = 46.dp) {
    Column(Modifier.width(width), horizontalAlignment = Alignment.End) {
        Text(percent(value), color = color, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium, maxLines = 1)
        Text(label, color = Tm.Ink500, style = MaterialTheme.typography.labelSmall, maxLines = 1)
    }
}

/** A block's win rate, pick rate and games; wraps cleanly onto a second line when beside icons. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun BlockStats(block: JsonElement?, modifier: Modifier = Modifier) {
    val winRate = block.double("winRate")
    FlowRow(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(
            stringResource(R.string.builds_win_rate, percent(winRate)),
            color = winRateColor(winRate),
            style = MaterialTheme.typography.labelMedium,
            maxLines = 1,
            softWrap = false,
        )
        block.double("pickRate")?.let {
            Text(
                stringResource(R.string.builds_pick_rate, percent(it)),
                color = Tm.Ink400,
                style = MaterialTheme.typography.labelMedium,
                maxLines = 1,
                softWrap = false,
            )
        }
        block.int("games")?.let {
            Text(
                stringResource(R.string.builds_games, it),
                color = Tm.Ink500,
                style = MaterialTheme.typography.labelMedium,
                maxLines = 1,
                softWrap = false,
            )
        }
    }
}

/** Items in buying order, gold-framed with arrows between each when [path]. */
@Composable
internal fun ItemsLine(itemIds: List<Int>, data: GameData?, path: Boolean = false, size: Dp = 36.dp) {
    Row(Modifier.horizontalScroll(rememberScrollState()), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        itemIds.forEachIndexed { index, id ->
            if (path && index > 0) Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = Tm.Gold.copy(alpha = 0.7f), modifier = Modifier.size(16.dp))
            Box(
                if (path) {
                    Modifier.border(1.dp, Tm.Gold.copy(alpha = 0.55f), RoundedCornerShape(7.dp)).padding(1.5.dp)
                } else {
                    Modifier
                },
            ) {
                RemoteImage(data?.itemIcon(id), size, contentDescription = data?.items?.get(id)?.name)
            }
        }
    }
}

internal fun itemIdsOf(block: JsonElement?): List<Int> = block.list("itemIds").mapNotNull { it.int }

@Composable
internal fun SpellsLine(spells: JsonElement?, data: GameData?) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        listOf(spells.int("spell1Id"), spells.int("spell2Id")).forEach { id ->
            RemoteImage(data?.spellIcon(id), 36.dp, contentDescription = id?.let { data?.spells?.get(it)?.name })
        }
    }
}

private fun skillColor(key: String): Color = when (key.uppercase()) {
    "Q" -> Color(0xFF38BDF8) // Sky blue
    "W" -> Color(0xFF34D399) // Emerald
    "E" -> Color(0xFFFBBF24) // Amber
    "R" -> Color(0xFFF472B6) // Rose
    else -> Color(0xFF52A8FF)
}

/**
 * The skill order: the max order (`Q > W > E`) with Lexu-style colour-coded keys,
 * and the 4x18 level-by-level matrix when the sequence is full.
 */
@Composable
internal fun SkillOrder(skillOrder: JsonElement?) {
    val sequence = skillOrder.list("sequence").mapNotNull { it.string?.uppercase() }
    if (sequence.isEmpty()) return
    // From a full sequence, the ability maxed first is the one whose fifth point comes first.
    val maxOrder = if (sequence.size > 4) {
        listOf("Q", "W", "E").filter { it in sequence }.sortedBy { key ->
            sequence.withIndex().filter { it.value == key }.getOrNull(4)?.index ?: Int.MAX_VALUE
        }
    } else {
        sequence
    }
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        maxOrder.forEachIndexed { index, key ->
            if (index > 0) Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = Tm.Ink500, modifier = Modifier.size(16.dp))
            KeyBadge(key, skillColor(key))
        }
    }
    if (sequence.size > 4) SkillGrid(sequence.take(18))
}

@Composable
private fun KeyBadge(key: String, accent: Color) {
    Box(
        Modifier
            .size(32.dp)
            .background(accent.copy(alpha = 0.18f), RoundedCornerShape(8.dp))
            .border(1.dp, accent.copy(alpha = 0.65f), RoundedCornerShape(8.dp)),
        contentAlignment = Alignment.Center,
    ) {
        Text(key, fontFamily = Tm.DisplayFont, color = accent, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun SkillGrid(sequence: List<String>) {
    Column(Modifier.horizontalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(3.dp)) {
        listOf("Q", "W", "E", "R").forEach { key ->
            val accent = skillColor(key)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(key, Modifier.width(16.dp), color = accent, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                sequence.forEachIndexed { level, taken ->
                    val here = taken == key
                    Box(
                        Modifier
                            .size(17.dp)
                            .background(if (here) accent.copy(alpha = 0.24f) else Tm.Ink800, RoundedCornerShape(4.dp))
                            .then(if (here) Modifier.border(1.dp, accent.copy(alpha = 0.7f), RoundedCornerShape(4.dp)) else Modifier),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (here) {
                            Text(
                                (level + 1).toString(),
                                fontSize = 9.sp,
                                lineHeight = 10.sp,
                                color = accent,
                                fontWeight = FontWeight.Bold,
                                textAlign = TextAlign.Center,
                            )
                        }
                    }
                }
            }
        }
    }
}

/** The rune page: both trees with their icons, the shards, the keystone named. */
@Composable
internal fun RunePageView(page: JsonElement?, data: GameData?) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            RemoteImage(data?.styleIcon(page.int("primaryStyleId")), 24.dp, shape = CircleShape)
            RemoteImage(data?.perkIcon(page.int("primaryKeystoneId")), 48.dp, shape = CircleShape)
            listOf("primaryPerk1Id", "primaryPerk2Id", "primaryPerk3Id").forEach { Perk(page.int(it), data, 32.dp) }
        }
        page.int("primaryKeystoneId")?.let { id -> data?.perks?.get(id)?.name }?.let {
            Text(it, color = Tm.Rose300, style = MaterialTheme.typography.titleSmall)
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            RemoteImage(data?.styleIcon(page.int("secondaryStyleId")), 24.dp, shape = CircleShape)
            listOf("secondaryPerk1Id", "secondaryPerk2Id").forEach { Perk(page.int(it), data, 32.dp) }
            Box(Modifier.width(8.dp))
            listOf("statOffense", "statFlex", "statDefense").forEach { Perk(page.int(it), data, 22.dp) }
        }
    }
}

@Composable
private fun Perk(id: Int?, data: GameData?, size: Dp) {
    RemoteImage(data?.perkIcon(id), size, shape = CircleShape, contentDescription = id?.let { data?.perks?.get(it)?.name })
}

/** The alternatives a build's [key] variation lists beyond the one it shows. */
internal fun alternatives(build: JsonElement?, key: String, shown: JsonElement?): List<JsonElement> =
    build["variations"].list(key).filter { it != shown }.take(2)
