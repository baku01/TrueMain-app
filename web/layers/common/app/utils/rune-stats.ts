import type { MatchDetailRune } from '#shared/types/match-detail'
import type { StaticPerkData } from '#shared/types/static-data'

/**
 * What a player's runes did over a game, as the client's end-of-game screen
 * reads it: each rune's `var1..3` put into its CDragon `endOfGameStatDescs`
 * ("Total Damage Dealt: @eogvar1@"), and the damage they dealt summed — each
 * rune's first damage line only (Press the Attack's "Bonus Damage" is part of
 * its "Total Damage"), never a line of damage mitigated or shielded.
 */
export interface RuneStatLine {
  perkId: number
  /** The line with its figure in, "Total Damage Dealt: 1,234". */
  text: string
}

export interface RuneStats {
  /** Damage the runes dealt; null when the source carried no rune stats. */
  damage: number | null
  lines: RuneStatLine[]
}

const DAMAGE = /damage|dano|daño|dégâts|schaden/i
const NOT_DEALT = /mitigat|shield|escud|absorb|bloque|block/i

export function runeStats(runes: MatchDetailRune[], perks: Record<number, StaticPerkData>): RuneStats {
  if (!runes.some(rune => rune.vars)) return { damage: null, lines: [] }
  let damage = 0
  const lines: RuneStatLine[] = []
  for (const rune of runes) {
    const descs = perks[rune.perkId]?.endOfGameStatDescs ?? []
    const vars = rune.vars ?? []
    let counted = false
    descs.forEach((desc, index) => {
      const value = vars[index] ?? 0
      lines.push({ perkId: rune.perkId, text: desc.replace(/@eogvar(\d)@/g, (_, n: string) => (vars[Number(n) - 1] ?? 0).toLocaleString()) })
      if (!counted && DAMAGE.test(desc) && !NOT_DEALT.test(desc)) {
        damage += value
        counted = true
      }
    })
  }
  return { damage, lines }
}
