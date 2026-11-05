import type { CompositionBuildRequest } from '~/types/build'
import type { JevDecision, LaidBuild, Names } from '~/utils/jev-build'
import { askJev, jevKeyStatus } from '~/utils/jev'
import { decide, draftNeeds, firstSlots, itemEffect, laidBuild, laterSlot, laterSlotNumbers, measuredPool, plainAbility, questionsOf, stateOf } from '~/utils/jev-build'
import { answers, enemySituation } from '~/utils/draft-build'
import { activeProvider } from '~/utils/sources'

export type JevStatus = 'idle' | 'loading' | 'ready' | 'noKey' | 'noSource' | 'noOptions' | 'error'

/**
 * The Jev matchup page's build (`utils/jev-build`), asked on the player's click
 * — each ask is paid. One call for the runes, spells, starter, skills, boots,
 * when to buy them and the core path; then one for every item after the core
 * Jev picked, told what is already in the build. Jev's picks are taken as they
 * are; beside them, the source's most played option of every slot.
 */
export function useJevBuild(subject: Ref<{ championId: number, request: CompositionBuildRequest } | null>) {
  const { champions } = useChampionStatics()
  const { items, summoners, runeTree, loadChampion, championStatic } = useStaticData()
  const status = ref<JevStatus>('idle')
  const error = ref<string | null>(null)
  const decisions = ref<JevDecision[]>([])
  const jevBuild = ref<LaidBuild | null>(null)
  const standardBuild = ref<LaidBuild | null>(null)
  const elapsedMs = ref<number | null>(null)
  let generation = 0

  // A new draft drops the last answer: it was for another board.
  watch(subject, () => {
    generation++
    status.value = 'idle'
    decisions.value = []
    jevBuild.value = null
    standardBuild.value = null
  }, { deep: true })

  async function ask() {
    const current = subject.value
    if (!current) return
    const mine = ++generation
    const provider = activeProvider()
    if (!provider) return void (status.value = 'noSource')
    if (!(await jevKeyStatus().catch(() => ({ set: false }))).set) return void (status.value = 'noKey')
    status.value = 'loading'
    error.value = null
    const started = performance.now()
    try {
      const { request, championId } = current
      const opponentId = request.enemies.find(enemy => enemy.position === request.position)?.championId ?? null
      const enemyIds = request.enemies.map(enemy => enemy.championId)
      const [options, matchups] = await Promise.all([
        provider.options(championId, request.position, opponentId),
        opponentId ? provider.matchups(championId, { position: request.position, opponent: opponentId }).catch(() => null) : null,
        Promise.all(enemyIds.map(id => loadChampion(id).catch(() => {}))),
      ])
      if (mine !== generation) return
      if (!options || !options.cores.length) return void (status.value = 'noOptions')

      const byId = (id: number) => champions.value.get(id)
      const versus = matchups?.matchups.find(row => row.opponentChampionId === opponentId) ?? null
      const base = {
        champion: byId(championId),
        position: request.position,
        opponent: opponentId ? byId(opponentId) : undefined,
        enemies: enemyIds.map(byId).filter(champion => !!champion),
        allies: request.allies.map(ally => byId(ally.championId)).filter(champion => !!champion),
        situations: enemySituation(enemyIds, champions.value, opponentId),
        games: options.games,
        // Each enemy's passive and abilities, as Data Dragon words them.
        abilities: new Map(enemyIds.map(id => [id, Object.values(championStatic(id)?.championSpells ?? {}).map(spell => ({ key: spell.key, name: spell.name, description: spell.description ?? '' }))])),
        lane: versus ? { games: versus.games, winRate: versus.winRate, laneWinRate: versus.laneWinRate, goldDiffAt15: versus.averageGoldDiffAt15 } : null,
      }
      const tree = runeTree.value
      const names: Names = {
        item: id => items.value[id]?.name ?? `Item ${id}`,
        perk: id => tree?.perks[id]?.name ?? `Rune ${id}`,
        style: id => tree?.perkStyles[id]?.name ?? `Tree ${id}`,
        spell: id => summoners.value[id]?.name ?? `Spell ${id}`,
        itemEffect: id => itemEffect(items.value[id]),
        perkEffect: id => plainAbility(tree?.perks[id]?.shortDesc ?? tree?.perks[id]?.longDesc, 200),
        spellEffect: id => plainAbility(summoners.value[id]?.description, 200),
      }
      // What every question is asked against: the lane opponent, and the enemy team in one line.
      const ask = {
        champion: base.champion ? `${base.champion.name} (${(base.champion.tags ?? []).join('/')}, ${request.position})` : `our ${request.position}`,
        opponent: base.opponent ? `${base.opponent.name} (${(base.opponent.tags ?? []).join('/')})` : 'the lane opponent',
        needs: draftNeeds(base.enemies),
      }

      const first = firstSlots(options, names, ask)
      const firstAnswers = await askJev(stateOf(base), questionsOf(first, ask))
      if (mine !== generation) return
      const made = first.map(slot => decide(slot, firstAnswers))

      // The items after the core, slot by slot, each asked knowing what Jev has put in the build so far.
      const coreOf = (side: 'jev' | 'standard') => {
        const core = made.find(entry => entry.slot.name === 'core')
        return core ? options.cores[Number(core[side].key.slice(1))] ?? null : null
      }
      const heldBy = (side: 'jev' | 'standard') => made.flatMap(entry => (entry.slot.name === 'core' || entry.slot.name === 'boots' ? entry[side].itemIds : []))
      // Every later slot's candidates checked in one call (TypeSafe: ask all you may need at once),
      // then each slot settled in order, an item already in the build left out.
      const jevLater: number[] = []
      // A slot's measured options, and the items of the champion's measured pool that answer this draft.
      const situational = { pool: measuredPool(options), answersDraft: (id: number) => answers(id, base.situations, items.value) !== null }
      const laterSlots = laterSlotNumbers(options, coreOf('jev'))
        .map(slotNumber => laterSlot(options, coreOf('jev'), slotNumber, heldBy('jev'), names, ask, situational))
        .filter(slot => slot !== null)
      const laterAnswers = laterSlots.length
        ? await askJev(stateOf({ ...base, taken: heldBy('jev').map(names.item) }), questionsOf(laterSlots, ask))
        : {}
      if (mine !== generation) return
      for (const slot of laterSlots) {
        const open = slot.options.filter(option => !option.itemIds.some(id => jevLater.includes(id)))
        if (!open.length) continue
        const decision = decide({ ...slot, options: open }, laterAnswers)
        jevLater.push(...decision.jev.itemIds)
        made.push(decision)
      }
      const standardLater: number[] = []
      for (const slotNumber of laterSlotNumbers(options, coreOf('standard'))) {
        const slot = laterSlot(options, coreOf('standard'), slotNumber, [...heldBy('standard'), ...standardLater], names, ask)
        if (slot) standardLater.push(...slot.options[0]!.itemIds)
      }

      decisions.value = made
      jevBuild.value = laidBuild(made, 'jev', jevLater)
      standardBuild.value = laidBuild(made, 'standard', standardLater)
      elapsedMs.value = Math.round(performance.now() - started)
      status.value = 'ready'
    }
    catch (failure) {
      if (mine !== generation) return
      error.value = failure instanceof Error ? failure.message : String(failure)
      status.value = 'error'
    }
  }

  return { status, error, decisions, jevBuild, standardBuild, elapsedMs, ask }
}
