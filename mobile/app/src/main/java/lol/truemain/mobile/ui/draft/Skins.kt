package lol.truemain.mobile.ui.draft

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.JsonElement
import lol.truemain.mobile.R
import lol.truemain.mobile.data.Art
import lol.truemain.mobile.lcu.bool
import lol.truemain.mobile.lcu.get
import lol.truemain.mobile.lcu.int
import lol.truemain.mobile.lcu.items
import lol.truemain.mobile.lcu.list
import lol.truemain.mobile.lcu.str
import lol.truemain.mobile.link.LinkUnavailable
import lol.truemain.mobile.ui.components.Chip
import lol.truemain.mobile.ui.components.EmptyState
import lol.truemain.mobile.ui.components.Eyebrow
import lol.truemain.mobile.ui.components.Loading
import lol.truemain.mobile.ui.components.RemoteImage
import lol.truemain.mobile.ui.theme.Tm
import kotlinx.coroutines.delay

/** A skin or chroma the carousel offers; only an owned one can be chosen. */
private data class Skin(val id: Int, val name: String, val championId: Int, val owned: Boolean, val tile: String, val chromas: List<Skin>) {
    companion object {
        fun of(json: JsonElement, championId: Int): Skin {
            val id = json.int("id") ?: 0
            val owner = json.int("championId") ?: championId
            return Skin(
                id = id,
                name = json.str("name").orEmpty(),
                championId = owner,
                owned = json.bool("unlocked") == true || json["ownership"].bool("owned") == true,
                // The client's own asset path: Community Dragon no longer serves `v1/champion-tiles`.
                tile = Art.lcuAsset(json.str("tilePath")) ?: Art.championTile(owner, id),
                chromas = json.list("childSkins").map { of(it, championId) },
            )
        }
    }
}

private sealed interface Carousel {
    data object Loading : Carousel
    data object Failed : Carousel
    data class Ready(val skins: List<Skin>) : Carousel
}

/**
 * The locked champion's skins as the client's carousel lists them. Swiping only
 * browses; a tap on an owned tile (or chroma) is what selects it.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SkinsSheet(me: Cell, actions: DraftActions, onDismiss: () -> Unit) {
    var carousel by remember { mutableStateOf<Carousel>(Carousel.Loading) }
    var attemptTick by remember { mutableIntStateOf(0) }
    val sheetSnackbar = rememberSheetSnackbar(actions)
    LaunchedEffect(me.championId, attemptTick) {
        carousel = Carousel.Loading
        // Right after a lock the client may still be filling the carousel: an empty or failed
        // read is tried again a few times before the sheet says there is nothing.
        repeat(CAROUSEL_TRIES) { attempt ->
            val read = try {
                val response = actions.session.get("/lol-champ-select/v1/skin-carousel-skins")
                if (!response.ok) {
                    Carousel.Failed
                } else {
                    Carousel.Ready(
                        response.body.items.map { Skin.of(it, me.championId) }.filter { it.championId == me.championId && it.id > 0 },
                    )
                }
            } catch (_: LinkUnavailable) {
                Carousel.Failed
            }
            val done = read is Carousel.Ready && read.skins.isNotEmpty()
            if (done || attempt == CAROUSEL_TRIES - 1) {
                carousel = read
                return@LaunchedEffect
            }
            delay(CAROUSEL_RETRY_MILLIS)
        }
    }
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberFullSheetState(), containerColor = Tm.Ink900) {
        Box(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Eyebrow(stringResource(R.string.draft_skins_title), Modifier.padding(horizontal = 20.dp))
                when (val state = carousel) {
                    Carousel.Loading -> Loading()
                    Carousel.Failed -> EmptyState(stringResource(R.string.draft_skins_failed), action = stringResource(R.string.link_retry) to { attemptTick++ })
                    is Carousel.Ready -> if (state.skins.isEmpty()) {
                        EmptyState(stringResource(R.string.draft_skins_none))
                    } else {
                        SkinPager(state.skins, me, actions)
                    }
                }
            }
            SnackbarHost(sheetSnackbar, Modifier.align(Alignment.BottomCenter).padding(12.dp))
        }
    }
}

@Composable
private fun SkinPager(skins: List<Skin>, me: Cell, actions: DraftActions) {
    // The selected skin may be one of a skin's chromas: open on its parent.
    val start = skins.indexOfFirst { skin -> skin.id == me.skinId || skin.chromas.any { it.id == me.skinId } }.coerceAtLeast(0)
    val pager = rememberPagerState(initialPage = start) { skins.size }
    HorizontalPager(state = pager, contentPadding = PaddingValues(horizontal = 48.dp), pageSpacing = 12.dp) { page ->
        val skin = skins[page]
        val selected = skin.id == me.skinId
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Box(
                Modifier.clip(RoundedCornerShape(14.dp))
                    .border(3.dp, if (selected) Tm.Rose400 else Color.Transparent, RoundedCornerShape(14.dp))
                    .clickable(enabled = skin.owned && !selected && !actions.busy) { actions.skin(skin.id) },
            ) {
                RemoteImage(skin.tile, 240.dp, shape = RoundedCornerShape(14.dp), grayscale = !skin.owned)
                if (!skin.owned) Chip(stringResource(R.string.draft_skin_locked), modifier = Modifier.align(Alignment.TopEnd).padding(8.dp))
                if (selected) Chip(stringResource(R.string.draft_skin_selected), color = Tm.colors.textInverted, background = Tm.Rose400, modifier = Modifier.align(Alignment.TopEnd).padding(8.dp))
            }
            Text(skin.name, style = MaterialTheme.typography.titleSmall, color = if (skin.owned) Tm.Ink100 else Tm.Ink500, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
    val chromas = skins.getOrNull(pager.currentPage)?.chromas.orEmpty()
    if (chromas.isNotEmpty()) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Eyebrow(stringResource(R.string.draft_chromas))
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                chromas.forEach { chroma ->
                    val selected = chroma.id == me.skinId
                    Box(
                        Modifier
                            .heightIn(min = 40.dp)
                            .clip(RoundedCornerShape(50))
                            .background(if (selected) Tm.Rose400 else Tm.Ink800)
                            .clickable(enabled = chroma.owned && !selected && !actions.busy) { actions.skin(chroma.id) }
                            .padding(horizontal = 14.dp, vertical = 8.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            chroma.name.ifBlank { stringResource(R.string.draft_chroma_unnamed) },
                            style = MaterialTheme.typography.labelMedium,
                            color = when {
                                selected -> Tm.colors.textInverted
                                chroma.owned -> Tm.Ink100
                                else -> Tm.Ink500
                            },
                        )
                    }
                }
            }
        }
    }
}

/** Tries before an empty carousel is shown, and the pause between them. */
private const val CAROUSEL_TRIES = 4
private const val CAROUSEL_RETRY_MILLIS = 1_500L
