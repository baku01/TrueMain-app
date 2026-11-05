import type { CompositionBuildRequest } from '~/types/build'
import type { JevPick } from '~/utils/jev-build'
import type { SourceBuildStep } from '~/utils/draft-build'
import type { JevCallTrace } from '~/utils/jev'
import { askJev, jevKeyStatus, jevTrace } from '~/utils/jev'
import { firstSlots, laterSlots, questionsOf, settle, stateOf } from '~/utils/jev-build'
import { draftBuildFromOptions, enemySituation } from '~/utils/draft-build'
import { activeProvider } from '~/utils/sources'

export type JevStatus = 'idle' | 'loading' | 'ready' | 'noKey' | 'noSource' | 'noOptions' | 'error'

/**
 * The Jev matchup page's build and runes for a draft (`utils/jev-build`), asked
 * on the player's click — each ask is a paid call. Two calls: the core, boots,
 * runes and spells first; then the items after the core it picked, told what
 * is already in the build. Beside it, the app's own rules on the same options
 * (`draftBuildFromOptions`), to compare.
 */
export function useJevBuild(subject: Ref<{ championId: number, request: CompositionBuildRequest } | null>) {
  const { champions } = useChampionStatics()
  const { items, summoners, runeTree, loadChampion, championStatic } = useStaticData()
  const status = ref<JevStatus>('idle')
  const error = ref<string | null>(null)
  const picks = ref<JevPick[]>([])
  const rules = ref<SourceBuildStep[]>([])
  const elapsedMs = ref<number | null>(null)
  /** This ask's calls, as TypeSafe answered them. */
  const calls = ref<JevCallTrace[]>([])
  let generation = 0

  // A new draft drops the last answer: it was for another board.
  watch(subject, () => {
    generation++
    status.value = 'idle'
    picks.value = []
    rules.value = []
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
    const traced = jevTrace.length
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
      // Each enemy's passive and abilities, as Data Dragon words them: what they deal, how they lock down.
      const abilities = new Map(enemyIds.map(id => [id, Object.values(championStatic(id)?.championSpells ?? {}).map(spell => ({ key: spell.key, name: spell.name, description: spell.description ?? '' }))]))
      const versus = matchups?.matchups.find(row => row.opponentChampionId === opponentId) ?? null
      const lane = versus ? { games: versus.games, winRate: versus.winRate, laneWinRate: versus.laneWinRate, goldDiffAt15: versus.averageGoldDiffAt15 } : null
      if (!options || !options.cores.length) return void (status.value = 'noOptions')

      const byId = (id: number) => champions.value.get(id)
      const enemies = request.enemies.map(enemy => byId(enemy.championId)).filter(champion => !!champion)
      const allies = request.allies.map(ally => byId(ally.championId)).filter(champion => !!champion)
      const situations = enemySituation(request.enemies.map(enemy => enemy.championId), champions.value, opponentId)
      rules.value = draftBuildFromOptions(options, situations, items.value)

      const tree = runeTree.value
      const names = {
        perk: (id: number) => tree?.perks[id]?.name ?? `Rune ${id}`,
        style: (id: number) => tree?.perkStyles[id]?.name ?? `Tree ${id}`,
        spell: (id: number) => summoners.value[id]?.name ?? `Spell ${id}`,
      }
      const base = { champion: byId(championId), position: request.position, opponent: opponentId ? byId(opponentId) : undefined, enemies, allies, situations, games: options.games, abilities, lane }

      const first = firstSlots(options, items.value, names)
      const firstAnswers = await askJev(stateOf(base), questionsOf(first))
      if (mine !== generation) return
      const firstPicks = settle(first, firstAnswers, items.value)

      const coreSlot = firstPicks.find(pick => pick.slot.name === 'core')
      const core = coreSlot ? options.cores[Number(coreSlot.option.key.slice(1))] ?? null : null
      const taken = firstPicks.flatMap(pick => pick.option.itemIds)
      const later = laterSlots(options, core, taken, items.value)
      const laterAnswers = later.length
        ? await askJev(stateOf({ ...base, taken: firstPicks.filter(pick => pick.option.itemIds.length).map(pick => pick.option.label) }), questionsOf(later))
        : {}
      if (mine !== generation) return
      picks.value = [...firstPicks, ...settle(later, laterAnswers, items.value, taken)]
      calls.value = jevTrace.slice(traced)
      elapsedMs.value = Math.round(performance.now() - started)
      status.value = 'ready'
    }
    catch (failure) {
      if (mine !== generation) return
      error.value = failure instanceof Error ? failure.message : String(failure)
      status.value = 'error'
    }
  }

  return { status, error, picks, rules, elapsedMs, calls, ask }
}
