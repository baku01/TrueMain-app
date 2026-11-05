<script setup lang="ts">
import { formatCount } from '#shared/utils/counts'
import { formatPercentage } from '#shared/utils/ddragon'
import type { DraftReason } from '~/types/draft'
import type { TierEntry } from '~/composables/useTierList'
import type { DamageNote } from '~/utils/draft-damage'
import type { RankedPick } from '~/utils/jev-recommend'
import { PICK_WEIGHTS } from '~/utils/jev-recommend'

/**
 * One suggested pick or ban, as Blitz draws a suggestion: the champion's
 * square portrait ringed in its tier's colour, its tier over the portrait's
 * edge, its name, its rank and its leading reason, the splash faint behind;
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
 * never scored.
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
}>()

const { nameOf, portraitOf } = useChampionStatics()
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

const tierColor = computed(() => {
  const letter = props.entry?.tier?.toLowerCase()
  return letter && 'sabcd'.includes(letter) ? `var(--color-tier-${letter})` : 'transparent'
})

/** Jev's score, part by part: each part's share of the weight that counted, and the points it brings. */
const breakdown = computed(() => {
  const parts = props.jev?.parts
  if (!parts) return []
  const present = (['stats', 'lane', 'team', 'enemy'] as const).filter(part => parts[part] !== undefined)
  const weight = present.reduce((sum, part) => sum + PICK_WEIGHTS[part], 0)
  return present.map(part => ({ part, value: parts[part]!, weight: PICK_WEIGHTS[part] / weight, points: (PICK_WEIGHTS[part] / weight) * parts[part]! * 100 }))
})
</script>

<template>
  <div
    class="group relative flex h-full flex-col items-center gap-1 overflow-hidden rounded-2xl bg-elevated px-2 pb-4 pt-7 text-center transition-[box-shadow,opacity]"
    :class="focused ? 'ring-2 ring-primary' : 'ring-1 ring-white/5'"
    :title="why"
  >
    <!-- The splash, blurred and faint, behind the card. -->
    <ChampionArt :champion-id="championId" kind="splash" fade="none" position="50% 20%" class="absolute inset-0 scale-110 opacity-15 blur-[10px]" />

    <!-- The score in the corner: Jev's in its ring, its breakdown on hover; else the leading reason's figure. -->
    <div class="absolute right-2 top-2 z-10">
      <UTooltip v-if="jev" :content="{ side: 'top' }" :delay-duration="100">
        <span class="flex items-center gap-1 rounded-md bg-ink-950/50 px-1.5 py-0.5">
          <svg viewBox="0 0 20 20" class="size-4 -rotate-90"><circle cx="10" cy="10" r="8" fill="none" stroke-width="3" class="stroke-white/15" /><circle cx="10" cy="10" r="8" fill="none" stroke-width="3" stroke-linecap="round" class="stroke-primary" :stroke-dasharray="`${50.27 * jev.total} 50.27`" /></svg>
          <span class="text-xs font-bold tabular-nums text-highlighted">{{ Math.round(jev.total * 100) }}</span>
        </span>
        <template #content>
          <div class="flex w-64 flex-col gap-1.5 rounded-md bg-default p-2 ring-1 ring-default">
            <p class="text-xs font-semibold text-highlighted">{{ t('jev.pick.breakdown') }}</p>
            <div class="grid grid-cols-[minmax(0,1fr)_2.75rem_3rem] gap-x-2 gap-y-1 text-[11px] tabular-nums">
              <span class="text-dimmed">{{ t('jev.pick.signal') }}</span>
              <span class="text-right text-dimmed">{{ t('jev.pick.weight') }}</span>
              <span class="text-right text-dimmed">{{ t('jev.pick.points') }}</span>
              <template v-for="row in breakdown" :key="row.part">
                <span class="truncate text-muted" :title="t(`jev.pick.part.${row.part}.hint`)">{{ t(`jev.pick.part.${row.part}`) }} · {{ Math.round(row.value * 100) }}</span>
                <span class="text-right text-muted">{{ Math.round(row.weight * 100) }}%</span>
                <span class="text-right font-semibold text-highlighted">{{ Math.round(row.points) }}</span>
              </template>
            </div>
            <p v-if="jev.confidence !== null" class="text-[10px] text-dimmed">{{ t('jev.card.confidence', { value: `${Math.round(jev.confidence * 100)}%` }) }}</p>
          </div>
        </template>
      </UTooltip>
      <span v-else-if="lead" class="text-sm font-bold tabular-nums" :class="tone">{{ lead.headline }}<span class="text-[10px]"> {{ lead.unit }}</span></span>
      <span v-else-if="entry" class="text-sm font-bold tabular-nums" :class="tone">{{ formatPercentage(entry.winRate) }}<span class="text-[10px]"> {{ t('draft.card.wr') }}</span></span>
    </div>
    <div v-if="$slots.action" class="absolute left-2 top-2 z-10">
      <slot name="action" />
    </div>

    <span class="relative">
      <img v-if="portraitOf(championId)" :src="portraitOf(championId)!" :alt="nameOf(championId)" class="img-skeleton size-14 rounded-2xl ring-2" :class="thin && 'opacity-70'" :style="{ '--tw-ring-color': tierColor }">
      <TierBadge v-if="entry" :caption="false" :size="24" :tier="entry.tier" class="absolute -bottom-2.5 left-1/2 -translate-x-1/2" />
    </span>
    <p class="relative mt-2.5 w-full truncate text-base font-semibold text-highlighted">{{ nameOf(championId) }}</p>
    <p class="relative text-[11px] text-muted">{{ t('draft.card.rank', { n: rank }) }}</p>
    <p v-if="lead && !jev" class="relative w-full truncate text-[11px] leading-tight text-dimmed">{{ lead.short }}</p>
    <UBadge v-if="lead && thin" color="neutral" variant="soft" size="sm" class="relative">{{ t('draft.card.fewGames') }}</UBadge>
    <span
      v-if="note"
      class="relative flex items-center gap-1 whitespace-nowrap rounded bg-ink-950/70 px-1.5 py-0.5 text-[10px] font-medium leading-none ring-1 ring-white/10"
      :class="note.adds === 'magic' ? 'text-stat-mr' : 'text-stat-ad'"
    >
      <UIcon name="i-lucide-plus" class="size-2.5" />{{ note.adds === 'magic' ? t('draft.card.addsMagic') : t('draft.card.addsPhysical') }}
    </span>
    <p class="relative mt-auto pt-1 text-xs font-semibold text-dimmed transition-colors group-hover:text-highlighted">{{ t('draft.card.cta') }}</p>
    <slot />
  </div>
</template>
