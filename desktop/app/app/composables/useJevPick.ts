import type { EnemyAssessment } from '~/composables/useJevEnemies'
import type { Outcome } from '~/utils/jev-answers'
import type { JevAnswer } from '~/utils/jev'
import type { PickBoard, PickRead } from '~/utils/jev-read-pick'
import type { Request } from '~/utils/jev-read'
import type { RankedPick } from '~/utils/jev-recommend'
import { jevKeyStatus } from '~/utils/jev'
import { askBatches, mergeAsked, outcomeOf } from '~/utils/jev-ask'
import { batches } from '~/utils/jev-read'
import { judgeable, keepPickRead, knownPickRead, pickBoardKey, pickReadKey, pickRequest, readPick } from '~/utils/jev-read-pick'
import { rankPicks } from '~/utils/jev-recommend'

/** The draft a pick is chosen for. */
export interface PickSubject {
  position: string
  /** Our lane's opponent, whoever's build is on screen: the pick is ours. */
  opponentId: number | null
  allies: number[]
  /** The enemies so far, each on the lane the draft reads it on. */
  enemies: { championId: number, position: string | null }[]
  /** The source's candidates for our lane, best first, with its ranking key. */
  candidates: { championId: number, score: number }[]
}

/** What a pick answer keeps: Jev's reads of the candidates — ranked again on the source's latest scores — and the enemy team as read. */
interface PickAnswer { reads: Map<number, PickRead>, assessment: EnemyAssessment }

/** How many of the source's candidates Jev reads: the best of them, a state small enough to read well. */
const ASKED = 8

/** What Jev reads of a pick's draft. */
export const boardOf = (subject: PickSubject): PickBoard => ({
  position: subject.position,
  opponentId: subject.opponentId,
  allies: subject.allies,
  enemyIds: subject.enemies.map(enemy => enemy.championId),
})

/**
 * The board a pick answer was asked on: what Jev read and the candidates it
 * read. Not the source's scores — an ally's hover, the bracket or a ban moves
 * them, and they are ranked again under the answer, not asked again.
 */
export const pickKey = (subject: PickSubject) =>
  `${pickBoardKey(boardOf(subject))}|${subject.candidates.slice(0, ASKED).map(candidate => candidate.championId).sort((a, b) => a - b).join(',')}`

/**
 * Champion select's pick with Jev, on the player's click — its calls are
 * paid. The source's best candidates for our lane are read by Jev against the
 * lane opponent, with our team and against the enemy team
 * (`utils/jev-read`'s `pickRequest`), and ranked with the source's own
 * ranking (`rankPicks`); the enemy kits are read too, for what the enemy team
 * throws at us (`useJevEnemies`). A board that moves leaves the answer
 * `stale` (`useJevAnswer`); a candidate already read on this board is not
 * asked again, and a first pick — nothing to judge against — is not asked.
 */
export function useJevPick(subject: Ref<PickSubject | null>) {
  const { patch } = useChampionStatics()
  const { textOf, loadAll } = useChampionTexts()
  const reader = useJevEnemies()
  const jev = useJevAnswer<PickAnswer>(() => (subject.value ? { id: `pick:${subject.value.position}`, key: pickKey(subject.value) } : null))
  const memo = new Map<string, Record<string, JevAnswer>>()
  /** Whether Jev has anything to judge: an opponent, a locked ally or an enemy. */
  const canAsk = computed(() => !!subject.value && judgeable(boardOf(subject.value)))
  const ranked = computed<RankedPick[]>(() => (jev.answer.value && subject.value ? rankPicks(subject.value.candidates.slice(0, ASKED), jev.answer.value.reads) : []))
  const assessment = computed(() => jev.answer.value?.assessment ?? null)

  const ask = () => jev.run(async (): Promise<Outcome<PickAnswer>> => {
    const current = subject.value!
    const board = boardOf(current)
    const candidates = current.candidates.slice(0, ASKED)
    if (!candidates.length) return { status: 'noCandidates' }
    if (!judgeable(board)) return { status: 'nothing' }
    if (!(await jevKeyStatus().catch(() => ({ set: false }))).set) return { status: 'noKey' }
    const version = patch.value || 'live'
    const keyOf = (id: number) => pickReadKey(version, board, id)
    const unread = candidates.map(candidate => candidate.championId).filter(id => !knownPickRead(keyOf(id)))
    await Promise.all([loadAll([...unread, ...current.allies, ...board.enemyIds]), reader.load()])
    const texts = (ids: number[], chars: number) => ids.map(id => textOf(id, chars)).filter(text => !!text)
    const request = pickRequest({
      position: current.position,
      opponent: current.opponentId ? textOf(current.opponentId, 360) : null,
      allies: texts(current.allies, 260),
      enemies: texts(board.enemyIds.filter(id => id !== current.opponentId), 260),
      candidates: texts(unread, 320),
    })
    // The enemy kits too, the ones not read this patch: what the team throws at us is half of the screen.
    const askAll = (parts: Request[]) => askBatches(parts, { memo })
    const asked = mergeAsked(...await Promise.all([askAll(batches(request)), reader.read(board.enemyIds, askAll)]))
    for (const id of unread) {
      const read = readPick(id, asked.answers)
      if (read) keepPickRead(keyOf(id), read)
    }
    const { failure, partial } = outcomeOf(asked)
    if (failure && !partial) return { status: 'error', failure }
    if (!partial) memo.clear()
    const reads = new Map(candidates.flatMap(({ championId }) => {
      const read = knownPickRead(keyOf(championId))
      return read ? [[championId, read] as [number, PickRead]] : []
    }))
    return { status: 'ready', partial, failure, answer: { reads, assessment: reader.assess(current.enemies, current.opponentId) } }
  })

  return { status: jev.status, failure: jev.failure, partial: jev.partial, stale: jev.stale, canAsk, ranked, assessment, ask }
}
