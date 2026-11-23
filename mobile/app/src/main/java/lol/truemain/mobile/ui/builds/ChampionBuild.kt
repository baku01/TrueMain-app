package lol.truemain.mobile.ui.builds

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
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
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonElement
import lol.truemain.mobile.R
import lol.truemain.mobile.data.Art
import lol.truemain.mobile.data.GameData
import lol.truemain.mobile.data.Position
import lol.truemain.mobile.data.RuneImport
import lol.truemain.mobile.data.importRunes
import lol.truemain.mobile.data.ownedPageName
import lol.truemain.mobile.data.runeDraftOf
import lol.truemain.mobile.graph
import lol.truemain.mobile.lcu.bool
import lol.truemain.mobile.lcu.double
import lol.truemain.mobile.lcu.get
import lol.truemain.mobile.lcu.int
import lol.truemain.mobile.lcu.list
import lol.truemain.mobile.lcu.str
import lol.truemain.mobile.link.LinkState
import lol.truemain.mobile.session.Session
import lol.truemain.mobile.ui.components.ChampionIcon
import lol.truemain.mobile.ui.components.EmptyState
import lol.truemain.mobile.ui.components.Eyebrow
import lol.truemain.mobile.ui.components.Loading
import lol.truemain.mobile.ui.components.Panel
import lol.truemain.mobile.ui.components.RemoteImage
import lol.truemain.mobile.ui.components.SplashHero
import lol.truemain.mobile.ui.components.percent
import lol.truemain.mobile.ui.components.rememberGameData
import lol.truemain.mobile.ui.theme.Tm

/** A champion's builds on a lane (`GET /champions/{id}`), the lane switchable in place. */
@Composable
internal fun ChampionBuildScreen(championId: Int, position: String?, onPosition: (String?) -> Unit, onBack: () -> Unit) {
    val api = LocalContext.current.graph.api
    val data = rememberGameData()
    var answer by remember(championId, position) { mutableStateOf<JsonElement?>(null) }
    var failed by remember(championId, position) { mutableStateOf(false) }
    var attempt by remember { mutableIntStateOf(0) }

    LaunchedEffect(championId, position, attempt) {
        failed = false
        answer = try {
            api.championBuild(championId, position)
        } catch (cancel: CancellationException) {
            throw cancel
        } catch (_: Exception) {
            failed = true
            null
        }
    }

    Column(Modifier.fillMaxSize()) {
        // Champion splash hero matching desktop's `ChampionHero` (`on-art` + `art-fade-y`)
        SplashHero(
            splashUrl = data?.championSplash(championId),
            shape = RoundedCornerShape(0.dp),
            fadeHorizontal = false,
            modifier = Modifier.height(142.dp),
        ) {
            IconButton(
                onClick = onBack,
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(10.dp)
                    .size(36.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color(0xFF080C14).copy(alpha = 0.65f)),
            ) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.builds_back), tint = Color.White, modifier = Modifier.size(18.dp))
            }
            Row(
                Modifier
                    .align(Alignment.BottomStart)
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Box(Modifier.border(1.5.dp, Tm.Gold.copy(alpha = 0.75f), RoundedCornerShape(10.dp)).padding(2.dp)) {
                    ChampionIcon(championId, 48.dp)
                }
                Column(Modifier.weight(1f)) {
                    Text(
                        data?.championName(championId).orEmpty(),
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    data?.champion(championId)?.title?.takeIf { it.isNotEmpty() }?.let {
                        Text(it, style = MaterialTheme.typography.bodySmall, color = Color(0xFFAEB9CC), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }
        LaneChips(Position.of(position), { onPosition(it?.api) }, Modifier.padding(horizontal = 16.dp, vertical = 4.dp), allowAll = false)
        val loaded = answer
        when {
            loaded != null -> BuildBody(loaded, championId, data)
            failed -> EmptyState(
                stringResource(R.string.builds_error),
                stringResource(R.string.builds_error_body),
                action = stringResource(R.string.builds_retry) to { attempt++ },
            )
            else -> Loading()
        }
    }
}

@Composable
private fun BuildBody(answer: JsonElement, championId: Int, data: GameData?) {
    val builds = answer.list("builds")
    var selected by rememberSaveable(answer) { mutableIntStateOf(0) }
    val build = builds.getOrNull(selected) ?: builds.firstOrNull()
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Overview(answer)
        if (build == null) {
            EmptyState(stringResource(R.string.builds_no_data), stringResource(R.string.builds_no_data_body))
            return@Column
        }
        if (builds.size > 1) {
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                builds.forEachIndexed { index, option -> BuildTab(option, index == selected, data) { selected = index } }
            }
        }
        Panel {
            Eyebrow(stringResource(R.string.builds_this_build))
            BlockStats(build)
        }
        val core = build["core"]
        Panel {
            Eyebrow(stringResource(R.string.builds_runes))
            RunePageView(core["runePage"], data)
            BlockStats(core["runePage"])
            ApplyRunes(core["runePage"], data?.championName(championId).orEmpty())
        }
        Panel {
            Eyebrow(stringResource(R.string.builds_spells))
            SpellsLine(core["summonerSpells"], data)
            BlockStats(core["summonerSpells"])
            alternatives(build, "summonerSpells", core["summonerSpells"]).forEach { alternative ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    SpellsLine(alternative, data)
                    BlockStats(alternative)
                }
            }
        }
        Panel {
            Eyebrow(stringResource(R.string.builds_starter))
            ItemsLine(itemIdsOf(core["starterItems"]), data)
            BlockStats(core["starterItems"])
            Eyebrow(stringResource(R.string.builds_boots))
            ItemsLine(itemIdsOf(core["boots"]), data)
            BlockStats(core["boots"])
            alternatives(build, "boots", core["boots"]).forEach { alternative ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    ItemsLine(itemIdsOf(alternative), data, size = 28.dp)
                    BlockStats(alternative)
                }
            }
            Eyebrow(stringResource(R.string.builds_core))
            ItemsLine(itemIdsOf(core["itemPath"]), data, path = true, size = 40.dp)
            BlockStats(core["itemPath"])
        }
        if (core["skillOrder"].list("sequence").isNotEmpty()) {
            Panel {
                Eyebrow(stringResource(R.string.builds_skills))
                SkillOrder(core["skillOrder"])
                BlockStats(core["skillOrder"])
            }
        }
    }
}

