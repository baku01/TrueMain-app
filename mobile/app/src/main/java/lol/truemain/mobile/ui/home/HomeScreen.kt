package lol.truemain.mobile.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.serialization.json.JsonElement
import lol.truemain.mobile.R
import lol.truemain.mobile.data.Art
import lol.truemain.mobile.graph
import lol.truemain.mobile.lcu.bool
import lol.truemain.mobile.lcu.get
import lol.truemain.mobile.lcu.int
import lol.truemain.mobile.lcu.str
import lol.truemain.mobile.link.LinkState
import lol.truemain.mobile.ui.builds.winRateColor
import lol.truemain.mobile.ui.components.Eyebrow
import lol.truemain.mobile.ui.components.Panel
import lol.truemain.mobile.ui.components.RemoteImage
import lol.truemain.mobile.ui.components.SplashHero
import lol.truemain.mobile.ui.components.percent
import lol.truemain.mobile.ui.components.rememberGameData
import lol.truemain.mobile.ui.history.HistorySection
import lol.truemain.mobile.ui.phaseLabel
import lol.truemain.mobile.ui.theme.Tm

/** Who is playing, where, and their ranks; the recent games under it. */
@Composable
fun HomeScreen() {
    val graph = LocalContext.current.graph
    val link by graph.link.state.collectAsState()
    val phase by graph.session.phase.collectAsState()
    val appState by graph.session.state(lol.truemain.mobile.session.Session.APP_STATE).collectAsState()
    val data = rememberGameData()
    var summoner by remember { mutableStateOf<JsonElement?>(null) }
    var ranked by remember { mutableStateOf<JsonElement?>(null) }
    var leadChampion by remember { mutableStateOf<Int?>(null) }
    val connected = appState.bool("connected") == true
    val riotId = appState.str("riotId")

    LaunchedEffect(link is LinkState.Open, connected, riotId, phase) {
        if (link !is LinkState.Open || !connected) {
            summoner = null
            ranked = null
            return@LaunchedEffect
        }
        summoner = runCatching { graph.session.get("/lol-summoner/v1/current-summoner") }.getOrNull()?.takeIf { it.ok }?.body
        ranked = runCatching { graph.session.get("/lol-ranked/v1/current-ranked-stats") }.getOrNull()?.takeIf { it.ok }?.body
    }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        if (link is LinkState.Open && !connected) {
            Panel { Text(stringResource(R.string.link_no_client), color = Tm.Gold) }
        } else if (summoner.str("gameName").isNullOrEmpty()) {
            Panel { Text(stringResource(R.string.home_not_logged), color = Tm.Ink300) }
        } else {
            val splashId = leadChampion ?: 103
            SplashHero(
                splashUrl = data?.championSplash(splashId),
                fadeHorizontal = true,
            ) {
                Row(
                    Modifier.fillMaxWidth().padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    Box(contentAlignment = Alignment.BottomCenter) {
                        RemoteImage(
                            data?.profileIcon(summoner.int("profileIconId")),
                            62.dp,
                            shape = CircleShape,
                            modifier = Modifier.border(2.dp, Tm.colors.primary, CircleShape),
                        )
                        val level = summoner.int("summonerLevel") ?: 0
                        if (level > 0) {
                            Text(
                                level.toString(),
                                modifier = Modifier
                                    .offset(y = 6.dp)
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(Color(0xFF080C14))
                                    .border(1.dp, Color(0xFF2D3A4F), RoundedCornerShape(6.dp))
                                    .padding(horizontal = 6.dp, vertical = 1.dp),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Color(0xFFE8EEF9),
                            )
                        }
                    }
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            "${summoner.str("gameName")}#${summoner.str("tagLine").orEmpty()}",
                            style = MaterialTheme.typography.titleLarge,
                            color = Color.White,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Row(
                                Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(Color(0xFF080C14).copy(alpha = 0.72f))
                                    .border(1.dp, Tm.colors.primary.copy(alpha = 0.35f), RoundedCornerShape(6.dp))
                                    .padding(horizontal = 8.dp, vertical = 3.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(5.dp),
                            ) {
                                Box(Modifier.size(6.dp).background(Tm.colors.primary, CircleShape))
                                Text(phaseLabel(phase), style = MaterialTheme.typography.labelMedium, color = Color(0xFFD9EDFF))
                            }
                        }
                    }
                }
            }
        }

        if (ranked != null) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                RankCard(stringResource(R.string.home_solo), ranked["queueMap"]["RANKED_SOLO_5x5"], Modifier.weight(1f))
                RankCard(stringResource(R.string.home_flex), ranked["queueMap"]["RANKED_FLEX_SR"], Modifier.weight(1f))
            }
        }

        HistorySection(onLeadChampion = { leadChampion = it })
    }
}

@Composable
private fun RankCard(title: String, queue: JsonElement?, modifier: Modifier) {
    val tier = queue.str("tier")?.takeIf { it.isNotEmpty() && it != "NONE" }
    val apex = tier in setOf("MASTER", "GRANDMASTER", "CHALLENGER")
    val accent = when {
        tier == null -> Tm.colors.border
        apex -> Tm.Gold
        else -> Tm.colors.primary
    }
    Panel(modifier, padding = 14.dp) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Box(Modifier.size(width = 3.dp, height = 13.dp).clip(RoundedCornerShape(2.dp)).background(accent))
            Eyebrow(title)
        }
        if (tier == null) {
            Text(stringResource(R.string.home_unranked), color = Tm.Ink400, style = MaterialTheme.typography.bodyMedium)
        } else {
            val division = queue.str("division")?.takeIf { it != "NA" }.orEmpty()
            val wins = queue.int("wins") ?: 0
            val losses = queue.int("losses") ?: 0
            val total = wins + losses
            val wr = if (total > 0) wins.toDouble() / total else null
            Text(
                "${tier.lowercase().replaceFirstChar(Char::uppercase)} $division".trim(),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = if (apex) Tm.Gold else Tm.Rose300,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                stringResource(R.string.home_lp, queue.int("leaguePoints") ?: 0),
                fontFamily = Tm.DisplayFont,
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = Tm.Ink100,
            )
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    stringResource(R.string.home_record, wins, losses),
                    color = Tm.Ink400,
                    style = MaterialTheme.typography.bodySmall,
                )
                if (wr != null) {
                    Text(
                        percent(wr, 0),
                        color = winRateColor(wr),
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }
    }
}
