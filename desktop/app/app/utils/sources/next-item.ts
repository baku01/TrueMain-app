import type { NextItemCandidate, NextItemOrderStep, NextItemRequest, NextItemResponse } from '~/utils/next-item'
import type { Provider } from '~/utils/sources'
import type { SourceBuildStep } from '~/utils/draft-build'
import type { StaticItemData } from '#shared/types/static-data'
import { isBoots } from '~/utils/blitz/builds'
import { readProMatches } from '~/utils/blitz/pro'
import { draftBuildFromOptions, enemySituation, proShares } from '~/utils/draft-build'
import { championTraits, liveItems } from '~/utils/sources/champions'

/**
 * The in-game next item (and the overlay's) from the source Settings picked,
 * in the shape TrueMain's next-item endpoint answers: the build for this game
 * as the draft reads it (`utils/draft-build.ts` — the source's measured
 * build, read against the enemy team and the pros), walked against what the
 * player holds. The next item is the build's first one not yet finished; the
 * boots come at their step. A step the enemy team moved says which situation did.
 */
const READ_FACTOR = 1.6

/** Items that turn into another once their quest is done: held as the one they became, they still count as bought. */
const TRANSFORMED: Record<number, number> = { 3042: 3004, 3040: 3003, 3121: 3119 }
/** A completed item's least price: what is held under it is a component or a starter, not a slot of the build. */
const COMPLETED_GOLD = 2000

function candidate(step: SourceBuildStep, games: number): NextItemCandidate {
  const share = games > 0 ? step.games / games : 0
  return {
    itemId: step.itemId,
    share,
    baseShare: step.reason ? share / READ_FACTOR : share,
    games: step.games,
    wins: 0,
    reasons: step.reason ? [{ axis: step.reason.axis, bucket: step.reason.bucket, factor: READ_FACTOR }] : [],
  }
}

/** The build for one game's board, kept while the board does not change: the game asks again at every purchase. */
const builds = new Map<string, Promise<{ steps: SourceBuildStep[], games: number, patch: string | null, items: Record<number, StaticItemData> } | null>>()

function buildFor(provider: Provider, championId: number, body: NextItemRequest) {
  const enemies = body.enemies.map(enemy => enemy.championId).sort((a, b) => a - b)
  const key = `${championId}|${body.position}|${enemies.join(',')}`
  let answer = builds.get(key)
  if (!answer) {
    answer = (async () => {
      const opponent = body.enemies.find(enemy => enemy.position === body.position)?.championId ?? null
      const [options, traits, items, pros] = await Promise.all([
        provider.options(championId, body.position, opponent),
        championTraits(),
        liveItems(),
        readProMatches(championId, body.position).catch(() => []),
      ])
      if (!options) return null
      return { steps: draftBuildFromOptions(options, enemySituation(enemies, traits, opponent), items, proShares(pros, opponent, items)), games: options.games, patch: options.patch, items }
    })()
    answer.catch(() => builds.delete(key))
    builds.set(key, answer)
    // A handful of boards a session: the oldest goes first.
    if (builds.size > 8) builds.delete(builds.keys().next().value!)
  }
  return answer
}

export async function nextItemFromSource(provider: Provider, championId: number, body: NextItemRequest): Promise<NextItemResponse> {
  const read = await buildFor(provider, championId, body)
  const empty = { championId, position: body.position, patch: null, build: null, boots: null, order: [], situation: {} }
  if (!read || !read.steps.length) return empty
  const held = new Set(body.items.flatMap(id => (TRANSFORMED[id] ? [id, TRANSFORMED[id]] : [id])))
  const hasBoots = body.items.some(id => isBoots(id) && id !== 1001)
  const done = (step: SourceBuildStep) => (step.isBoots ? hasBoots : held.has(step.itemId))
  const steps = withOffListItems(read.steps, body.items, held, read.items, done)
  const next = steps.find(step => !done(step)) ?? null
  const order: NextItemOrderStep[] = steps.map(step => ({
    itemId: step.itemId,
    isBoots: step.isBoots,
    state: done(step) ? 'Completed' : step === next ? 'Next' : 'Upcoming',
  }))
  const lastHeld = [...steps].reverse().find(step => !step.isBoots && done(step))?.itemId ?? 0
  const nextItem = steps.find(step => !step.isBoots && !done(step))
  const boots = steps.find(step => step.isBoots)
  const slot = (step: SourceBuildStep | undefined) => (step
    ? { parentItemId: lastHeld, onTree: true, branchGames: read.games, patchWindow: 1, candidates: [candidate(step, read.games)] }
    : null)
  return {
    championId,
    position: body.position,
    patch: read.patch,
    build: slot(nextItem),
    boots: boots && !hasBoots ? slot(boots) : null,
    order,
    situation: {},
  }
}

/**
 * A completed item the player bought that the build does not list takes a
 * slot of it, as it does in their inventory: it is drawn done, ahead of what
 * is left to buy, and the build's last item still to buy makes room for it.
 */
function withOffListItems(steps: SourceBuildStep[], bought: number[], held: Set<number>, items: Record<number, StaticItemData>, done: (step: SourceBuildStep) => boolean): SourceBuildStep[] {
  const listed = new Set(steps.map(step => step.itemId))
  const components = new Set(steps.flatMap(step => recipeOf(step.itemId, items)))
  const extra = [...new Set(bought)].filter((itemId) => {
    const item = items[itemId]
    return item && !listed.has(itemId) && !listed.has(TRANSFORMED[itemId] ?? -1) && !components.has(itemId)
      && !isBoots(itemId) && item.totalGold >= COMPLETED_GOLD && held.has(itemId)
  })
  if (!extra.length) return steps
  const out = [...steps]
  for (const itemId of extra) {
    const at = out.findIndex(step => !step.isBoots && !done(step))
    const step: SourceBuildStep = { itemId, isBoots: false, games: 0, pros: null, reason: null }
    if (at === -1) {
      out.push(step)
      continue
    }
    out.splice(at, 0, step)
    const last = out.findLastIndex(entry => !entry.isBoots && !done(entry) && entry !== step)
    if (last !== -1) out.splice(last, 1)
  }
  return out
}

/** Every component under an item, all the way down its recipe. */
function recipeOf(itemId: number, items: Record<number, StaticItemData>): number[] {
  const from = items[itemId]?.from ?? []
  return from.flatMap(id => [id, ...recipeOf(id, items)])
}
