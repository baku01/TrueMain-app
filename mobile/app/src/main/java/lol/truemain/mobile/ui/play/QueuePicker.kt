package lol.truemain.mobile.ui.play

import androidx.annotation.StringRes
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import lol.truemain.mobile.R
import lol.truemain.mobile.lcu.bool
import lol.truemain.mobile.lcu.int
import lol.truemain.mobile.lcu.items
import lol.truemain.mobile.lcu.str
import lol.truemain.mobile.session.Session
import lol.truemain.mobile.ui.components.EmptyState
import lol.truemain.mobile.ui.components.Eyebrow
import lol.truemain.mobile.ui.components.Loading
import lol.truemain.mobile.ui.theme.Tm

/** One queue of `/lol-game-queues/v1/queues`, reduced to what the tab shows. */
data class Queue(
    val id: Int,
    val name: String,
    val description: String,
    val category: String,
    val mapId: Int,
    val gameMode: String,
    val playable: Boolean,
)

/**
 * Every queue the client knows, by id — the lobby and an invitation name
 * their queue by id only — and the few a player starts from the phone.
 */
class QueueCatalog(private val byId: Map<Int, Queue>) {
    fun name(id: Int?): String? = id?.let(byId::get)?.name

    /** The playable queues, grouped PvP first, the most played first in each. */
    val groups: List<Pair<String, List<Queue>>> = byId.values
        .filter { it.playable }
        .sortedWith(compareBy<Queue> { PREFERRED.indexOf(it.id).let { i -> if (i < 0) Int.MAX_VALUE else i } }.thenBy { it.id })
        .groupBy { it.category }
        .toList()
        .sortedBy { (category, _) -> if (category == "PvP") 0 else 1 }

    companion object {
        const val PATH = "/lol-game-queues/v1/queues"

        /** Ranked first, then the normals, then the modes, as the client's own picker orders them. */
        private val PREFERRED = listOf(420, 440, 400, 490, 430, 480, 450, 1700, 900, 1900, 870, 880, 890)

        fun of(body: JsonElement?): QueueCatalog = QueueCatalog(
            body.items.mapNotNull { queue ->
                val id = queue.int("id") ?: return@mapNotNull null
                val name = queue.str("name")?.takeIf { it.isNotBlank() } ?: return@mapNotNull null
                val category = queue.str("category").orEmpty()
                val mode = queue.str("gameMode").orEmpty()
                Queue(
                    id = id,
                    name = name,
                    description = queue.str("description").orEmpty(),
                    category = category,
                    mapId = queue.int("mapId") ?: 0,
                    gameMode = mode,
                    // Tutorials, the practice tool and TFT live in the same list; none is a lobby to queue from here.
                    playable = queue.str("queueAvailability") == "Available" &&
                        queue.bool("isCustom") != true &&
                        queue.bool("isVisible") != false &&
                        category in setOf("PvP", "VersusAi") &&
                        !mode.startsWith("TUTORIAL") && mode != "PRACTICETOOL" && mode != "TFT",
                )
            }.associateBy { it.id },
        )
    }
}

@StringRes
private fun mapName(mapId: Int): Int? = when (mapId) {
    11 -> R.string.play_map_rift
    12 -> R.string.play_map_aram
    30 -> R.string.play_map_arena
    else -> null
}

@StringRes
private fun categoryName(category: String): Int = when (category) {
    "PvP" -> R.string.play_category_pvp
    else -> R.string.play_category_ai
}

/** No lobby yet: the queues to open one in, a tap each. */
@Composable
fun QueuePicker(catalog: QueueCatalog?, failed: Boolean, actions: PlayActions, onRetry: () -> Unit) {
    when {
        catalog == null && failed -> EmptyState(
            stringResource(R.string.play_queues_failed),
            action = stringResource(R.string.play_retry) to onRetry,
        )
        catalog == null -> Loading()
        catalog.groups.isEmpty() -> EmptyState(
            stringResource(R.string.play_queues_empty),
            action = stringResource(R.string.play_retry) to onRetry,
        )
        else -> Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(stringResource(R.string.play_pick_title), style = MaterialTheme.typography.titleLarge, color = Tm.Ink100)
            for ((category, queues) in catalog.groups) {
                Eyebrow(stringResource(categoryName(category)), Modifier.padding(top = 8.dp))
                for (queue in queues) QueueRow(queue, actions)
            }
        }
    }
}

@Composable
private fun QueueRow(queue: Queue, actions: PlayActions) {
    val key = "create:${queue.id}"
    val subtitle = mapName(queue.mapId)?.let { stringResource(it) }
        ?: queue.description.takeIf { it.isNotBlank() && it != queue.name }
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Tm.Ink900)
            .clickable(enabled = actions.idle) {
                actions.run(key, "POST", Session.LOBBY, buildJsonObject { put("queueId", queue.id) })
            }
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(Modifier.weight(1f)) {
            Text(queue.name, style = MaterialTheme.typography.titleMedium, color = Tm.Ink100)
            if (subtitle != null) Text(subtitle, style = MaterialTheme.typography.bodySmall, color = Tm.Ink400)
        }
        if (actions.busy == key) {
            CircularProgressIndicator(color = Tm.Rose400, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
        } else {
            Icon(Icons.Filled.PlayArrow, contentDescription = null, tint = if (actions.idle) Tm.Rose400 else Tm.Ink600)
        }
    }
}
