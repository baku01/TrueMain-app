import type { ChampionMastery } from '~/types/lcu'

/**
 * Any player's champion mastery with its exact points, from championmastery.gg
 * (which reads Riot's own): Blitz keeps the levels only. The player's page is
 * a table, a row a champion — its link names the champion's id, then its level,
 * its points (`data-value`) and when it was last played (`data-format-time`).
 * Most points first, as the page lists them.
 */
export function parseMasteryPage(html: string): ChampionMastery[] {
  const rows: ChampionMastery[] = []
  const row = /<tr><td><a[^>]*champion=(\d+)[^>]*>[^<]*<\/a><\/td><td>(\d+)<\/td><td[^>]*data-value="(\d+)"[^>]*>[\s\S]*?data-format-time="(\d+)"/g
  for (const match of html.matchAll(row)) {
    rows.push({ championId: Number(match[1]), championLevel: Number(match[2]), championPoints: Number(match[3]), lastPlayTime: Number(match[4]) || null })
  }
  return rows.sort((a, b) => (b.championPoints ?? 0) - (a.championPoints ?? 0))
}

/** championmastery.gg's region names, by Riot platform id. */
const REGIONS: Record<string, string> = {
  BR1: 'BR', EUN1: 'EUNE', EUW1: 'EUW', JP1: 'JP', KR: 'KR', LA1: 'LAN', LA2: 'LAS', ME1: 'ME', NA1: 'NA',
  OC1: 'OCE', RU: 'RU', TR1: 'TR', PH2: 'PH', SG2: 'SG', TH2: 'TH', TW2: 'TW', VN2: 'VN',
}

/** A player's mastery by Riot ID on a platform (`BR1`); empty when the page lists none. */
export async function readMasteryPoints(platformId: string, gameName: string, tagLine: string): Promise<ChampionMastery[]> {
  const query = { riotId: `${gameName}#${tagLine}`, region: REGIONS[platformId.toUpperCase()] ?? platformId.toUpperCase(), lang: 'en_US' }
  if (insideTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    return parseMasteryPage(await invoke<string>('source_get', { source: 'championmastery', path: 'player', query: Object.entries(query) }))
  }
  return parseMasteryPage(await $fetch<string>('/__championmastery/player', { query, responseType: 'text' }))
}
