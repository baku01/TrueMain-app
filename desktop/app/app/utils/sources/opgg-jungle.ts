import { championTraits } from '~/utils/sources/champions'
import { keepBounded } from '~/utils/bounded'

/**
 * A jungler's paths, from op.gg's own champion page (`/lol/champions/<slug>/
 * jungle-paths/jungle`): its official API (the MCP server the other reads go
 * through) has none, and neither do lolalytics, Blitz or Tencent. The page is
 * public, behind no challenge; its data rides in the page itself, the
 * React Server Components payload (`self.__next_f.push([1,"…"])`) — per side
 * of the map, the full clears players ran (six camps in order) and their
 * games. An undocumented page: it may change without notice, and then the
 * paths are simply not shown.
 */

export type Camp = 'BLUE' | 'GROMP' | 'WOLVES' | 'RAPTORS' | 'RED' | 'KRUG'
export type MapSide = 'BLUE' | 'RED'

export interface JungleRoute {
  camps: Camp[]
  games: number
  /** Its share of the side's clears, 0–1. */
  share: number
}

export interface JungleSide {
  side: MapSide
  games: number
  /** Most run first. */
  routes: JungleRoute[]
  /** The camp a clear opens on, with its share of the side's clears, most taken first. */
  starts: { camp: Camp, share: number }[]
}

const CAMPS: readonly Camp[] = ['BLUE', 'GROMP', 'WOLVES', 'RAPTORS', 'RED', 'KRUG']
const isCamp = (value: unknown): value is Camp => typeof value === 'string' && (CAMPS as readonly string[]).includes(value)

/** The page's server payload, its chunks unescaped and joined: where the data is, as JSON text. */
function payloadOf(html: string): string {
  const chunks: string[] = []
  for (const match of html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)) {
    try {
      chunks.push(JSON.parse(`"${match[1]}"`) as string)
    }
    catch {
      // A chunk that does not read as a string holds nothing of ours.
    }
  }
  return chunks.join('')
}

/** The JSON object opening at `start` (a `{`), read to its matching brace; null when it does not close. */
function objectAt(text: string, start: number): unknown {
  let depth = 0
  let inString = false
  for (let index = start; index < text.length; index++) {
    const char = text[index]
    if (inString) {
      if (char === '\\') index++
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === '{') depth++
    else if (char === '}' && --depth === 0) {
      try {
        return JSON.parse(text.slice(start, index + 1))
      }
      catch {
        return null
      }
    }
  }
  return null
}

interface RawSide { team_key?: unknown, routes?: { route?: unknown[], play?: unknown }[], play?: unknown }

/** Each side's clears, as the page lists them; empty when the page holds none (a champion nobody jungles). */
export function parseJunglePaths(html: string): JungleSide[] {
  const text = payloadOf(html)
  const sides: JungleSide[] = []
  for (const side of ['BLUE', 'RED'] as const) {
    const at = text.indexOf(`{"team_key":"${side}","routes":`)
    if (at < 0) continue
    const raw = objectAt(text, at) as RawSide | null
    if (!raw || !Array.isArray(raw.routes)) continue
    const routes = raw.routes
      .map(entry => ({ camps: (entry.route ?? []).filter(isCamp), games: Number(entry.play) || 0 }))
      .filter(route => route.camps.length > 0 && route.games > 0)
    const games = Number(raw.play) || routes.reduce((sum, route) => sum + route.games, 0)
    if (!games || !routes.length) continue
    const opening = new Map<Camp, number>()
    for (const route of routes) opening.set(route.camps[0]!, (opening.get(route.camps[0]!) ?? 0) + route.games)
    sides.push({
      side,
      games,
      routes: routes.sort((a, b) => b.games - a.games).map(route => ({ ...route, share: route.games / games })),
      starts: [...opening].sort((a, b) => b[1] - a[1]).map(([camp, count]) => ({ camp, share: count / games })),
    })
  }
  return sides
}

const reads = new Map<number, Promise<JungleSide[]>>()

/** A champion's jungle paths, kept for the session; empty when op.gg has none or cannot be read. */
export function readJunglePaths(championId: number): Promise<JungleSide[]> {
  let read = reads.get(championId)
  if (!read) {
    // The page is named by Riot's alias (`monkeyking`, `nunu`), not by the champion's name.
    read = championTraits().then(async (traits) => {
      const slug = traits.get(championId)?.alias.toLowerCase()
      if (!slug) return []
      const path = `lol/champions/${slug}/jungle-paths/jungle`
      if (insideTauri()) {
        const { invoke } = await import('@tauri-apps/api/core')
        return parseJunglePaths(await invoke<string>('source_get', { source: 'opggweb', path, query: [] }))
      }
      return parseJunglePaths(await $fetch<string>(`/__opggweb/${path}`, { responseType: 'text' }))
    }).catch(() => [])
    keepBounded(reads, championId, read)
  }
  return read
}
