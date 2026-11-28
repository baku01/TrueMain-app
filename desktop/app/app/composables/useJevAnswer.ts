import type { Outcome, Shown } from '~/utils/jev-answers'
import { IDLE, answerMemory } from '~/utils/jev-answers'
import { failureOf } from '~/utils/jev-ask'

/** Whose answer it is (`id`) and the board it is asked on (`key`, only what Jev reads of it). */
export interface AnswerSubject { id: string, key: string }

/**
 * A Jev answer on screen for the subject on screen (`utils/jev-answers`): kept
 * per subject for this champion select, shown `stale` once the board it was
 * asked on moved, and asked once at a time — `loading` is set before anything
 * is awaited, so a double click pays once.
 */
export function useJevAnswer<T>(subject: () => AnswerSubject | null) {
  const memory = answerMemory<T>()
  const shown = shallowRef<Shown<T>>(IDLE)

  function refresh() {
    const current = subject()
    shown.value = current ? memory.shown(current.id, current.key) : IDLE
  }
  watch(() => {
    const current = subject()
    return current ? `${current.id}\n${current.key}` : ''
  }, refresh)

  /** Asks for the subject on screen; `work` reads the board before its first await, and its outcome is kept for that board. */
  async function run(work: () => Promise<Outcome<T>>) {
    const current = subject()
    if (!current || !memory.start(current.id)) return
    refresh()
    let outcome: Outcome<T>
    try {
      outcome = await work()
    }
    catch (error) {
      outcome = { status: 'error', failure: failureOf(error) }
    }
    memory.settle(current.id, current.key, outcome)
    refresh()
  }

  return {
    status: computed(() => shown.value.status),
    answer: computed(() => shown.value.answer),
    failure: computed(() => shown.value.failure),
    partial: computed(() => shown.value.partial),
    stale: computed(() => shown.value.status !== 'loading' && shown.value.stale),
    run,
  }
}
