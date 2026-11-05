import type { StaticItemData } from '#shared/types/static-data'
import type { Champion } from '~/composables/useChampionStatics'
import type { BuildOptions, ItemOption } from '~/utils/sources/model'
import { isBoots } from '~/utils/blitz/builds'

/**
 * The build for a draft from the source Settings picked — not TrueMain's
 * next-item model, which only TrueMain has. The source gives what it measured
 * for the champion on the lane (boots, cores, the items after them, each with
 * its games); the enemy team is read from Riot's own champion data (Data
 * Dragon: the 0–10 attack and magic ratings, the classes, the attack range);
 * and each step takes the item the source measured most, with weight added to
 * the ones that answer the team — magic resist against magic damage, armour
 * against physical, penetration against a frontline, Mercury's Treads against
 * crowd control, anti-heal against a healer. An item's games are weighed by how
 * it wins, too: its win rate against the lane's, shrunk toward the lane's by
 * its sample, so a popular item that loses gives way to one that wins and a
 * handful of lucky games moves nothing. Only items the source measured for the champion are ever
 * picked: the draft reorders the source's build, it never invents one.
 *
 * The pros weigh in too: the share of the latest pro and high-elo games on the
 * champion and lane (Blitz) in which the item was finished — the games against
 * the same lane opponent counting double — adds weight to the items they build.
 */

export type Axis = 'EnemyMagicDamage' | 'EnemyPhysicalDamage' | 'EnemyFrontline' | 'EnemyCrowdControl' | 'EnemyMelee' | 'EnemySustain' | 'OpponentMagicDamage'
export interface Situation {
  axis: Axis
  bucket: 'High' | 'Low'
  /** How far past its threshold the board is, 0–1: a team all magic weighs more than one barely so. */
  strength?: number
}

/** How far apart a champion's attack and magic ratings must be for its damage to read as one kind. */
const OPPONENT_SKEW = 3

/** The extra weight an item that answers the team gets over its games. */
const ANSWER_WEIGHT = 1.6
/**
 * The boots are the draft's own slot — the one players change by the enemy
 * team before anything else, Mercury's Treads or Plated Steelcaps — so an
 * answer weighs more there.
 */
const BOOTS_ANSWER_WEIGHT = 2.5
/** How much the pros' share adds: an item every pro finishes weighs 1.4× its games. */
const PRO_WEIGHT = 0.4
/**
 * An item that guards only against the damage the enemy team does not deal —
 * armour alone, or Plated Steelcaps, into a magic team — keeps this share of
 * its weight: the pros' usual pick is not this draft's.
 */
const MISFIT_WEIGHT = 0.45
/** An alternative is only considered with at least this share of the most played one's games: a handful of games is not a build. */
const MIN_SHARE_OF_TOP = 0.1
/**
 * The win rate's pull: an item's rate is shrunk toward the lane's by this many
 * games of the lane's rate, then each point above it multiplies the weight by
 * about `e^(WIN_RATE_WEIGHT/100)` — three points over the lane, ×1.3.
 */
const WIN_RATE_PRIOR = 250
const WIN_RATE_WEIGHT = 9

/** The win-rate factor of an option measured over `games` at `winRate`, against the lane's `baseline`. */
export function winRateFactor(winRate: number, games: number, baseline: number): number {
  if (!(games > 0) || !(winRate > 0)) return 1
  const shrunk = (winRate * games + baseline * WIN_RATE_PRIOR) / (games + WIN_RATE_PRIOR)
  return Math.exp(WIN_RATE_WEIGHT * (shrunk - baseline))
}

/** Champions whose kit heals enough that the enemy builds anti-heal into them, by Data Dragon alias. */
const HEALERS = new Set([
  'Aatrox', 'Briar', 'DrMundo', 'Fiddlesticks', 'Illaoi', 'Kayn', 'Nami', 'Olaf', 'Renekton', 'Senna', 'Seraphine',
  'Sona', 'Soraka', 'Swain', 'Sylas', 'Vladimir', 'Volibear', 'Warwick', 'Yuumi', 'Zac', 'Maokai', 'Nasus', 'Trundle',
])
/** The finished items that carry Grievous Wounds. */
const ANTI_HEAL = new Set([3033, 3075, 3165, 6609])

