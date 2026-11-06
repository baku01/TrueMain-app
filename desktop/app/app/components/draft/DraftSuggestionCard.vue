<script setup lang="ts">
import { formatCount } from '#shared/utils/counts'
import { formatPercentage } from '#shared/utils/ddragon'
import type { DraftReason } from '~/types/draft'
import type { TierEntry } from '~/composables/useTierList'
import type { DamageNote } from '~/utils/draft-damage'
import type { RankedPick } from '~/utils/jev-recommend'
import { PICK_WEIGHTS } from '~/utils/jev-recommend'
import type { WeightedScore } from '~/utils/draft-weights'
import { WEIGHT_KEYS } from '~/utils/draft-weights'

/**
 * One suggested pick or ban as a poster (the splash, framed on the face, the rank a large numeral, the name in capitals over the floor): the champion's loading art whole,
 * its rank as a large faint numeral, its tier, name and leading reason over
 * the art's floor;
 * the leading reason's figure in the corner, every reason on hover (#1906) —
 * or, when Jev ranked it, Jev's score in a ring with its breakdown on hover. The figures are the draft
 * endpoint's — a measured delta in win-rate points or a rate, never the
 * ranking score, which is not a number to read. On the card in focus, its lane
 * numbers from the tier list.
 *
 * The default slot covers the card (the click that previews its build); the
 * `action` slot sits over the art's corner, above it (the hover or ban control).
 * A pick that answers a one-sided team's damage mix carries a note (#1907), and
 * the player's own recent games on it are said on hover (#1906) — both said,
 * never scored. Ranked by the player's suggestion weights instead
 * (`weighted`, Blitz's "Suggestion Weights"), it carries that score in the
 * same ring, its four categories on hover, each with its weight and points.
 */
const props = defineProps<{
  championId: number
  /** The facts behind the suggestion, strongest first. */
  reasons: DraftReason[]
  /** Few games behind every reason: drawn as unproven. */
  thin: boolean
  /** Our lane, for the reasons' wording. */
  position: string
  entry: TierEntry | null
  focused: boolean
  /** Its place among the suggestions, from 1. */
  rank: number
  /** Jev's score of the pick, when Jev ranked it. */
  jev?: RankedPick | null
  /** What the pick does to our team's damage mix, when it answers it. */
  note?: DamageNote | null
  /** The player's own recent games on the champion, from their client — said, never scored. */
  comfort?: string | null
  /** Its score under the player's suggestion weights, when those order the picks. */
  weighted?: WeightedScore | null
}>()

const { nameOf } = useChampionStatics()
const { t } = useT()

const texts = computed(() => props.reasons.map(reason => describeReason(reason, nameOf, props.position)))
const lead = computed(() => texts.value[0] ?? null)

const tone = computed(() => {
  if (!lead.value) return winRateTone(props.entry?.winRate ?? null)
  if (props.thin) return 'text-dimmed'
  return { good: 'text-data-good', bad: 'text-data-bad', neutral: 'text-highlighted' }[lead.value.tone]
})

/** Every reason, one per line — the hover says what the line under the name only starts. */
const why = computed(() => {
  const note = props.note?.text ?? null
  const comfort = props.comfort ?? null
  if (!texts.value.length) {
    const lane = props.entry ? t('draft.card.laneWinRate', { rate: formatPercentage(props.entry.winRate), games: formatCount(props.entry.games) }) : null
    return [lane, note, comfort].filter(Boolean).join('\n') || undefined
  }
  return [...texts.value.map(text => text.full), props.thin ? t('draft.card.fewGamesBehind') : null, note, comfort].filter(Boolean).join('\n')
})

/** The ring's score: Jev's, else the weighted one; 0–1. */
const score = computed(() => props.jev?.total ?? props.weighted?.total ?? null)

/** The score, part by part: each part's share of the weight that counted, and the points it brings. */
const breakdown = computed(() => {
  const parts = props.jev?.parts
  if (!parts) {
    const weighted = props.weighted?.parts
    return weighted
      ? WEIGHT_KEYS.map(key => ({ key, label: t(`draft.weights.part.${key}`), hint: t(`draft.weights.part.${key}.hint`), ...weighted[key], points: weighted[key].points * 100 }))
      : []
  }
  const present = (['stats', 'lane', 'team', 'enemy'] as const).filter(part => parts[part] !== undefined)
  const weight = present.reduce((sum, part) => sum + PICK_WEIGHTS[part], 0)
  return present.map(part => ({ key: part, label: t(`jev.pick.part.${part}`), hint: t(`jev.pick.part.${part}.hint`), value: parts[part]!, weight: PICK_WEIGHTS[part] / weight, points: (PICK_WEIGHTS[part] / weight) * parts[part]! * 100 }))
})
</script>

