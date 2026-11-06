import type { DraftBans, DraftCandidate, DraftRecommendation, DraftSuggestionItem } from '~/types/draft'
import type { DraftState } from '~/types/lcu'
import type { RankedPick } from '~/utils/jev-recommend'
import type { WeightedScore } from '~/utils/draft-weights'
import { COMFORT_GAMES } from '~/utils/draft-comfort'
import { shiftOf } from '~/utils/draft-experience'
import { clearsMastery, comfortScore, weightedScore } from '~/utils/draft-weights'

/**
 * The cards of the Suggestions tab, in the order they are shown: on our ban
 * turn the bans as the source ranked them; on our pick, Jev's order once Jev
 * answered, else the source's candidates re-ranked by the player's suggestion
 * weights (`useSuggestionWeights`, Blitz's "Suggestion Weights") and kept to
 * the champions that clear the mastery floor — each with its score, part by
 * part, for the card's breakdown.
 *
 * Comfort is read from the player's own client: the mastery it lists, and
 * their latest games (the comfort line's twenty) for the games, the wins and
 * the last time on the champion. The meta category reads the tier list's win
 * rate moved by Blitz's experience shift (`useExperienceShifts`) — the
 * player's own experience stays comfort's —, and the counter category gives up
 * the counter-pick risk while the lane opponent is still to come (`useDraftRisk`).
 */
export function useDraftSuggestionItems(
  draft: Ref<DraftState>,
  recommendation: Ref<DraftRecommendation | null>,
  bans: Ref<DraftBans | null>,
  kind: Ref<'pick' | 'ban'>,
  jev: { scores: Ref<Map<number, RankedPick> | null>, ranked: Ref<RankedPick[]> },
) {
  const { settings } = useSuggestionWeights()
  const { entryOf } = useTierList()
  const { nameOf } = useChampionStatics()
  const { state: lcu } = useLcuState()
  const { games } = usePlayerRecord()
  const shifts = useExperienceShifts()
  const risks = useDraftRisk(draft, recommendation, computed(() => kind.value === 'pick' && !jev.scores.value))

  const mastery = computed(() => new Map((lcu.value.championMastery ?? []).map(entry => [entry.championId, entry])))
  const topLevel = computed(() => Math.max(0, ...(lcu.value.championMastery ?? []).map(entry => entry.championLevel)))
  const recent = computed(() => games.value.filter(game => !game.remake).slice(0, COMFORT_GAMES))

  function comfortOf(championId: number, position: string): number | null {
    const own = mastery.value.get(championId)
    const on = recent.value.filter(game => game.championId === championId)
    return comfortScore({
      points: own?.championPoints ?? null,
      level: own?.championLevel ?? null,
      // Without a history read, the games are unknown rather than none.
      games: recent.value.length ? on.length : null,
      wins: on.filter(game => game.win).length,
      lastPlayedAt: Math.max(own?.lastPlayTime ?? 0, ...on.map(game => game.playedAt)) || null,
      expectedWinRate: entryOf(championId, position)?.winRate ?? null,
    })
  }

  const item = (candidate: DraftCandidate): DraftSuggestionItem => ({ championId: candidate.championId, reasons: candidate.reasons ?? [], thin: candidate.thinSample })

  /** Every pick the source ranked, scored by the player's weights, the ones under the mastery floor left out. */
  const scored = computed(() => {
    const position = draft.value.myPosition
    const weights = settings.value.weights
    return (recommendation.value?.candidates ?? [])
      .filter(candidate => clearsMastery(mastery.value.get(candidate.championId)?.championLevel, topLevel.value, settings.value.minMastery))
      .map((candidate) => {
        const entry = entryOf(candidate.championId, position)
        return {
          candidate,
          score: weightedScore({
            winRate: entry ? entry.winRate + shiftOf(shifts.value, candidate.championId, position) : null,
            games: entry?.games ?? 0,
            matchupDelta: candidate.matchupDelta,
            matchupGames: candidate.matchupGames,
            synergyDelta: candidate.synergyDelta,
            synergyGames: candidate.synergyGames,
            comfort: comfortOf(candidate.championId, position),
            counterRisk: risks.value.get(candidate.championId) ?? 0,
          }, weights),
        }
      })
      .sort((a, b) => b.score.total - a.score.total || b.score.parts.comfort.points - a.score.parts.comfort.points || nameOf(a.candidate.championId).localeCompare(nameOf(b.candidate.championId)))
  })

  /** Each weighted pick's score, by champion — absent while Jev's order is the one shown. */
  const weighted = computed(() => (kind.value === 'pick' && !jev.scores.value ? new Map<number, WeightedScore>(scored.value.map(entry => [entry.candidate.championId, entry.score])) : null))

  const shownPicks = computed<DraftSuggestionItem[]>(() => {
    if (kind.value === 'ban') return (bans.value?.candidates ?? []).map(candidate => ({ championId: candidate.championId, reasons: candidate.reasons, thin: false }))
    if (!jev.scores.value) return scored.value.map(entry => item(entry.candidate))
    const byId = new Map((recommendation.value?.candidates ?? []).map(candidate => [candidate.championId, item(candidate)]))
    return jev.ranked.value.map(pick => byId.get(pick.championId) ?? { championId: pick.championId, reasons: [], thin: false })
  })

  return { shownPicks, weighted }
}
