import type { LoadingPlayer } from '~/types/loading'

/** Games two players of a team must share among their latest to read as playing together. */
const SHARED = 2

/**
 * The players who queued together, by team: two players of one team who
 * share `SHARED` or more of their latest games (`PlayerForm.gameIds`) are a
 * group, and a third who shares that many with either joins it — what Blitz
 * reads off the players' recent games as a duo or a trio. Keyed by Riot ID:
 * the group's size, and which group of the team it is (two duos on one team
 * told apart); a player alone is not in it.
 */
export interface Premade { size: number, group: number }

export function premades(players: LoadingPlayer[]): Map<string, Premade> {
  const groups = new Map<string, Premade>()
  for (const team of new Set(players.map(player => player.team))) {
    const mates = players.filter(player => player.team === team && player.riotId && player.form?.gameIds?.length)
    // Union-find over the team: each pair sharing enough games joins its two groups.
    const root = new Map(mates.map(player => [player.riotId, player.riotId]))
    const find = (id: string): string => (root.get(id) === id ? id : find(root.get(id)!))
    for (const [index, one] of mates.entries()) {
      const theirs = new Set(one.form!.gameIds)
      for (const other of mates.slice(index + 1)) {
        if (other.form!.gameIds.filter(id => theirs.has(id)).length >= SHARED) root.set(find(other.riotId), find(one.riotId))
      }
    }
    const sizes = new Map<string, number>()
    for (const player of mates) sizes.set(find(player.riotId), (sizes.get(find(player.riotId)) ?? 0) + 1)
    const numbers = [...sizes].filter(([, size]) => size > 1).map(([id]) => id)
    for (const player of mates) {
      const group = numbers.indexOf(find(player.riotId))
      if (group >= 0) groups.set(player.riotId, { size: sizes.get(find(player.riotId))!, group })
    }
  }
  return groups
}