/** 3-column headline stat tiles matching desktop's champion header strip. */
@Composable
private fun Overview(answer: JsonElement) {
    val games = answer.int("totalGames")
    val wins = answer.int("totalWins")
    val winRate = if (games != null && wins != null && games > 0) wins.toDouble() / games else null
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            winRate?.let {
                StatTile(stringResource(R.string.builds_win), percent(it), winRateColor(it), Modifier.weight(1f))
            }
            games?.let {
                StatTile(stringResource(R.string.builds_total_games), it.toString(), Tm.Ink100, Modifier.weight(1f))
            }
            answer.str("patch")?.let {
                StatTile(stringResource(R.string.builds_patch_label), it, Tm.Ink100, Modifier.weight(1f))
            }
        }
        if (answer.bool("minSampleMet") == false) {
            Text(stringResource(R.string.builds_small_sample), color = Tm.Gold, style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun StatTile(label: String, value: String, valueColor: Color, modifier: Modifier) {
    Panel(modifier, padding = 12.dp) {
        Text(
            value,
            fontFamily = Tm.DisplayFont,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = valueColor,
            maxLines = 1,
        )
        Text(label, style = MaterialTheme.typography.labelMedium, color = Tm.Ink400, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/** A build as its tab shows it: keystone, first item, how often it is played. */
@Composable
private fun BuildTab(build: JsonElement, selected: Boolean, data: GameData?, onClick: () -> Unit) {
    val shape = RoundedCornerShape(10.dp)
    Row(
        Modifier
            .clip(shape)
            .background(if (selected) Tm.Rose950 else Tm.colors.pane)
            .border(1.dp, if (selected) Tm.Rose500 else Tm.colors.border.copy(alpha = if (Tm.colors.light) 0.7f else 0.4f), shape)
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        RemoteImage(data?.perkIcon(build.int("primaryKeystoneId")), 26.dp, shape = CircleShape)
        RemoteImage(data?.itemIcon(build.int("firstItemId")), 26.dp)
        Column {
            Text(percent(build.double("pickRate")), color = if (selected) Tm.Rose300 else Tm.Ink100, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
            Text(stringResource(R.string.builds_pick), color = Tm.Ink400, style = MaterialTheme.typography.labelMedium)
        }
    }
}

/**
 * Pushes the page to the client through the desktop, which reuses TrueMain's
 * own page rather than overwriting one of the player's.
 */
@Composable
private fun ApplyRunes(runePage: JsonElement?, championName: String) {
    val graph = LocalContext.current.graph
    val link by graph.link.state.collectAsState()
    val appState by graph.session.state(Session.APP_STATE).collectAsState()
    val open = link is LinkState.Open
    val clientRunning = appState.bool("connected") == true
    val draft = remember(runePage, championName) { runeDraftOf(runePage, ownedPageName(championName)) }
    var busy by remember(runePage) { mutableStateOf(false) }
    var result by remember(runePage) { mutableStateOf<RuneImport?>(null) }
    val scope = rememberCoroutineScope()

    if (draft == null || !draft.complete) return
    Button(
        shape = Tm.ButtonShape,
        onClick = {
            scope.launch {
                busy = true
                result = graph.session.importRunes(draft)
                busy = false
            }
        },
        enabled = open && clientRunning && !busy,
        modifier = Modifier.fillMaxWidth().height(46.dp),
        colors = ButtonDefaults.buttonColors(containerColor = Tm.Rose400, contentColor = Tm.colors.textInverted),
    ) {
        Text(stringResource(if (busy) R.string.builds_runes_applying else R.string.builds_runes_apply), fontWeight = FontWeight.SemiBold)
    }
    val (message, color) = when {
        !open -> stringResource(R.string.builds_runes_need_link) to Tm.Ink400
        !clientRunning -> stringResource(R.string.link_no_client) to Tm.Gold
        result == RuneImport.Done -> stringResource(R.string.builds_runes_done) to Tm.Success
        result == RuneImport.NoSlot -> stringResource(R.string.builds_runes_no_slot) to Tm.Gold
        result == RuneImport.Failed -> stringResource(R.string.builds_runes_failed) to Tm.Red
        else -> null to Tm.Ink400
    }
    message?.let { Text(it, color = color, style = MaterialTheme.typography.bodySmall) }
}
