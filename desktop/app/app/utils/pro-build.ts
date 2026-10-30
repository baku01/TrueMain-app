/**
 * Professional players and the builds they played — the ProBuild page's data.
 *
 * No source feeds it yet: TrueMain's API has no endpoint for professionals, and
 * the Riot accounts of the players it would list are not collected. Until one
 * is connected (`useProBuilds`), the page shows `SAMPLE_PROS`: placeholder
 * players with real champion and item ids, flagged as sample on screen. Nothing
 * here is a measurement, and none of it names a real person.
 */
export type ProRole = 'TOP' | 'JUNGLE' | 'MIDDLE' | 'BOTTOM' | 'UTILITY'

export const PRO_ROLES: ProRole[] = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']

export interface ProBuild {
  id: string
  championId: number
  win: boolean
  patch: string
  /** ISO date of the game. */
  playedAt: string
  kills: number
  deaths: number
  assists: number
  keystoneId: number
  spellIds: [number, number]
  /** Items in the order they were completed. */
  itemIds: number[]
}

export interface ProPlayer {
  id: string
  name: string
  team: string
  region: string
  role: ProRole
  builds: ProBuild[]
}

export type ProBuildSource = 'sample' | 'live'

export interface ProBuildData {
  source: ProBuildSource
  players: ProPlayer[]
}

export const SAMPLE_PROS: ProPlayer[] = [
  {
    id: 'sample-top', name: 'Exemplo Top', team: 'Time Exemplo', region: 'BR', role: 'TOP',
    builds: [
      { id: 'sample-top-1', championId: 58, win: true, patch: '16.21', playedAt: '2026-10-28T20:00:00Z', kills: 5, deaths: 2, assists: 7, keystoneId: 8010, spellIds: [4, 12], itemIds: [3074, 6630, 3047, 3053, 3161] },
      { id: 'sample-top-2', championId: 266, win: false, patch: '16.21', playedAt: '2026-10-27T19:00:00Z', kills: 3, deaths: 6, assists: 4, keystoneId: 8437, spellIds: [4, 14], itemIds: [3078, 3047, 6333, 3071] },
    ],
  },
  {
    id: 'sample-jungle', name: 'Exemplo Selva', team: 'Time Exemplo', region: 'BR', role: 'JUNGLE',
    builds: [
      { id: 'sample-jungle-1', championId: 64, win: true, patch: '16.21', playedAt: '2026-10-28T20:00:00Z', kills: 8, deaths: 3, assists: 10, keystoneId: 8112, spellIds: [4, 11], itemIds: [6692, 3158, 6676, 3814] },
    ],
  },
  {
    id: 'sample-mid', name: 'Exemplo Meio', team: 'Time Exemplo', region: 'KR', role: 'MIDDLE',
    builds: [
      { id: 'sample-mid-1', championId: 103, win: true, patch: '16.21', playedAt: '2026-10-26T18:00:00Z', kills: 6, deaths: 1, assists: 9, keystoneId: 8112, spellIds: [4, 14], itemIds: [6655, 3020, 3089, 3135] },
    ],
  },
  {
    id: 'sample-bottom', name: 'Exemplo Atirador', team: 'Time Exemplo', region: 'KR', role: 'BOTTOM',
    builds: [
      { id: 'sample-bottom-1', championId: 222, win: true, patch: '16.21', playedAt: '2026-10-26T18:00:00Z', kills: 9, deaths: 2, assists: 6, keystoneId: 8008, spellIds: [4, 7], itemIds: [6672, 3006, 3031, 3036, 3072] },
      { id: 'sample-bottom-2', championId: 81, win: false, patch: '16.20', playedAt: '2026-10-20T21:00:00Z', kills: 4, deaths: 5, assists: 5, keystoneId: 8005, spellIds: [4, 7], itemIds: [3078, 3158, 3042, 3814] },
    ],
  },
  {
    id: 'sample-support', name: 'Exemplo Suporte', team: 'Time Exemplo', region: 'EUW', role: 'UTILITY',
    builds: [
      { id: 'sample-support-1', championId: 412, win: true, patch: '16.21', playedAt: '2026-10-25T17:00:00Z', kills: 1, deaths: 2, assists: 17, keystoneId: 8010, spellIds: [4, 3], itemIds: [3190, 3107, 3109, 3050] },
    ],
  },
]

/** Players of `role` (all when null) whose name or team holds every word of `query`, case and accents ignored. */
export function searchPros(players: ProPlayer[], query: string, role: ProRole | null): ProPlayer[] {
  const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const words = fold(query).split(/\s+/).filter(Boolean)
  return players.filter((player) => {
    if (role && player.role !== role) return false
    const haystack = fold(`${player.name} ${player.team}`)
    return words.every(word => haystack.includes(word))
  })
}
