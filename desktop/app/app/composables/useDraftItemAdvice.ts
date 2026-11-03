import type { BuildSubject } from '~/composables/useDraftBuild'
import type { NextItemRequest, NextItemResponse } from '~/utils/next-item'
import type { DraftItemPush } from '~/utils/draft-damage'
import { draftPush, isDraftReason, PUSH_MIN_RATIO } from '~/utils/draft-damage'

/** How many completed items the draft's build runs to, the boots apart. */
const BUILD_ITEMS = 5

/** One item of the build for this draft, and the situation that put it there when the draft did. */
export interface DraftBuildStep {
  itemId: number
  isBoots: boolean
  share: number
  baseShare: number
  /** The enemy or lane situation that moved it up; null when it is the standard pick at its step. */
  reason: { axis: string, bucket: 'High' | 'Low' } | null
}

/** The candidate a step settles on — the most taken in a draft like this one — with its reason when the draft moved it. */
function stepOf(slot: NextItemResponse['build'], isBoots: boolean, skip: ReadonlySet<number>): DraftBuildStep | null {
  const best = [...(slot?.candidates ?? [])].filter(candidate => !skip.has(candidate.itemId)).sort((a, b) => b.share - a.share)[0]
  if (!best) return null
  const reason = best.share >= best.baseShare * PUSH_MIN_RATIO ? best.reasons.find(entry => isDraftReason(entry.axis)) ?? null : null
  return { itemId: best.itemId, isBoots, share: best.share, baseShare: best.baseShare, reason: reason ? { axis: reason.axis, bucket: reason.bucket } : null }
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

  let generation = 0
  let settle: ReturnType<typeof setTimeout> | undefined

  async function ask(current: BuildSubject) {
    const mine = ++generation
    const body: NextItemRequest = {
      position: current.request.position,
      items: [],
      allies: current.request.allies,
      enemies: current.request.enemies,
    }
    pending.value = true
    try {
      const answer = await apiPost<NextItemResponse>(`/champions/${current.championId}/next-item`, body, {}, { background: true })
      if (mine !== generation) return
      pushes.value = [draftPush('boots', answer.boots), draftPush('build', answer.build)].filter((push): push is DraftItemPush => push !== null)
      void walk(mine, current, body, answer)
    }
    catch {
      // Advice that does not load is advice not shown: the build below stands on its own.
      if (mine === generation) pushes.value = []
    }
    finally {
      if (mine === generation) pending.value = false
    }
  }

  /** The build for this draft, a step at a time from the first answer; dropped when the draft changes under it. */
  async function walk(mine: number, current: BuildSubject, body: NextItemRequest, first: NextItemResponse) {
    buildPending.value = true
    const held: number[] = []
    const steps: DraftBuildStep[] = []
    // The boots the draft pushes when it pushes some — the same the advice names — else the most taken.
    const pushedBoots = draftPush('boots', first.boots)
    const boots: DraftBuildStep | null = pushedBoots
      ? { itemId: pushedBoots.itemId, isBoots: true, share: pushedBoots.share, baseShare: pushedBoots.baseShare, reason: pushedBoots.reason }
      : stepOf(first.boots, true, new Set())
    // Where the mains complete the boots in the whole order, when the API gives it: second by default.
    const bootsAt = Math.max(0, first.order?.findIndex(step => step.isBoots) ?? 1)
    let answer: NextItemResponse | null = first
    try {
      while (answer && steps.filter(step => !step.isBoots).length < BUILD_ITEMS) {
        const step = stepOf(answer.build, false, new Set(held))
        if (!step) break
        steps.push(step)
        held.push(step.itemId)
        if (steps.filter(entry => !entry.isBoots).length >= BUILD_ITEMS) break
        answer = await apiPost<NextItemResponse>(`/champions/${current.championId}/next-item`, { ...body, items: [...held, ...(boots ? [boots.itemId] : [])] }, {}, { background: true })
        if (mine !== generation) return
      }
      if (boots) steps.splice(Math.min(bootsAt, steps.length), 0, boots)
      if (mine === generation) build.value = steps
    }
    catch {
      // What was read stands: a build cut short is still the start of one.
      if (mine === generation) build.value = boots ? [...steps.slice(0, bootsAt), boots, ...steps.slice(bootsAt)] : steps
    }
    finally {
      if (mine === generation) buildPending.value = false
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
    settle = setTimeout(() => ask(current), SETTLE_MS)
  }, { immediate: true })

  onScopeDispose(() => clearTimeout(settle))

  return { pushes, pending, build, buildPending }
}
