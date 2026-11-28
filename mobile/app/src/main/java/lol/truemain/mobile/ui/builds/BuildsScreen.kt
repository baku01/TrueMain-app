package lol.truemain.mobile.ui.builds

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.JsonElement
import lol.truemain.mobile.R
import lol.truemain.mobile.data.GameData
import lol.truemain.mobile.data.Position
import lol.truemain.mobile.graph
import lol.truemain.mobile.lcu.double
import lol.truemain.mobile.lcu.int
import lol.truemain.mobile.lcu.list
import lol.truemain.mobile.lcu.str
import lol.truemain.mobile.ui.components.ChampionIcon
import lol.truemain.mobile.ui.components.Chip
import lol.truemain.mobile.ui.components.EmptyState
import lol.truemain.mobile.ui.components.Loading
import lol.truemain.mobile.ui.components.PositionIcon
import lol.truemain.mobile.ui.components.TmSearchField
import lol.truemain.mobile.ui.components.TmTierBadge
import lol.truemain.mobile.ui.components.rememberGameData
import lol.truemain.mobile.ui.draft.fold
import lol.truemain.mobile.ui.theme.Tm

/** One champion on one lane in the tier list. */
internal data class TierEntry(
    val tier: String,
    val championId: Int,
    val position: String?,
    val games: Int,
    val winRate: Double?,
    val pickRate: Double?,
    val banRate: Double?,
)

private fun entriesOf(tierList: JsonElement): List<TierEntry> = tierList.list("tiers").flatMap { tier ->
    val name = tier.str("tier").orEmpty()
    tier.list("entries").mapNotNull { entry ->
        TierEntry(
            tier = name,
            championId = entry.int("championId") ?: return@mapNotNull null,
            position = entry.str("position"),
            games = entry.int("games") ?: 0,
            winRate = entry.double("winRate"),
            pickRate = entry.double("pickRate"),
            banRate = entry.double("banRate"),
        )
    }
}

/**
 * TrueMain's tier list and builds, read from the site over the phone's own
 * internet — the desktop is needed only to push a rune page to the client.
 */
@Composable
fun BuildsScreen(
    externalTarget: Pair<Int, String?>? = null,
    onExternalConsumed: () -> Unit = {},
) {
    var championId by rememberSaveable { mutableIntStateOf(0) }
    var championPosition by rememberSaveable { mutableStateOf<String?>(null) }
    var lane by rememberSaveable { mutableStateOf<Position?>(null) }
    var query by rememberSaveable { mutableStateOf("") }

    LaunchedEffect(externalTarget) {
        if (externalTarget != null) {
            championId = externalTarget.first
            championPosition = externalTarget.second
            onExternalConsumed()
        }
    }

    if (championId > 0) {
        BackHandler { championId = 0 }
        ChampionBuildScreen(championId, championPosition, onPosition = { championPosition = it }, onBack = { championId = 0 })
    } else {
        TierListScreen(lane, { lane = it }, query, { query = it }) { entry ->
            championPosition = entry.position ?: lane?.api
            championId = entry.championId
        }
    }
}

