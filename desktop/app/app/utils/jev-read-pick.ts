import type { JevAnswer, JevQuestion } from '~/utils/jev'
import type { ChampionText, Request } from '~/utils/jev-read'
import { kitOf, scoreOf } from '~/utils/jev-read'

/**
 * What Jev reads of the champions we could pick (`useJevPick`), as
 * `utils/jev-read` reads the build: each candidate against the lane opponent,
 * with our team and against the enemy team, as levels of a scale.
 */

/** What Jev read of a champion we could pick, each 0 (bad) to 1 (good); null where the draft gave nothing to judge against. */
export interface PickRead {
  lane: number | null
  team: number | null
  enemy: number | null
  confidence: number
}

const PICK_SCALES = {
  lane: {
    ask: (name: string) => `How does candidates["${name}"] fare laning against laneOpponent?`,
    levels: [
      'laneOpponent wins the lane: its kit punishes this champion in lane',
      'An even lane: neither kit has the edge',
      'This champion wins the lane: its kit punishes laneOpponent',
    ],
  },
  team: {
    ask: (name: string) => `How well does candidates["${name}"] complete ourTeam?`,
    levels: [
      'Doubles what ourTeam already has and leaves its gaps open',
      'Fits ourTeam without filling a gap',
      'Gives ourTeam what it lacks: a frontline, engage, the other damage type, or the range it misses',
    ],
  },
  enemy: {
    ask: (name: string) => `How does candidates["${name}"] fare against enemyTeam as a whole?`,
    levels: [
      'enemyTeam shuts it down: its crowd control, burst or range beats this champion',
      'Neither side has the edge',
      'This champion punishes what enemyTeam relies on',
    ],
  },
} as const

/**
 * The champions we could pick as one request: against the lane opponent, with
 * our team, against the enemy team — each a scale of situations, asked only
 * where the draft has someone to judge against. Short kits: many champions
 * share the state, and only what they do matters here.
 */
export function pickRequest(input: {
  position: string
  opponent: ChampionText | null
  allies: ChampionText[]
  enemies: ChampionText[]
  candidates: ChampionText[]
}): Request {
  const asked = (Object.keys(PICK_SCALES) as (keyof typeof PICK_SCALES)[]).filter(fact => (fact === 'lane' ? !!input.opponent : fact === 'team' ? input.allies.length > 0 : input.enemies.length > 0))
  const questions: Record<string, JevQuestion> = {}
  for (const candidate of input.candidates) {
    for (const fact of asked) questions[`p${candidate.id}_${fact}`] = { type: 'score', instructions: PICK_SCALES[fact].ask(candidate.name), criteria: [...PICK_SCALES[fact].levels] }
  }
  return {
    state: {
      ourRole: input.position,
      ...(input.opponent ? { laneOpponent: { name: input.opponent.name, ...kitOf(input.opponent) } } : {}),
      ourTeam: Object.fromEntries(input.allies.map(ally => [ally.name, kitOf(ally)])),
      enemyTeam: Object.fromEntries(input.enemies.map(enemy => [enemy.name, kitOf(enemy)])),
      candidates: Object.fromEntries(input.candidates.map(candidate => [candidate.name, kitOf(candidate)])),
    },
    questions,
  }
}

export function readPick(id: number, answers: Record<string, JevAnswer>): PickRead | null {
  const reads = (Object.keys(PICK_SCALES) as (keyof typeof PICK_SCALES)[]).map(fact => [fact, scoreOf(answers[`p${id}_${fact}`])] as const)
  const known = reads.filter(([, read]) => read)
  if (!known.length) return null
  const value = (fact: keyof typeof PICK_SCALES) => reads.find(([name]) => name === fact)?.[1]?.value ?? null
  return { lane: value('lane'), team: value('team'), enemy: value('enemy'), confidence: known.reduce((sum, [, read]) => sum + read!.confidence, 0) / known.length }
}
