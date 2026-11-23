package lol.truemain.mobile.ui.draft

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import lol.truemain.mobile.R
import lol.truemain.mobile.data.GameData
import lol.truemain.mobile.ui.components.ChampionIcon
import lol.truemain.mobile.ui.components.Eyebrow
import lol.truemain.mobile.ui.components.Panel
import lol.truemain.mobile.ui.theme.Tm

/**
 * ARAM's shared bench: a tap trades the player's champion for the one tapped,
 * first come first served, as in the client. The reroll lives with the
 * loadout, since it is the player's own champion it changes.
 */
@Composable
fun BenchPanel(draft: Draft, data: GameData?, actions: DraftActions) {
    Panel {
        Eyebrow(stringResource(R.string.draft_bench))
        if (draft.bench.isEmpty()) {
            Text(stringResource(R.string.draft_bench_empty), color = Tm.Ink400, style = MaterialTheme.typography.bodyMedium)
            return@Panel
        }
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(draft.bench) { championId ->
                Column(
                    Modifier.width(60.dp).clip(RoundedCornerShape(10.dp))
                        .clickable(enabled = !actions.busy) { actions.send("POST", "/lol-champ-select/v1/session/bench/swap/$championId") }
                        .padding(4.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    ChampionIcon(championId, 50.dp)
                    Text(
                        data?.championName(championId).orEmpty(),
                        style = MaterialTheme.typography.labelSmall,
                        color = Tm.Ink300,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        textAlign = TextAlign.Center,
                    )
                }
            }
        }
        Text(stringResource(R.string.draft_bench_hint), color = Tm.Ink500, style = MaterialTheme.typography.bodySmall)
    }
}
