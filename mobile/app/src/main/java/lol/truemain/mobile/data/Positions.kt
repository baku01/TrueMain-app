package lol.truemain.mobile.data

import androidx.annotation.DrawableRes
import androidx.annotation.StringRes
import lol.truemain.mobile.R

/**
 * A lane, named three ways: TrueMain's API (`MIDDLE`), the client's champion
 * select (`middle`) and the lobby's position preferences (`MIDDLE`, with
 * `FILL` and `UNSELECTED` besides).
 */
enum class Position(
    val api: String,
    val lcu: String,
    @StringRes val label: Int,
    @DrawableRes val icon: Int,
) {
    Top("TOP", "top", R.string.position_top, R.drawable.ic_pos_top),
    Jungle("JUNGLE", "jungle", R.string.position_jungle, R.drawable.ic_pos_jungle),
    Middle("MIDDLE", "middle", R.string.position_middle, R.drawable.ic_pos_middle),
    Bottom("BOTTOM", "bottom", R.string.position_bottom, R.drawable.ic_pos_bottom),
    Support("UTILITY", "utility", R.string.position_support, R.drawable.ic_pos_utility);

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

        /** Official client icon drawable for any lane string, including `FILL`. */
        @DrawableRes
        fun iconOf(value: String?): Int? {
            val key = value?.trim()?.uppercase() ?: return null
            if (key == "FILL") return R.drawable.ic_pos_fill
            return of(key)?.icon
        }
    }
}