private sealed interface Load {
    data object Loading : Load
    data object Failed : Load
    data class Ready(val patch: String?, val entries: List<TierEntry>) : Load
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TierListScreen(
    lane: Position?,
    onLane: (Position?) -> Unit,
    query: String,
    onQuery: (String) -> Unit,
    onOpen: (TierEntry) -> Unit,
) {
    val api = LocalContext.current.graph.api
    val data = rememberGameData()
    // Each lane's list kept for the screen's life: switching back is instant.
    val loaded = remember { mutableStateMapOf<Position?, Load>() }
    var attempt by remember { mutableIntStateOf(0) }
    var refreshing by remember { mutableStateOf(false) }

    LaunchedEffect(lane, attempt) {
        val force = refreshing
        if (!force && loaded[lane] is Load.Ready) return@LaunchedEffect
        if (!force) loaded[lane] = Load.Loading
        val next = try {
            val answer = api.tierList(lane?.api, forceRefresh = force)
            Load.Ready(answer.str("patchVersion"), entriesOf(answer))
        } catch (cancel: CancellationException) {
            throw cancel
        } catch (_: Exception) {
            if (loaded[lane] is Load.Ready) loaded[lane]!! else Load.Failed
        }
        loaded[lane] = next
        refreshing = false
    }

    Column(Modifier.fillMaxSize()) {
        TmSearchField(
            value = query,
            onValueChange = onQuery,
            placeholder = stringResource(R.string.builds_search),
            modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 6.dp),
        )
        LaneChips(lane, onLane, Modifier.padding(horizontal = 16.dp))

        when (val state = loaded[lane] ?: Load.Loading) {
            Load.Loading -> Loading()
            Load.Failed -> EmptyState(
                stringResource(R.string.builds_error),
                stringResource(R.string.builds_error_body),
                action = stringResource(R.string.builds_retry) to { attempt++ },
            )
            is Load.Ready -> {
                val needle = query.fold()
                val shown = state.entries.filter { entry ->
                    needle.isEmpty() || data?.champion(entry.championId)?.let { it.name.fold().contains(needle) || it.alias.fold().contains(needle) } == true
                }
                PullToRefreshBox(
                    isRefreshing = refreshing,
                    onRefresh = {
                        refreshing = true
                        loaded.clear()
                        attempt++
                    },
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                ) {
                    if (shown.isEmpty()) {
                        EmptyState(stringResource(if (needle.isEmpty()) R.string.builds_empty else R.string.builds_no_match))
                    } else {
                        LazyColumn(
                            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 16.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            item {
                                Row(
                                    Modifier.fillMaxWidth().padding(top = 6.dp, bottom = 2.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                ) {
                                    state.patch?.let { patch ->
                                        Text(
                                            stringResource(R.string.builds_patch, patch),
                                            color = Tm.Ink400,
                                            style = MaterialTheme.typography.labelMedium,
                                        )
                                    }
                                    Chip(stringResource(R.string.builds_elo_badge), color = Tm.colors.primary, background = Tm.colors.primary.copy(alpha = 0.14f))
                                }
                            }
                            items(shown, key = { "${it.championId}-${it.position}" }) { entry ->
                                TierRow(entry, data, showLane = lane == null) { onOpen(entry) }
                            }
                        }
                    }
                }
            }
        }
    }
}

/** "Every lane", then the five lanes with official client role icons. */
@Composable
internal fun LaneChips(selected: Position?, onSelect: (Position?) -> Unit, modifier: Modifier = Modifier, allowAll: Boolean = true) {
    Row(modifier.horizontalScroll(rememberScrollState()).padding(vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        if (allowAll) SelectChip(stringResource(R.string.builds_all_lanes), selected == null) { onSelect(null) }
        Position.entries.forEach { position ->
            SelectChip(
                text = stringResource(position.label),
                selected = selected == position,
                roleIcon = position.api,
                onClick = { onSelect(position) },
            )
        }
    }
}

@Composable
internal fun SelectChip(text: String, selected: Boolean, roleIcon: String? = null, onClick: () -> Unit) {
    val shape = RoundedCornerShape(6.dp)
    Row(
        Modifier
            .heightIn(min = 42.dp)
            .clip(shape)
            .background(if (selected) Tm.Rose950 else Tm.colors.pane)
            .then(
                if (selected) Modifier.border(1.dp, Tm.colors.primary.copy(alpha = 0.55f), shape)
                else if (Tm.colors.light) Modifier.border(1.dp, Tm.colors.border.copy(alpha = 0.7f), shape)
                else Modifier.border(1.dp, Tm.colors.border.copy(alpha = 0.35f), shape),
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        if (roleIcon != null) {
            PositionIcon(roleIcon, size = 14.dp, tint = if (selected) Tm.Rose300 else Tm.Ink400)
        }
        Text(
            text,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
            color = if (selected) Tm.Rose300 else Tm.Ink300,
        )
    }
}

/** The tier letter's colour: the theme's own tier tokens (`--color-tier-*`), as the desktop's tier list. */
@Composable
internal fun tierColor(tier: String) = when (tier.uppercase()) {
    "S", "S+" -> Tm.colors.tierS
    "A" -> Tm.colors.tierA
    "B" -> Tm.colors.tierB
    "C" -> Tm.colors.tierC
    else -> Tm.colors.tierD
}

@Composable
private fun TierRow(entry: TierEntry, data: GameData?, showLane: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(10.dp)
    Row(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Tm.colors.pane)
            .then(if (Tm.colors.light) Modifier.border(1.dp, Tm.colors.border.copy(alpha = 0.7f), shape) else Modifier)
            .clickable(onClick = onClick)
            .padding(vertical = 9.dp, horizontal = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        TmTierBadge(entry.tier, size = 26.dp)
        val lane = Position.of(entry.position)
        Box {
            ChampionIcon(entry.championId, 38.dp)
            if (showLane && lane != null) {
                Box(
                    Modifier
                        .align(Alignment.BottomEnd)
                        .offset(x = 3.dp, y = 3.dp)
                        .size(16.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(Tm.colors.bg)
                        .border(1.dp, Tm.colors.border, RoundedCornerShape(4.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    PositionIcon(lane.api, size = 11.dp, tint = Tm.colors.primary)
                }
            }
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(
                data?.championName(entry.championId).orEmpty(),
                color = Tm.Ink100,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            val games = stringResource(R.string.builds_games, entry.games)
            Text(
                if (showLane && lane != null) stringResource(lane.label) + " · " + games else games,
                color = Tm.Ink400,
                style = MaterialTheme.typography.labelMedium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Rate(entry.winRate, stringResource(R.string.builds_win), winRateColor(entry.winRate))
        Rate(entry.pickRate, stringResource(R.string.builds_pick))
        Rate(entry.banRate, stringResource(R.string.builds_ban))
    }
}
