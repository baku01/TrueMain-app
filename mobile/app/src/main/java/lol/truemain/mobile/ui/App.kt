package lol.truemain.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import lol.truemain.mobile.R
import lol.truemain.mobile.graph
import lol.truemain.mobile.link.LinkState
import lol.truemain.mobile.ui.builds.BuildsScreen
import lol.truemain.mobile.ui.components.TmIcons
import lol.truemain.mobile.ui.components.TmWordmark
import lol.truemain.mobile.ui.connect.ConnectScreen
import lol.truemain.mobile.ui.draft.DraftScreen
import lol.truemain.mobile.ui.game.GameScreen
import lol.truemain.mobile.ui.home.HomeScreen
import lol.truemain.mobile.ui.play.PlayScreen
import lol.truemain.mobile.ui.theme.Tm

enum class Tab(val label: Int, val icon: ImageVector) {
    Home(R.string.tab_home, TmIcons.Home),
    Play(R.string.tab_play, TmIcons.Play),
    Draft(R.string.tab_draft, TmIcons.Draft),
    Game(R.string.tab_game, TmIcons.Game),
    Builds(R.string.tab_builds, TmIcons.Builds),
}

/** The tab a phase calls for: the phone follows the client the way its window does. */
fun tabFor(phase: String): Tab? = when (phase) {
    "Lobby", "Matchmaking", "ReadyCheck" -> Tab.Play
    "ChampSelect" -> Tab.Draft
    "InProgress", "Reconnect" -> Tab.Game
    else -> null
}

@Composable
fun TrueMainRoot() {
    val graph = LocalContext.current.graph
    val state by graph.link.state.collectAsState()
    val paired by graph.link.paired.collectAsState()
    when {
        !paired || state is LinkState.NotPaired || state is LinkState.Revoked -> ConnectScreen(state)
        else -> Main(state)
    }
}

@Composable
private fun Main(state: LinkState) {
    val graph = LocalContext.current.graph
    val phase by graph.session.phase.collectAsState()
    var tab by rememberSaveable { mutableStateOf(Tab.Home) }
    val liveTab = tabFor(phase)
    LaunchedEffect(phase) { liveTab?.let { tab = it } }

    Scaffold(
        containerColor = Tm.Ink950,
        topBar = { TmTopBar(state) },
        bottomBar = { TmBottomBar(current = tab, live = liveTab, onSelect = { tab = it }) },
    ) { padding ->
        Box(Modifier.padding(padding).fillMaxSize()) {
            when (tab) {
                Tab.Home -> HomeScreen()
                Tab.Play -> PlayScreen()
                Tab.Draft -> DraftScreen()
                Tab.Game -> GameScreen()
                Tab.Builds -> BuildsScreen()
            }
            ReadyCheckOverlay()
        }
    }
}