const MERCURY = 3111
const STEELCAPS = 3047

/**
 * What the enemy team brings, as far as Riot's champion data tells it — and
 * the lane opponent alone, which a matchup with nobody else on the board
 * still has: its damage, magic (`OpponentMagicDamage` High) or physical (Low).
 */
export function enemySituation(enemyIds: number[], champions: Map<number, Champion>, opponentId: number | null = null): Situation[] {
  const situations: Situation[] = []
  const opponent = opponentId !== null ? champions.get(opponentId) : undefined
  if (opponent?.info) {
    const skew = opponent.info.magic - opponent.info.attack
    if (skew >= OPPONENT_SKEW) situations.push({ axis: 'OpponentMagicDamage', bucket: 'High' })
    if (skew <= -OPPONENT_SKEW) situations.push({ axis: 'OpponentMagicDamage', bucket: 'Low' })
  }
  const enemies = enemyIds.map(id => champions.get(id)).filter((champion): champion is Champion => !!champion?.info)
  if (enemies.length < 2) return situations
  // Each champion is one kind of damage: magic when its magic rating leads its
  // attack by two or more, physical the other way, half each otherwise. Summing
  // the ratings instead let one marksman drag a team of mages to "barely magic".
  const kindOf = (champion: Champion) => {
    const skew = champion.info!.magic - champion.info!.attack
    return skew >= 2 ? 1 : skew <= -2 ? 0 : 0.5
  }
  const magicShare = enemies.reduce((sum, champion) => sum + kindOf(champion), 0) / enemies.length
  const count = (test: (champion: Champion) => boolean) => enemies.filter(test).length
  // 58% one way reads as that damage; 80% is as far as a team goes.
  const strength = (share: number) => Math.min(1, (share - 0.58) / 0.22)
  // Three or more mages are a magic board whatever the rest: the guides' "2–3+ AP threats".
  const mages = enemies.filter(champion => kindOf(champion) === 1).length
  if (magicShare >= 0.58 || mages >= 3) situations.push({ axis: 'EnemyMagicDamage', bucket: 'High', strength: Math.max(strength(magicShare), mages >= 3 ? 0.5 : 0) })
  if (magicShare <= 0.42) situations.push({ axis: 'EnemyPhysicalDamage', bucket: 'High', strength: strength(1 - magicShare) })
  if (count(champion => champion.tags?.includes('Tank') ?? false) >= 2) situations.push({ axis: 'EnemyFrontline', bucket: 'High' })
  if (count(champion => (champion.tags?.includes('Tank') || champion.tags?.includes('Support')) ?? false) >= 3) situations.push({ axis: 'EnemyCrowdControl', bucket: 'High' })
  if (count(champion => (champion.attackRange ?? 500) <= 200) >= 4) situations.push({ axis: 'EnemyMelee', bucket: 'High' })
  const healers = count(champion => HEALERS.has(champion.alias))
  if (healers >= 1) situations.push({ axis: 'EnemySustain', bucket: 'High', strength: Math.min(1, healers / 2) })
  return situations
}

/**
 * Whether the board as a whole reads one kind of damage. Then the lane
 * opponent alone no longer decides the defences: an AD laner into four mages
 * is still a magic board — Mercury's Treads, not Plated Steelcaps — as every
 * guide tells it ("2–3 or more AP threats: Treads, even if your lane opponent
 * is AD"). The lane opponent decides only where the team does not lean.
 */
const teamLeans = (situations: Situation[]) => situations.some(s => s.axis === 'EnemyMagicDamage' || s.axis === 'EnemyPhysicalDamage')

/** The situation an item answers, if it answers one this draft has. */
export function answers(itemId: number, situations: Situation[], items: Record<number, StaticItemData>): Situation | null {
  const tags = items[itemId]?.tags ?? []
  const has = (axis: Axis, bucket: 'High' | 'Low' = 'High') => situations.find(situation => situation.axis === axis && situation.bucket === bucket) ?? null
  const team = teamLeans(situations)
  const magicOpponent = team ? null : has('OpponentMagicDamage')
  const physicalOpponent = team ? null : has('OpponentMagicDamage', 'Low')
  if (ANTI_HEAL.has(itemId)) return has('EnemySustain')
  if (itemId === MERCURY) return has('EnemyMagicDamage') ?? has('EnemyCrowdControl') ?? magicOpponent
  if (itemId === STEELCAPS) return has('EnemyPhysicalDamage') ?? has('EnemyMelee') ?? physicalOpponent
  if (tags.includes('SpellBlock')) return has('EnemyMagicDamage') ?? magicOpponent
  if (tags.includes('Armor')) return has('EnemyPhysicalDamage') ?? has('EnemyMelee') ?? physicalOpponent
  if (tags.includes('MagicPenetration') || tags.includes('ArmorPenetration')) return has('EnemyFrontline')
  return null
}

