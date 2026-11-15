import type { BuildSubject } from '~/composables/useDraftBuild'
import type { DraftItemPush } from '~/utils/draft-damage'
import type { SourceBuildStep } from '~/utils/draft-build'
import { draftBuildFromOptions, enemySituation, proShares } from '~/utils/draft-build'
import { readProMatches } from '~/utils/blitz/pro'
import { activeProvider } from '~/utils/sources'

/** One item of the build for this draft, and the situation that put it there when the draft did. */
export interface DraftBuildStep {
  itemId: number
  isBoots: boolean
  /** The games the sources measured the item in. */
  games?: number
  /** The share of the latest pro games on the champion and lane it was finished in; absent without pro games. */
  pros?: number | null
  /** The enemy or lane situation that moved it up; null when it is the standard pick at its step. */
  reason: { axis: string, bucket: 'High' | 'Low' } | null
}

/** Picks land in bursts at the end of a phase: wait for the board to settle before asking. */
const SETTLE_MS = 400

/**
 * The items this draft moves the mains toward (#1907): the in-game next-item
 * read (#1749) asked at draft time, with an empty inventory and the draft as
 * the game — the same axes (enemy damage mix, crowd control, sustain…), the
 * same measured model, before the first item is bought. The boots and the
 * first legendary, each only when a situation of this draft moves one up.
 *
 * And the whole build for this draft (`build`): the same read asked step by
 * step, each time with the items before it as held — the boots, then five
 * completed items, each the one the mains take most in a game like this one
 * from there. An item the draft moved up says which situation did.
 */
export function useDraftItemAdvice(subject: Ref<BuildSubject | null>) {
  const pushes = ref<DraftItemPush[]>([])
  const pending = ref(false)
  const build = ref<DraftBuildStep[]>([])
  const buildPending = ref(false)
  const { champions } = useChampionStatics()
  const { items } = useStaticData()

  let generation = 0
  let settle: ReturnType<typeof setTimeout> | undefined

  /**
   * The build from what the sources measured for the champion
   * (`utils/draft-build.ts`), read against the enemy team from Riot's champion
   * data. TrueMain's model is never asked.
   */
  async function fromSource(mine: number, current: BuildSubject) {
    pending.value = true
    buildPending.value = true
    try {
      const opponent = current.request.enemies.find(enemy => enemy.position === current.request.position)?.championId ?? null
      const [options, pro] = await Promise.all([
        activeProvider()!.options(current.championId, current.request.position, opponent),
        // The pros' games are Blitz's, whatever the source: none of the others lists them.
        readProMatches(current.championId, current.request.position).catch(() => []),
      ])
      if (mine !== generation) return
      const situations = enemySituation(current.request.enemies.map(enemy => enemy.championId), champions.value, opponent)
      const steps = options ? draftBuildFromOptions(options, situations, items.value, proShares(pro, opponent, items.value)) : []
      build.value = steps.map(step => ({ itemId: step.itemId, isBoots: step.isBoots, games: step.games, pros: step.pros, reason: step.reason }))
      // The pushes the build panel marks: the boots and the first item the draft moved.
      const pushOf = (slot: 'boots' | 'build', step: SourceBuildStep | undefined): DraftItemPush | null =>
        step?.reason ? { slot, itemId: step.itemId, share: 0, baseShare: 0, reason: step.reason } : null
      pushes.value = [pushOf('boots', steps.find(step => step.isBoots)), pushOf('build', steps.find(step => !step.isBoots && step.reason))]
        .filter((push): push is DraftItemPush => push !== null)
    }
    catch {
      if (mine === generation) {
        build.value = []
        pushes.value = []
      }
    }
    finally {
      if (mine === generation) {
        pending.value = false
        buildPending.value = false
      }
    }
  }

  watch(() => (subject.value ? JSON.stringify(subject.value) : ''), (key) => {
    clearTimeout(settle)
    // A new draft outdates any answer still out for the previous one, settle window included.
    ++generation
    const current = subject.value
    // With nobody else on the board there is no situation to read.
    if (!key || !current || current.request.enemies.length + current.request.allies.length === 0) {
      pushes.value = []
      pending.value = false
      build.value = []
      buildPending.value = false
      return
    }
    const mine = generation
    settle = setTimeout(() => void fromSource(mine, current), SETTLE_MS)
  }, { immediate: true })

  onScopeDispose(() => clearTimeout(settle))

  return { pushes, pending, build, buildPending }
}