<template>
  <div
    class="group relative h-52 overflow-hidden rounded-lg @5xl:h-64 bg-elevated transition-[box-shadow,transform] duration-300 [animation:tm-rise_420ms_var(--tm-ease)_backwards] hover:-translate-y-0.5"
    :class="focused ? 'ring-2 ring-primary shadow-[0_12px_40px_-16px_var(--ui-primary)]' : 'ring-1 ring-white/8'"
    :style="{ animationDelay: `${(rank - 1) * 55}ms` }"
    :title="why"
  >
    <ChampionArt :champion-id="championId" kind="splash" fade="none" position="50% 18%" class="absolute inset-0 transition duration-500 group-hover:scale-[1.04]" :class="thin && 'opacity-70'" />
    <div class="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/55 via-40% to-transparent to-75%" />

    <!-- The score: Jev's in its ring, its breakdown on hover; else the leading reason's figure. -->
    <div class="absolute right-2 top-2 z-10">
      <UTooltip v-if="score !== null" :content="{ side: 'top' }" :delay-duration="100">
        <span class="flex items-center gap-1 rounded-md bg-ink-950/70 px-1.5 py-1 ring-1 ring-white/10 backdrop-blur">
          <svg viewBox="0 0 20 20" class="size-4 -rotate-90"><circle cx="10" cy="10" r="8" fill="none" stroke-width="3" class="stroke-white/15" /><circle cx="10" cy="10" r="8" fill="none" stroke-width="3" stroke-linecap="round" class="stroke-primary" :stroke-dasharray="`${50.27 * score} 50.27`" /></svg>
          <span class="font-display text-xs font-bold tabular-nums text-white">{{ Math.round(score * 100) }}</span>
        </span>
        <template #content>
          <div class="flex w-64 flex-col gap-1.5 rounded-md bg-default p-2 ring-1 ring-default">
            <p class="text-xs font-semibold text-highlighted">{{ jev ? t('jev.pick.breakdown') : t('draft.weights.breakdown') }}</p>
            <div class="grid grid-cols-[minmax(0,1fr)_2.75rem_3rem] gap-x-2 gap-y-1 text-[11px] tabular-nums">
              <span class="text-dimmed">{{ t('jev.pick.signal') }}</span>
              <span class="text-right text-dimmed">{{ t('jev.pick.weight') }}</span>
              <span class="text-right text-dimmed">{{ t('jev.pick.points') }}</span>
              <template v-for="row in breakdown" :key="row.key">
                <span class="truncate text-muted" :title="row.hint">{{ row.label }} · {{ Math.round(row.value * 100) }}</span>
                <span class="text-right text-muted">{{ Math.round(row.weight * 100) }}%</span>
                <span class="text-right font-semibold text-highlighted">{{ Math.round(row.points) }}</span>
              </template>
            </div>
            <p v-if="jev && jev.confidence !== null" class="text-[10px] text-dimmed">{{ t('jev.card.confidence', { value: `${Math.round(jev.confidence * 100)}%` }) }}</p>
          </div>
        </template>
      </UTooltip>
      <span v-else-if="lead" class="block rounded-md bg-ink-950/70 px-1.5 py-1 font-display text-xs font-bold tabular-nums ring-1 ring-white/10 backdrop-blur" :class="tone">{{ lead.headline }}<span class="text-[9px]"> {{ lead.unit }}</span></span>
      <span v-else-if="entry" class="block rounded-md bg-ink-950/70 px-1.5 py-1 font-display text-xs font-bold tabular-nums ring-1 ring-white/10 backdrop-blur" :class="tone">{{ formatPercentage(entry.winRate) }}</span>
    </div>
    <div v-if="$slots.action" class="absolute left-2 top-2 z-10">
      <slot name="action" />
    </div>

    <!-- The rank, large and faint, behind the name. -->
    <span class="pointer-events-none absolute -right-1 bottom-6 font-display text-[4.5rem] font-extrabold leading-none tracking-tighter text-white/[0.07] tabular-nums">{{ String(rank).padStart(2, '0') }}</span>

    <div class="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-3">
      <div class="flex items-center gap-1.5">
        <TierBadge v-if="entry" :caption="false" :size="18" :tier="entry.tier" />
        <p class="min-w-0 flex-1 truncate font-display text-[13px] font-bold uppercase tracking-[0.06em] text-white">{{ nameOf(championId) }}</p>
      </div>
      <p v-if="lead && !jev" class="truncate text-[11px] leading-tight text-white/60">{{ lead.short }}</p>
      <div v-if="(lead && thin) || note" class="flex flex-wrap gap-1">
        <UBadge v-if="lead && thin" color="neutral" variant="soft" size="sm">{{ t('draft.card.fewGames') }}</UBadge>
        <span v-if="note" class="flex items-center gap-1 whitespace-nowrap rounded bg-ink-950/70 px-1.5 py-0.5 text-[10px] font-medium leading-none ring-1 ring-white/10" :class="note.adds === 'magic' ? 'text-stat-mr' : 'text-stat-ad'">
          <UIcon name="i-lucide-plus" class="size-2.5" />{{ note.adds === 'magic' ? t('draft.card.addsMagic') : t('draft.card.addsPhysical') }}
        </span>
      </div>
      <p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/0 transition-colors duration-200 group-hover:text-primary">{{ t('draft.card.cta') }}</p>
    </div>
    <slot />
  </div>
</template>
