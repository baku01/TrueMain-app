package lol.truemain.mobile.lcu

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.longOrNull

/**
 * Reading the client's JSON field by field. The LCU's documents are large,
 * undocumented and change between patches: a screen reads the few fields it
 * shows, and a missing one reads as absent rather than failing the screen.
 */
val JsonElement?.obj: JsonObject? get() = this as? JsonObject
val JsonElement?.arr: JsonArray? get() = this as? JsonArray
val JsonElement?.isNull: Boolean get() = this == null || this is JsonNull

operator fun JsonElement?.get(key: String): JsonElement? = (this as? JsonObject)?.get(key)
operator fun JsonElement?.get(index: Int): JsonElement? = (this as? JsonArray)?.getOrNull(index)

val JsonElement?.string: String? get() = (this as? JsonPrimitive)?.takeIf { it.isString }?.content
val JsonElement?.long: Long? get() = (this as? JsonPrimitive)?.longOrNull ?: (this as? JsonPrimitive)?.doubleOrNull?.toLong()
val JsonElement?.int: Int? get() = long?.toInt()
val JsonElement?.double: Double? get() = (this as? JsonPrimitive)?.doubleOrNull
val JsonElement?.bool: Boolean? get() = (this as? JsonPrimitive)?.booleanOrNull

fun JsonElement?.str(key: String): String? = this[key].string
fun JsonElement?.int(key: String): Int? = this[key].int
fun JsonElement?.long(key: String): Long? = this[key].long
fun JsonElement?.double(key: String): Double? = this[key].double
fun JsonElement?.bool(key: String): Boolean? = this[key].bool
fun JsonElement?.list(key: String): List<JsonElement> = this[key].arr.orEmpty()
val JsonElement?.items: List<JsonElement> get() = arr.orEmpty()