/** A finished item in a pro's game: boots, or a completed item (not a component, trinket or potion). */
function finished(itemId: number, items: Record<number, StaticItemData>): boolean {
  const item = items[itemId]
  if (!item || isBoots(itemId)) return isBoots(itemId) && (item?.totalGold ?? 0) > 300
  return (item.totalGold ?? 0) >= 2000 && !(item.tags ?? []).includes('Consumable') && !(item.tags ?? []).includes('Trinket')
}

/**
 * The share of the pros' games each finished item appears in. A game against
 * `opponentId` counts twice: what the pros build into this very lane matters most.
 */
export function proShares(games: { items: number[], opponentChampionId: number | null }[], opponentId: number | null, items: Record<number, StaticItemData>): Map<number, number> {
  const counts = new Map<number, number>()
  let total = 0
  for (const game of games) {
    const weight = opponentId !== null && game.opponentChampionId === opponentId ? 2 : 1
    total += weight
    // Upgraded boots (Gunmetal Greaves…) are built from the base pair: a pro who finished them finished those too.
    const held = game.items.flatMap(id => [id, ...(isBoots(id) ? (items[id]?.from ?? []).filter(isBoots) : [])])
    for (const itemId of new Set(held.filter(id => finished(id, items)))) counts.set(itemId, (counts.get(itemId) ?? 0) + weight)
  }
  return new Map([...counts].map(([itemId, count]) => [itemId, total ? count / total : 0]))
}

/** Tags that make an item a damage item too: its armour or magic resist comes with what the champion builds it for. */
const OFFENSIVE = ['Damage', 'SpellDamage', 'AttackSpeed', 'CriticalStrike', 'ArmorPenetration', 'MagicPenetration', 'LifeSteal', 'OnHit']

/**
 * Whether an item guards only against the kind of damage this board does not
 * deal: a purely defensive item — Thornmail, Randuin's Omen, Kaenic Rookern —
 * against the other kind, or the boots for it. A damage item that happens to
 * carry a resistance (Zhonya's Hourglass, Guardian Angel) is never one: it is
 * built for its damage.
 */
export function misfits(itemId: number, situations: Situation[], items: Record<number, StaticItemData>): boolean {
  const tags = items[itemId]?.tags ?? []
  // The team's lean when it has one (`teamLeans`), the lane opponent's otherwise.
  const team = teamLeans(situations)
  const magicTeam = situations.some(s => s.axis === 'EnemyMagicDamage' || (!team && s.axis === 'OpponentMagicDamage' && s.bucket === 'High'))
  const physicalTeam = situations.some(s => s.axis === 'EnemyPhysicalDamage' || (!team && s.axis === 'OpponentMagicDamage' && s.bucket === 'Low'))
  const defensive = !tags.some(tag => OFFENSIVE.includes(tag))
  if (magicTeam && !physicalTeam) return itemId === STEELCAPS || (defensive && tags.includes('Armor') && !tags.includes('SpellBlock'))
  if (physicalTeam && !magicTeam) return (itemId === MERCURY && !situations.some(s => s.axis === 'EnemyCrowdControl')) || (defensive && tags.includes('SpellBlock') && !tags.includes('Armor'))
  return false
}

/**
 * A misfit the build never takes: the enemy team as a whole (not just the
 * lane opponent) clearly deals the other kind of damage. Against a team that
 * is plainly magic, Thornmail or Randuin's Omen is not a weaker pick but a
 * wrong one — a shorter build is better than a wrong item in it.
 */
const HARD_MISFIT_STRENGTH = 0.3
function excluded(itemId: number, situations: Situation[], items: Record<number, StaticItemData>): boolean {
  const team = situations.find(s => s.axis === 'EnemyMagicDamage' || s.axis === 'EnemyPhysicalDamage')
  return !!team && (team.strength ?? 1) >= HARD_MISFIT_STRENGTH && misfits(itemId, situations, items)
}

