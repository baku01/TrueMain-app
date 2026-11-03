<script setup lang="ts">
import { formatPercentage } from '#shared/utils/ddragon'
import type { ChampionItemContextAxis } from '#shared/types/item-context'
import type { DraftBuildStep } from '~/composables/useDraftItemAdvice'
import type { DraftItemPush } from '~/utils/draft-damage'
import { ITEM_CONTEXT_TONE_CLASS } from '#shared/utils/item-context'
import { localizedAxisPhrase } from '#common/utils/item-context-phrases'

/**
 * "Build for this draft" (#1907): the whole build the mains go for in a game
 * like this one — the boots at the step they are finished, then the completed
 * items in order, each asked of the in-game next-item read with the ones
 * before it held (`useDraftItemAdvice`). An item this draft's situation moved
 * up is lit, and the situation said under the row in the site's item-context
 * wording — Mercury's Treads against crowd control, an armour item against a
 * physical team. A pushed item the build does not reach is offered as the
 * situational pick. Under each item, the share of the latest pro games on the
 * champion and lane it was finished in.
 *
 * With TrueMain picked in Settings the steps are its next-item model's; with
 * another source, that source's measured build read against the enemy team
 * and the pros (`utils/draft-build.ts`).
 */
const props = defineProps<{ pushes: DraftItemPush[], build?: DraftBuildStep[], pending?: boolean }>()
const { items } = useStaticData()
const SOURCE_NAME: Record<string, string> = { truemain: 'TrueMain', blitz: 'Blitz', opgg: 'op.gg', lolalytics: 'lolalytics', tencent: 'Tencent' }
const sourceName = computed(() => SOURCE_NAME[dataSource.value] ?? dataSource.value)
const { t } = useT()

const name = (itemId: number) => items.value[itemId]?.name ?? t('draft.advice.item', { id: itemId })
const percent = (share: number) => formatPercentage(share, 0)
/** How a step is measured: TrueMain's share in a draft like this one against usually, or the source's games. */
const measureOf = (step: { share?: number, baseShare?: number, games?: number }) =>
  step.share !== undefined && step.baseShare !== undefined
    ? t('draft.advice.vs', { share: percent(step.share), base: percent(step.baseShare) })
    : t('draft.advice.games', { games: (step.games ?? 0).toLocaleString() })
const titleOf = (step: { share?: number, baseShare?: number, games?: number, pros?: number | null }) => [
  step.share !== undefined && step.baseShare !== undefined ? t('draft.advice.title', { share: percent(step.share), base: percent(step.baseShare) }) : measureOf(step),
  step.pros != null ? t('draft.advice.prosTitle', { share: percent(step.pros) }) : null,
].filter(Boolean).join(' · ')
const phraseOf = (reason: { axis: string, bucket: 'High' | 'Low' } | null) =>
  reason ? localizedAxisPhrase({ axis: reason.axis, bucket: reason.bucket } as ChampionItemContextAxis) : null

const steps = computed(() => (props.build ?? []).map(step => ({ ...step, phrase: phraseOf(step.reason) })))
/** The steps the draft moved, with words for why: the lines under the row. */
const reasons = computed(() => steps.value.filter(step => step.phrase))
/** What the draft pushes that the build never reaches: offered beside it. */
const situational = computed(() => props.pushes
  .filter(push => !steps.value.some(step => step.itemId === push.itemId))
  .flatMap((push) => {
    const phrase = phraseOf(push.reason)
    return phrase ? [{ ...push, phrase }] : []
  }))
</script>

<template>
  <section v-if="steps.length || pending" class="space-y-2 rounded-xl bg-elevated/50 p-3 ring-1 ring-default">
    <header class="flex items-center gap-2">
      <UIcon name="i-lucide-swords" class="size-4 text-primary" />
      <h3 class="text-[11px] font-semibold uppercase tracking-wider text-dimmed">{{ t('draft.advice.build') }}</h3>
      <span class="text-[11px] text-dimmed">{{ t('draft.advice.buildHint', { source: sourceName }) }}</span>
    </header>

    <ol v-if="steps.length" class="flex flex-wrap items-center gap-1.5">
      <li v-for="(step, index) in steps" :key="`${step.itemId}-${index}`" class="flex items-center gap-1.5">
        <UIcon v-if="index > 0" name="i-lucide-chevron-right" class="size-3.5 text-dimmed" />
        <span class="relative flex flex-col items-center" :title="titleOf(step)">
          <GameTooltipItemIcon
            :item="items[step.itemId] ?? null"
            :width="36"
            :height="36"
            class="size-9 rounded-md"
            :class="step.phrase ? 'ring-2 ring-primary shadow-[0_0_10px_-2px] shadow-primary/70' : 'ring-1 ring-default'"
          />
          <span v-if="step.phrase" class="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-primary">
            <UIcon name="i-lucide-swords" class="size-2.5 text-inverted" />
          </span>
          <span v-if="step.pros != null" class="mt-0.5 text-[9px] font-semibold leading-none tabular-nums" :class="step.pros >= 0.3 ? 'text-stat-gold' : 'text-dimmed'">PRO {{ percent(step.pros) }}</span>
        </span>
      </li>
      <li v-if="pending" class="ml-1"><UIcon name="i-lucide-loader-circle" class="size-4 animate-spin text-dimmed" /></li>
    </ol>
    <div v-else class="flex gap-1.5" aria-busy="true"><USkeleton v-for="i in 6" :key="i" class="size-9 rounded-md" /></div>

    <ul v-if="reasons.length || situational.length" class="space-y-1 border-t border-default pt-2">
      <li v-for="step in reasons" :key="`why-${step.itemId}`" class="flex items-center gap-2 text-xs">
        <GameTooltipItemIcon :item="items[step.itemId] ?? null" :width="18" :height="18" class="size-[18px] shrink-0 rounded" />
        <span class="shrink-0 font-semibold text-highlighted">{{ name(step.itemId) }}</span>
        <span class="truncate text-muted">
          <template v-for="(token, index) in step.phrase!" :key="index"><span :class="token.tone && ITEM_CONTEXT_TONE_CLASS[token.tone]">{{ token.text }}</span></template>
        </span>
        <span class="ml-auto shrink-0 text-[10px] tabular-nums text-dimmed">{{ measureOf(step) }}</span>
      </li>
      <li v-for="push in situational" :key="`alt-${push.itemId}`" class="flex items-center gap-2 text-xs">
        <GameTooltipItemIcon :item="items[push.itemId] ?? null" :width="18" :height="18" class="size-[18px] shrink-0 rounded ring-1 ring-primary/60" />
        <span class="shrink-0 text-dimmed">{{ t('draft.advice.situational') }}</span>
        <span class="shrink-0 font-semibold text-highlighted">{{ name(push.itemId) }}</span>
        <span class="truncate text-muted">
          <template v-for="(token, index) in push.phrase" :key="index"><span :class="token.tone && ITEM_CONTEXT_TONE_CLASS[token.tone]">{{ token.text }}</span></template>
        </span>
      </li>
    </ul>
  </section>
</template>
