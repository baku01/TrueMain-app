import type { NextItemCandidate, NextItemOrderStep, NextItemRequest, NextItemResponse } from '~/utils/next-item'
import type { Provider } from '~/utils/sources'
import type { SourceBuildStep } from '~/utils/draft-build'
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
const builds = new Map<string, Promise<{ steps: SourceBuildStep[], games: number, patch: string | null } | null>>()

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
      return { steps: draftBuildFromOptions(options, enemySituation(enemies, traits, opponent), items, proShares(pros, opponent, items)), games: options.games, patch: options.patch }
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
  const held = new Set(body.items)
  const hasBoots = body.items.some(id => isBoots(id) && id !== 1001)
  const done = (step: SourceBuildStep) => (step.isBoots ? hasBoots : held.has(step.itemId))
  const next = read.steps.find(step => !done(step)) ?? null
  const order: NextItemOrderStep[] = read.steps.map(step => ({
    itemId: step.itemId,
    isBoots: step.isBoots,
    state: done(step) ? 'Completed' : step === next ? 'Next' : 'Upcoming',
  }))
  const lastHeld = [...read.steps].reverse().find(step => !step.isBoots && done(step))?.itemId ?? 0
  const nextItem = read.steps.find(step => !step.isBoots && !done(step))
  const boots = read.steps.find(step => step.isBoots)
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
