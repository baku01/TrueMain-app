import type { EnemyAssessment } from '~/composables/useJevEnemies'
import type { PickRead } from '~/utils/jev-read'
import type { RankedPick } from '~/utils/jev-recommend'
import { askJev, jevKeyStatus } from '~/utils/jev'
import { batches, enemyRequest, pickRequest, readPick } from '~/utils/jev-read'
import { rankPicks } from '~/utils/jev-recommend'

/** The draft a pick is chosen for. */
export interface PickSubject {
  position: string
  opponentId: number | null
  allies: number[]
  /** The enemies so far, each on the lane the draft reads it on. */
  enemies: { championId: number, position: string | null }[]
  /** The source's candidates for our lane, best first, with its ranking key. */
  candidates: { championId: number, score: number }[]
}

export type JevPickStatus = 'idle' | 'loading' | 'ready' | 'noKey' | 'noCandidates' | 'error'

/** How many of the source's candidates Jev reads: the best of them, a state small enough to read well. */
const ASKED = 8

/**
 * Champion select's pick with Jev, on the player's click — its calls are
 * paid. The source's best candidates for our lane are read by Jev against the
 * lane opponent, with our team and against the enemy team
 * (`utils/jev-read`'s `pickRequest`), and ranked with the source's own
 * ranking (`rankPicks`); the enemy kits are read too, for what the enemy team
 * throws at us (`useJevEnemies`). A new draft drops the last answer.
 */
export function useJevPick(subject: Ref<PickSubject | null>) {
  const { textOf, loadAll } = useChampionTexts()
  const reader = useJevEnemies()
  const assessment = ref<EnemyAssessment | null>(null)
  const status = ref<JevPickStatus>('idle')
  const error = ref<string | null>(null)
  const ranked = ref<RankedPick[]>([])
  let generation = 0

  // A new draft drops the last answer; the same draft recomputed (the clock ticks) keeps it.
  watch(() => JSON.stringify(subject.value), () => {
    generation++
    status.value = 'idle'
    ranked.value = []
    assessment.value = null
  })

  async function ask() {
    const current = subject.value
    if (!current) return
    const mine = ++generation
    if (!(await jevKeyStatus().catch(() => ({ set: false }))).set) return void (status.value = 'noKey')
    const candidates = current.candidates.slice(0, ASKED)
    if (!candidates.length) return void (status.value = 'noCandidates')
    status.value = 'loading'
    error.value = null
    try {
      const enemyIds = current.enemies.map(enemy => enemy.championId)
      await Promise.all([loadAll([...candidates.map(candidate => candidate.championId), ...current.allies, ...enemyIds]), reader.load()])
      const texts = (ids: number[], chars: number) => ids.map(id => textOf(id, chars)).filter(text => !!text)
      const request = pickRequest({
        position: current.position,
        opponent: current.opponentId ? textOf(current.opponentId, 360) : null,
        allies: texts(current.allies, 260),
        enemies: texts(enemyIds.filter(id => id !== current.opponentId), 260),
        candidates: texts(candidates.map(candidate => candidate.championId), 320),
      })
      // The enemy kits too, the ones not read this patch: what the team throws at us is half of the screen.
      const unread = reader.unread(enemyIds)
      const answers = Object.assign({}, ...await Promise.all([...batches(request), ...batches(enemyRequest(unread))].map(part => askJev(part.state, part.questions))))
      if (mine !== generation) return
      const read = new Map(candidates.flatMap(candidate => {
        const pick = readPick(candidate.championId, answers)
        return pick ? [[candidate.championId, pick] as [number, PickRead]] : []
      }))
      ranked.value = rankPicks(candidates, read)
      reader.keep(answers, unread)
      assessment.value = reader.assess(current.enemies, current.opponentId)
      status.value = 'ready'
    }
    catch (failure) {
      if (mine !== generation) return
      error.value = failure instanceof Error ? failure.message : String(failure)
      status.value = 'error'
    }
  }

  return { status, error, ranked, assessment, ask }
}
