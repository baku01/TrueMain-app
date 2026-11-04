/**
 * One read of Blitz. Inside Tauri it goes through the shell (`sources.rs`);
 * in `npm run dev` through the dev server's `/__blitz/*` proxy (nuxt.config).
 */
export type BlitzSource = 'data' | 'lol' | 'utils' | 'nexus'

export type BlitzQuery = Record<string, string | number | null | undefined>

function pairs(query: BlitzQuery): [string, string][] {
  return Object.entries(query)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => [key, String(value)])
}

export async function blitzGet<T>(source: BlitzSource, path: string, query: BlitzQuery = {}): Promise<T> {
  if (insideTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    return await invoke<T>('source_get', { source, path, query: pairs(query) })
  }
  return await $fetch<T>(`/__blitz/${source}/${path}`, { query: Object.fromEntries(pairs(query)) })
}

/** `16.9` before `16.22`: patches compared as numbers. */
const patchOrder = (patch: string) => patch.split('.').slice(0, 2).reduce((total, part) => total * 100 + (Number(part) || 0), 0)
const newest = (rows: unknown[]) => rows.reduce<number>((best, row) => Math.max(best, patchOrder(String((row as { patch?: unknown }).patch ?? ''))), 0)

/**
 * An aggregated read (`query_objects/prod/lol/<name>`): its rows. Blitz's CDN
 * keeps an answer two hours per address, and after a patch some of its edges
 * keep serving the old one (16.21 rows for hours after 16.22 is out). A read
 * whose rows are older than the live patch is asked again under another
 * address — the same columns in another order, which the API answers alike
 * but the CDN files apart — and the newer answer is kept.
 */
export async function blitzRows<T>(name: string, query: BlitzQuery): Promise<T[]> {
  const first = (await blitzGet<{ data?: T[] }>('data', name, query)).data ?? []
  const columns = typeof query.columns === 'string' ? query.columns.split(',') : null
  const got = newest(first)
  if (!columns || columns.length < 2 || got === 0) return first
  const { currentPatch } = await import('~/utils/sources/champions')
  const live = patchOrder(await currentPatch().catch(() => ''))
  if (!live || got >= live) return first
  let best = first
  for (let turn = 1; turn < Math.min(columns.length, 4); turn++) {
    const rotated = [...columns.slice(turn), ...columns.slice(0, turn)].join(',')
    const rows = (await blitzGet<{ data?: T[] }>('data', name, { ...query, columns: rotated }).catch(() => ({ data: [] as T[] }))).data ?? []
    if (newest(rows) > newest(best)) best = rows
    if (newest(best) >= live) break
  }
  return best
}

/** Blitz's queue for ranked solo, which every read here is about. */
export const SOLO_QUEUE = 'RANKED_SOLO_5X5'

/**
 * TrueMain's elo bracket (`?eloBracket=`, `elo-brackets.ts`) as Blitz's tier
 * filter: `GOLD` stays `GOLD`, `MASTER_PLUS` is `MASTER+`, and `ALL` is
 * `IRON+` — Blitz's `ALL` answers its all-lanes rows only. No bracket reads
 * TrueMain's own default, Master+.
 */
export function blitzTier(eloBracket: unknown): string {
  const bracket = typeof eloBracket === 'string' && eloBracket ? eloBracket.toUpperCase() : 'MASTER_PLUS'
  if (bracket === 'ALL') return 'IRON+'
  return bracket.endsWith('_PLUS') ? `${bracket.slice(0, -'_PLUS'.length)}+` : bracket
}

/** A lane as Blitz names it in a query: `BOT` and `SUPPORT` where TrueMain says `BOTTOM` and `UTILITY`. */
export function blitzRole(position: string): string {
  if (position === 'BOTTOM') return 'BOT'
  if (position === 'UTILITY') return 'SUPPORT'
  if (position === 'MIDDLE') return 'MID'
  return position
}

/** A lane as Blitz names it in an answer, back to TrueMain's word. */
export function truemainPosition(position: string): string {
  if (position === 'BOT') return 'BOTTOM'
  if (position === 'SUPPORT') return 'UTILITY'
  if (position === 'MID') return 'MIDDLE'
  return position
}