/** Desktop-matched top bar: TrueMain wordmark on the left, compact PC status pill and menu on the right. */
@Composable
private fun TmTopBar(state: LinkState) {
    Column(Modifier.fillMaxWidth().background(Tm.colors.bgElevated).statusBarsPadding()) {
        Row(
            Modifier.fillMaxWidth().height(54.dp).padding(start = 16.dp, end = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TmWordmark(fontSize = 16.sp, markSize = 20.dp)
            Spacer(Modifier.weight(1f))
            LinkStatusPill(state)
            LinkMenu()
        }
        HorizontalDivider(thickness = 1.dp, color = Tm.colors.border)
    }
}

@Composable
private fun LinkStatusPill(state: LinkState) {
    val graph = LocalContext.current.graph
    val (dot, text) = when (state) {
        is LinkState.Open -> Tm.Success to state.pc.name
        is LinkState.Connecting -> Tm.Gold to (state.address ?: stringResource(R.string.link_connecting))
        LinkState.Searching -> Tm.Gold to stringResource(R.string.link_searching)
        else -> Tm.Red to stringResource(R.string.link_offline)
    }
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(
            Modifier
                .clip(RoundedCornerShape(8.dp))
                .background(Tm.colors.bgMuted)
                .border(1.dp, Tm.colors.border, RoundedCornerShape(8.dp))
                .padding(horizontal = 9.dp, vertical = 5.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Box(Modifier.size(7.dp).background(dot, CircleShape))
            Text(
                text,
                style = MaterialTheme.typography.labelMedium,
                color = Tm.Ink200,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.widthIn(max = 132.dp),
            )
        }
        if (state is LinkState.Offline) {
            TextButton(shape = Tm.ButtonShape, onClick = graph.link::retry) {
                Text(stringResource(R.string.link_retry), color = Tm.Rose400, style = MaterialTheme.typography.labelMedium)
            }
        }
    }
}

/**
 * Desktop-matched navigation bar: crisp geometric icons, centered top accent bar on the active tab
 * (mirroring `.tm-tab[data-active]` / `.rail-item[data-active]`), and a live dot on active game phases.
 */
@Composable
private fun TmBottomBar(current: Tab, live: Tab?, onSelect: (Tab) -> Unit) {
    Column(Modifier.fillMaxWidth().background(Tm.colors.bgElevated).navigationBarsPadding()) {
        HorizontalDivider(thickness = 1.dp, color = Tm.colors.border)
        Row(
            Modifier.fillMaxWidth().height(62.dp).padding(horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            for (item in Tab.entries) {
                val selected = current == item
                val isLive = live == item
                Column(
                    Modifier
                        .weight(1f)
                        .height(62.dp)
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                            onClick = { onSelect(item) },
                        ),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    // Top accent bar — mirrors desktop's `.tm-tab[data-active]::after`
                    Box(
                        Modifier
                            .width(26.dp)
                            .height(3.dp)
                            .clip(RoundedCornerShape(bottomStart = 3.dp, bottomEnd = 3.dp))
                            .background(if (selected) Tm.colors.primary else Color.Transparent),
                    )
                    Spacer(Modifier.height(7.dp))
                    Box(
                        Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (selected) Tm.colors.primary.copy(alpha = 0.13f) else Color.Transparent)
                            .padding(horizontal = 12.dp, vertical = 4.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = item.icon,
                            contentDescription = null,
                            tint = if (selected) Tm.colors.primary else Tm.Ink400,
                            modifier = Modifier.size(20.dp),
                        )
                        if (isLive) {
                            Box(
                                Modifier
                                    .align(Alignment.TopEnd)
                                    .size(7.dp)
                                    .border(1.5.dp, Tm.colors.bgElevated, CircleShape)
                                    .background(Tm.colors.primary, CircleShape),
                            )
                        }
                    }
                    Spacer(Modifier.height(2.dp))
                    Text(
                        text = stringResource(item.label),
                        fontSize = 11.sp,
                        fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
                        color = if (selected) Tm.Ink100 else Tm.Ink400,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}

@Composable
private fun LinkMenu() {
    val graph = LocalContext.current.graph
    var open by remember { mutableStateOf(false) }
    IconButton(onClick = { open = true }) {
        Icon(Icons.Filled.MoreVert, contentDescription = null, tint = Tm.Ink300)
    }
    DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
        DropdownMenuItem(text = { Text(stringResource(R.string.link_forget)) }, onClick = {
            open = false
            graph.link.forget()
        })
    }
}

/** The phase as a player reads it. */
@Composable
fun phaseLabel(phase: String): String = stringResource(
    when (phase) {
        "Lobby" -> R.string.phase_lobby
        "Matchmaking" -> R.string.phase_matchmaking
        "ReadyCheck" -> R.string.phase_ready_check
        "ChampSelect" -> R.string.phase_champ_select
        "GameStart", "InProgress" -> R.string.phase_in_progress
        "Reconnect" -> R.string.phase_reconnect
        "WaitingForStats", "PreEndOfGame", "EndOfGame" -> R.string.phase_end
        else -> R.string.phase_none
    },
)
