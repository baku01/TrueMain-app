<script setup lang="ts">
import type { CompositionBuildRequest } from '~/types/build'

/**
 * The Jev matchup page's card: on a click, Jev's build and runes for the draft
 * on the board (`useJevBuild`) — each slot's pick with its confidence and every
 * option's probability, a pick the app set aside for a rule marked — beside
 * what the app's own rules pick from the same options.
 */
const props = defineProps<{ championId: number, request: CompositionBuildRequest }>()
const { t } = useT()
const { items } = useStaticData()
const subject = computed(() => ({ championId: props.championId, request: props.request }))
const { status, error, picks, rules, elapsedMs, calls, ask } = useJevBuild(subject)

const slotLabel = (name: string) => (name.startsWith('item') ? t('jev.slot.item', { slot: name.slice(4) }) : t(`jev.slot.${name}`))
const percent = (value: number | undefined) => `${Math.round((value ?? 0) * 100)}%`
</script>

<template>
  <section class="surface flex flex-col gap-4 rounded-xl p-4">
    <header class="flex flex-wrap items-center gap-3">
      <UIcon name="i-tabler-sparkles" class="size-5 text-primary" />
      <div class="min-w-0 flex-1">
        <h2 class="text-sm font-semibold text-highlighted">{{ t('jev.card.title') }}</h2>
        <p class="text-xs text-muted">{{ t('jev.card.description') }}</p>
      </div>
      <span v-if="status === 'ready' && elapsedMs !== null" class="text-xs tabular-nums text-dimmed">{{ t('jev.card.elapsed', { ms: elapsedMs }) }}</span>
      <UButton icon="i-tabler-sparkles" :label="status === 'ready' ? t('jev.card.again') : t('jev.card.ask')" :loading="status === 'loading'" size="sm" @click="ask()" />
    </header>

    <UAlert v-if="status === 'noKey'" color="warning" variant="subtle" icon="i-lucide-key-round" :title="t('jev.card.noKey')" :actions="[{ label: t('jev.card.openSettings'), to: '/settings', color: 'warning', variant: 'outline' }]" />
    <UAlert v-else-if="status === 'noSource'" color="neutral" variant="subtle" icon="i-lucide-database" :title="t('jev.card.noSource')" />
    <UAlert v-else-if="status === 'noOptions'" color="neutral" variant="subtle" icon="i-lucide-circle-alert" :title="t('jev.card.noOptions')" />
    <UAlert v-else-if="status === 'error'" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="t('jev.card.error')" :description="error ?? undefined" />

    <div v-if="status === 'loading'" class="grid gap-2">
      <USkeleton v-for="i in 6" :key="i" class="h-14 rounded-lg" />
    </div>

    <div v-else-if="status === 'ready'" class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div class="flex flex-col gap-2">
      <p class="rounded-lg bg-elevated/30 px-3 py-2 text-xs text-muted ring-1 ring-default">
        <UIcon name="i-lucide-receipt" class="mr-1 inline size-3.5 align-[-2px] text-primary" />
        {{ t('jev.card.calls', { count: calls.length, model: calls.find(call => call.model)?.model ?? '—', tokens: Math.round(calls.reduce((sum, call) => sum + call.requestChars, 0) / 4).toLocaleString() }) }}
        <template v-for="(call, index) in calls" :key="index">
          <span v-if="call.usage" class="block font-mono text-[10px] text-dimmed">{{ JSON.stringify(call.usage) }}</span>
        </template>
      </p>
      <ul class="flex flex-col gap-2">
        <li v-for="pick in picks" :key="pick.slot.name" class="rounded-lg bg-elevated/50 p-3 ring-1 ring-default">
          <div class="flex flex-wrap items-center gap-2">
            <span class="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted">{{ slotLabel(pick.slot.name) }}</span>
            <span class="flex gap-1">
              <GameTooltipItemIcon v-for="id in pick.option.itemIds" :key="id" :item="items[id] ?? null" :width="28" :height="28" class="rounded" />
            </span>
            <span class="min-w-0 flex-1 truncate text-sm font-medium text-highlighted">{{ pick.option.label }}</span>
            <UBadge v-if="pick.overruled" :label="t('jev.card.overruled')" color="warning" variant="subtle" size="sm" />
            <span v-if="pick.answer" class="text-xs tabular-nums text-muted">{{ t('jev.card.confidence', { value: percent(pick.answer.confidence) }) }}</span>
            <span v-else class="text-xs text-dimmed">{{ t('jev.card.onlyOption') }}</span>
          </div>
          <ul v-if="pick.answer" class="mt-2 flex flex-col gap-1">
            <li v-for="option in pick.slot.options" :key="option.key" class="grid grid-cols-[minmax(0,1fr)_8rem_3rem] items-center gap-2 text-xs">
              <span class="truncate" :class="option.key === pick.option.key ? 'font-semibold text-highlighted' : 'text-muted'">
                {{ option.label }} <span class="text-dimmed">· {{ t('jev.card.measured', { games: option.games.toLocaleString(), rate: percent(option.winRate) }) }}</span>
              </span>
              <span class="h-1.5 overflow-hidden rounded-full bg-accented/70">
                <span class="block h-full rounded-full" :class="option.key === pick.option.key ? 'bg-primary' : 'bg-(--ui-text-dimmed)'" :style="{ width: percent(pick.answer.probabilities[option.key]) }" />
              </span>
              <span class="text-right tabular-nums text-muted">{{ percent(pick.answer.probabilities[option.key]) }}</span>
            </li>
          </ul>
        </li>
      </ul>
      </div>

      <aside class="rounded-lg bg-elevated/30 p-3 ring-1 ring-default">
        <p class="text-sm font-semibold text-highlighted">{{ t('jev.card.rules') }}</p>
        <p class="mb-2 text-xs text-muted">{{ t('jev.card.rulesHint') }}</p>
        <ul class="flex flex-col gap-1.5">
          <li v-for="step in rules" :key="step.itemId" class="flex items-center gap-2 text-xs">
            <GameTooltipItemIcon :item="items[step.itemId] ?? null" :width="24" :height="24" class="rounded" />
            <span class="truncate text-default">{{ items[step.itemId]?.name ?? step.itemId }}</span>
          </li>
        </ul>
      </aside>
    </div>
  </section>
</template>
