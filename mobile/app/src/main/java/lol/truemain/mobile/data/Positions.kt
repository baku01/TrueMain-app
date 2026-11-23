package lol.truemain.mobile.data

import androidx.annotation.StringRes
import lol.truemain.mobile.R

/**
 * A lane, named three ways: TrueMain's API (`MIDDLE`), the client's champion
 * select (`middle`) and the lobby's position preferences (`MIDDLE`, with
 * `FILL` and `UNSELECTED` besides).
 */
enum class Position(val api: String, val lcu: String, @StringRes val label: Int) {
    Top("TOP", "top", R.string.position_top),
    Jungle("JUNGLE", "jungle", R.string.position_jungle),
    Middle("MIDDLE", "middle", R.string.position_middle),
    Bottom("BOTTOM", "bottom", R.string.position_bottom),
    Support("UTILITY", "utility", R.string.position_support);

    companion object {
        /** From any of the spellings above, or null for none/fill. */
        fun of(value: String?): Position? {
            val key = value?.trim()?.lowercase() ?: return null
            return entries.firstOrNull { it.lcu == key || it.api.lowercase() == key } ?: when (key) {
                "mid" -> Middle
                "bot", "adc" -> Bottom
                "support", "sup" -> Support
                else -> null
            }
        }
    }
}
