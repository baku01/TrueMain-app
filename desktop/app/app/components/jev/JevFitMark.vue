<script setup lang="ts">
import type { RowFit } from '~/utils/jev-row-fit'

/**
 * A build row's mark once Jev has answered for this draft (`utils/jev-row-fit`):
 * how much of what the enemy team throws at us its items answer, on 100, with
 * the needs answered and the items that answer them on hover — and Jev's
 * knight on the row that fits best, "Jev's pick for this draft".
 */
const props = defineProps<{
  fit: RowFit
  best: boolean
  /** Icon and figure only, for the compact header's buttons. */
  compact?: boolean
}>()
const { t } = useT()
const { items } = useStaticData()

const value = computed(() => Math.round(props.fit.score * 100))
const tone = computed(() => (props.fit.misfit ? 'text-warning' : value.value >= 50 ? 'text-primary' : value.value >= 25 ? 'text-default' : 'text-muted'))
const hint = computed(() => [
  props.best ? t('jevfit.best') : null,
  props.fit.answers.length ? t('jevfit.answers', { needs: props.fit.answers.map(answer => t(`jev.need.${answer.need}`)).join(', ') }) : t('jevfit.answersNothing'),
  props.fit.answering.length ? t('jevfit.items', { items: props.fit.answering.map(id => items.value[id]?.name ?? id).join(', ') }) : null,
  props.fit.misfit ? t('jevfit.misfit') : null,
].filter(Boolean).join('\n'))
</script>

<template>
  <span class="flex shrink-0 items-center gap-1" :title="hint">
    <span v-if="best" class="flex items-center gap-0.5 rounded bg-primary/15 px-1 py-px text-[10px] font-bold text-primary">
      <UIcon name="i-tabler-chess-knight" class="size-3" /><span v-if="!compact">{{ t('jevfit.pick') }}</span>
    </span>
    <span class="rounded bg-accented/60 px-1 py-px text-[10px] font-semibold tabular-nums" :class="tone" :aria-label="t('jevfit.score', { value })">{{ value }}</span>
  </span>
</template>