export interface SourceBuildStep {
  itemId: number
  isBoots: boolean
  games: number
  /** The share of the pros' games it was finished in; null without pro games. */
  pros: number | null
  /** The situation that put it there over the source's most played pick; null when it is that pick. */
  reason: Situation | null
}

/** The option the step settles on: the most played, unless one that answers the team, weighted, beats it. */
function pick(options: ItemOption[], situations: Situation[], items: Record<number, StaticItemData>, skip: ReadonlySet<number>, ids: (option: ItemOption) => number[], pros: Map<number, number>, baseline: number, answerWeight = ANSWER_WEIGHT) {
  const wins = (option: ItemOption) => winRateFactor(option.winRate, option.games, baseline)
  const proBoost = (option: ItemOption) => {
    const shares = ids(option).map(id => pros.get(id) ?? 0)
    return 1 + PRO_WEIGHT * (shares.length ? shares.reduce((sum, share) => sum + share, 0) / shares.length : 0)
  }
  const usable = options.filter(option => ids(option).length && !ids(option).some(id => skip.has(id) || excluded(id, situations, items)))
  const top = [...usable].sort((a, b) => b.games - a.games)[0]
  if (!top) return null
  // The source's own pick, before this board ruled anything out: a choice other than it says why.
  const mostPlayed = [...options].filter(option => ids(option).length && !ids(option).some(id => skip.has(id))).sort((a, b) => b.games - a.games)[0]
  const why = (option: ItemOption) => (option === mostPlayed ? null : ids(option).map(id => answers(id, situations, items)).find(Boolean) ?? null)
  const topMisfit = ids(top).some(id => misfits(id, situations, items)) ? MISFIT_WEIGHT : 1
  let best = { option: top, score: top.games * topMisfit * proBoost(top) * wins(top), reason: why(top) }
  for (const option of usable) {
    if (option.games < top.games * MIN_SHARE_OF_TOP) continue
    const reason = ids(option).map(id => answers(id, situations, items)).find(Boolean) ?? null
    // The answer weighs more the more one-sided the board: a barely-magic team adds half of it.
    const answered = reason ? 1 + (answerWeight - 1) * (0.5 + 0.5 * (reason.strength ?? 1)) : 1
    const misfit = ids(option).some(id => misfits(id, situations, items)) ? MISFIT_WEIGHT : 1
    const score = option.games * answered * misfit * proBoost(option) * wins(option)
    if (score > best.score) best = { option, score, reason: option === mostPlayed ? null : reason }
  }
  return best
}

/** How many completed items the draft's build runs to, the boots apart. */
const BUILD_ITEMS = 5

