import type { JevAnswer } from '~/utils/jev'
import type { Asked } from '~/utils/jev-ask'
import type { ChampionText, Request } from '~/utils/jev-read'
import type { EnemyLine, Needs, Resist } from '~/utils/jev-needs'
import { mergeAsked } from '~/utils/jev-ask'
import { batches, championReadKey, enemyRequest, keepChampionRead, knownChampionRead, readChampion } from '~/utils/jev-read'
import { laneNeeds, needsOf } from '~/utils/jev-needs'
import { duesOf } from '~/utils/jev-rules'

/** An enemy as the pages show Jev's reading of it, with what the needs read of it (its damage split and weight, `EnemyLine`). */
export interface EnemyReading extends EnemyLine { name: string, opponent: boolean }

/** What the enemy team throws at us, on the whole and on our lane, and each enemy's reading. */
export interface EnemyAssessment {
  team: Needs
  lane: Needs
  readings: EnemyReading[]
  /** The resistances LoLTheory's rule calls for against this team (`duesOf`), every enemy counted, read or not. */
  dues: Resist[]
}

/** The enemy kits out with Jev, by read key: the pick and the build asking at once ask each enemy once, the other awaits it. */
const reading = new Map<string, Promise<Asked>>()

/**
 * The enemy team as Jev reads it, shared by the build and the pick: which
 * kits it has yet to read this patch (`unread`), those asked and what came
 * back kept for the session (`read`, `keep`), and the team's needs from
 * those reads and Blitz's measured damage split, each champion weighed by the
 * damage it deals (`assess`).
 */
export function useJevEnemies() {
  const { champions, patch } = useChampionStatics()
  const { textOf } = useChampionTexts()
  const damage = useDamageProfiles()
  const version = () => patch.value || 'live'

  /** The enemies Jev has not read this patch. Their own data must be loaded (`useChampionTexts().loadAll`). */
  const unread = (ids: number[]): ChampionText[] => ids
    .map(id => textOf(id))
    .filter((text): text is ChampionText => !!text && !knownChampionRead(championReadKey(version(), text.id)))

  function keep(answers: Record<string, JevAnswer>, asked: ChampionText[]) {
    for (const enemy of asked) {
      const read = readChampion(enemy.id, answers)
      if (read) keepChampionRead(championReadKey(version(), enemy.id), read)
    }
  }

  /** Asks `ask` for the enemies not read yet, those another ask has out awaited instead of asked twice. */
  async function read(ids: number[], ask: (parts: Request[]) => Promise<Asked>): Promise<Asked> {
    const key = (id: number) => championReadKey(version(), id)
    const missing = unread(ids)
    const mine = missing.filter(text => !reading.has(key(text.id)))
    const others = new Set(missing.flatMap(text => (reading.has(key(text.id)) ? [reading.get(key(text.id))!] : [])))
    const asked = ask(batches(enemyRequest(mine))).then((result) => {
      keep(result.answers, mine)
      return result
    })
    for (const text of mine) reading.set(key(text.id), asked)
    try {
      return mergeAsked(await asked, ...await Promise.all(others))
    }
    finally {
      for (const text of mine) if (reading.get(key(text.id)) === asked) reading.delete(key(text.id))
    }
  }

  /** An enemy's damage split, as Blitz measured it on its lane, else as Riot rates its kit. */
  function splitOf(id: number, position: string | null) {
    const profile = damage.profileOf(id, position)
    const info = champions.value.get(id)?.info
    const rated = info ? info.magic / Math.max(1, info.magic + info.attack) : 0.5
    return { physical: profile?.physicalShare ?? 1 - rated, magic: profile?.magicShare ?? rated, weight: profile?.damagePerGame ?? 1 }
  }

  function lineOf(id: number, position: string | null): EnemyLine | null {
    const read = knownChampionRead(championReadKey(version(), id))
    return read ? { id, read, ...splitOf(id, position) } : null
  }

  function assess(enemies: { championId: number, position: string | null }[], opponentId: number | null): EnemyAssessment {
    const lines = enemies.map(enemy => lineOf(enemy.championId, enemy.position)).filter((line): line is EnemyLine => !!line)
    const team = needsOf(lines)
    const opponent = opponentId ? lines.find(line => line.id === opponentId) ?? null : null
    return {
      team,
      lane: laneNeeds(team, opponent ? needsOf([opponent]) : null),
      readings: lines.map(line => ({ ...line, name: champions.value.get(line.id)?.name ?? String(line.id), opponent: line.id === opponentId })),
      dues: duesOf(enemies.map(enemy => splitOf(enemy.championId, enemy.position))),
    }
  }

  return { unread, keep, read, assess, load: damage.load }
}
