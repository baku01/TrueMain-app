/**
 * Keep `value` under `key` in a session cache that holds at most `max`
 * entries: the oldest go first (a `Map` keeps insertion order). Browsing many
 * players or champions must not grow a window's memory without end.
 */
export function keepBounded<K, V>(map: Map<K, V>, key: K, value: V, max = 60): V {
  map.delete(key)
  map.set(key, value)
  while (map.size > max) {
    const oldest = map.keys().next()
    if (oldest.done) break
    map.delete(oldest.value)
  }
  return value
}