export function draftBuildFromOptions(options: BuildOptions, situations: Situation[], items: Record<number, StaticItemData>, pros: Map<number, number> = new Map()): SourceBuildStep[] {
  const proOf = (itemId: number) => (pros.size ? pros.get(itemId) ?? 0 : null)
  // The lane's win rate, as the cores measured it: what an item's is read against.
  const coreGames = options.cores.reduce((sum, core) => sum + core.games, 0)
  const baseline = coreGames ? options.cores.reduce((sum, core) => sum + core.winRate * core.games, 0) / coreGames : 0.5
  const boots = pick(options.boots, situations, items, new Set(), option => option.itemIds.slice(0, 1), pros, baseline, BOOTS_ANSWER_WEIGHT)

  // Every completed item the source measured on the lane, with the games
  // behind it: the cores' items (a source's core can carry the boots —
  // lolalytics counts them in it — they are their own step here) and the
  // items it measured after them. The build is chosen from all of them, so an
  // item of the most played core that guards against the wrong damage can
  // give way to one the source measured later that answers the board.
  // The core the build opens on: among the ones played enough to be a build,
  // the one whose games, weighed by how it wins, count the most.
  const mostPlayed = Math.max(0, ...options.cores.map(core => core.games))
  const topCore = options.cores
    .filter(core => core.games >= mostPlayed * 0.25)
    .map(core => ({ core, score: core.games * winRateFactor(core.winRate, core.games, baseline) }))
    .sort((a, b) => b.score - a.score)[0]?.core ?? null
  // Each option's win rate is read against its own group's: a fourth or fifth
  // item wins more than a core whatever it is, the game having gone on (on
  // lolalytics, Aatrox's fifth items win 70% where his cores win 52%), so a
  // later item's rate is not the cores' to compare with.
  const pool = new Map<number, { games: number, wins: number }>()
  const add = (itemId: number, option: ItemOption, groupRate: number) => {
    if (isBoots(itemId)) return
    const held = pool.get(itemId) ?? { games: 0, wins: 0 }
    pool.set(itemId, { games: held.games + option.games, wins: held.wins + (baseline + option.winRate - groupRate) * option.games })
  }
  for (const core of options.cores) for (const itemId of core.itemIds) add(itemId, core, baseline)
  for (const group of options.followUps(topCore)) {
    const games = group.options.reduce((sum, option) => sum + option.games, 0)
    const groupRate = games ? group.options.reduce((sum, option) => sum + option.winRate * option.games, 0) / games : baseline
    for (const option of group.options) for (const itemId of option.itemIds) add(itemId, option, groupRate)
  }

  const steps: SourceBuildStep[] = []
  const chosen = new Set<number>()
  // The first item is the most played core's: the build's first spike, what the champion opens on.
  // When every item of it guards against the wrong damage, the first item is picked like the others.
  const first = topCore?.itemIds.find(itemId => !isBoots(itemId) && !misfits(itemId, situations, items))
  if (first !== undefined) {
    chosen.add(first)
    steps.push({ itemId: first, isBoots: false, games: pool.get(first)?.games ?? topCore!.games, pros: proOf(first), reason: null })
  }
  const opensWithCore = first !== undefined
  const candidates: ItemOption[] = [...pool].map(([itemId, { games, wins }]) => ({ itemIds: [itemId], games, pickRate: 0, winRate: games ? wins / games : 0 }))
  while (steps.length < BUILD_ITEMS) {
    const next = pick(candidates, situations, items, chosen, option => option.itemIds, pros, baseline)
    if (!next) break
    const itemId = next.option.itemIds[0]!
    chosen.add(itemId)
    steps.push({ itemId, isBoots: false, games: next.option.games, pros: proOf(itemId), reason: next.reason })
  }

  // Chosen by weight, built in the source's order: the most played core's
  // items as it lists them, then the items it measured fourth, fifth, sixth —
  // another core's item at the core's stage.
  const followUps = options.followUps(topCore)
  const stageOf = (itemId: number) => {
    const inCore = topCore?.itemIds.filter(id => !isBoots(id)).indexOf(itemId) ?? -1
    if (inCore >= 0) return inCore
    const slot = followUps.find(group => group.options.some(option => option.itemIds.includes(itemId)))?.slot
    return slot !== undefined ? 10 + slot : 5
  }
  const ordered = opensWithCore
    ? [steps[0]!, ...steps.slice(1).sort((a, b) => stageOf(a.itemId) - stageOf(b.itemId))]
    : [...steps].sort((a, b) => stageOf(a.itemId) - stageOf(b.itemId))
  steps.splice(0, steps.length, ...ordered)

  // The boots second: where the mains of every source finish them. Boots fit
  // every champion, so when all the source measured guards against the wrong
  // damage (a source that lists one pair), the pair that answers the board
  // stands in — the one exception to "only what the source measured".
  let bootsStep: SourceBuildStep | null = boots
    ? { itemId: boots.option.itemIds[0]!, isBoots: true, games: boots.option.games, pros: proOf(boots.option.itemIds[0]!), reason: boots.reason }
    : null
  const measuredBoots = options.boots.length > 0
  if ((bootsStep && misfits(bootsStep.itemId, situations, items)) || (!bootsStep && measuredBoots)) {
    const answer = [MERCURY, STEELCAPS].map(itemId => ({ itemId, reason: answers(itemId, situations, items) })).find(entry => entry.reason && !misfits(entry.itemId, situations, items))
    if (answer) bootsStep = { itemId: answer.itemId, isBoots: true, games: 0, pros: proOf(answer.itemId), reason: answer.reason }
  }
  if (bootsStep) steps.splice(Math.min(1, steps.length), 0, bootsStep)
  return steps
}
