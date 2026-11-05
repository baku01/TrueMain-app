<script setup lang="ts">
import type { CompositionBuildRequest } from '~/types/build'
import type { LaidBuild } from '~/utils/jev-build'

/**
 * The Jev matchup page's recommendation (`useJevBuild`), on a click: first
 * what it is built against — the enemy team's needs and Jev's reading of each
 * kit (`JevEnemyRead`) — then the recommended build beside the most played
 * one, then every choice option by option, its score in parts (`JevChoices`).
 */
const props = defineProps<{ championId: number, request: CompositionBuildRequest }>()
const { t } = useT()
const { loadChampion } = useStaticData()
const subject = computed(() => ({ championId: props.championId, request: props.request }))
const { status, error, ranked, needs, enemies, jevBuild, standardBuild, elapsedMs, ask } = useJevBuild(subject)

watch(() => props.championId, id => void loadChampion(id).catch(() => {}), { immediate: true })

const sides = computed(() => [
  { key: 'jev', title: t('jev.card.jevBuild'), build: jevBuild.value },
  { key: 'standard', title: t('jev.card.standardBuild'), build: standardBuild.value },
] as { key: string, title: string, build: LaidBuild | null }[])
</script>

<template>
  <section class="flex flex-col gap-4">
    <header class="surface flex flex-wrap items-center gap-3 rounded-xl p-4">
      <UIcon name="i-tabler-sparkles" class="size-5 text-primary" />
      <div class="min-w-0 flex-1">
        <h2 class="text-sm font-semibold text-highlighted">{{ t('jev.card.title') }}</h2>
        <p class="text-xs text-muted">{{ t('jev.card.description') }}</p>
      </div>
      <span v-if="status === 'ready' && elapsedMs !== null" class="text-xs tabular-nums text-dimmed">{{ t('jev.card.elapsed', { ms: elapsedMs }) }}</span>
      <UButton icon="i-tabler-sparkles" :label="status === 'ready' ? t('jev.card.again') : t('jev.card.ask')" :loading="status === 'loading'" size="sm" @click="ask()" />
    </header>

    <UAlert v-if="status === 'noKey'" color="warning" variant="subtle" icon="i-lucide-key-round" :title="t('jev.card.noKey')" :actions="[{ label: t('jev.card.openSettings'), to: '/settings', color: 'warning', variant: 'outline' }]" />
    <UAlert v-else-if="status === 'noOptions'" color="neutral" variant="subtle" icon="i-lucide-circle-alert" :title="t('jev.card.noOptions')" />
    <UAlert v-else-if="status === 'error'" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="t('jev.card.error')" :description="error ?? undefined" />

    <div v-if="status === 'loading'" class="grid gap-3 lg:grid-cols-2">
      <USkeleton v-for="i in 2" :key="i" class="h-64 rounded-2xl" />
    </div>

    <template v-else-if="status === 'ready'">
      <JevEnemyRead v-if="needs" :needs="needs" :enemies="enemies" />

      <!-- The two builds side by side: the recommended, and the most played. -->
      <div class="grid gap-3 lg:grid-cols-2">
        <template v-for="side in sides" :key="side.key">
          <JevBuildSummary v-if="side.build" :build="side.build" :champion-id="championId" :recommended="side.key === 'jev'" :title="side.title" />
        </template>
      </div>

      <!-- Every choice, option by option, as the analytics page lays a slot. -->
      <section class="surface min-w-0 rounded-2xl p-4">
        <header class="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1">
          <h3 class="stat-label">{{ t('jev.card.choices') }}</h3>
          <span class="flex items-center gap-1 text-[11px] text-muted"><UIcon name="i-tabler-sparkles" class="size-3.5 text-primary" />{{ t('jev.card.jevPick') }}</span>
          <span class="flex items-center gap-1 text-[11px] text-muted"><UIcon name="i-tabler-database" class="size-3.5" />{{ t('jev.card.standardPick') }}</span>
        </header>
        <p class="mb-3 text-xs text-muted">{{ t('jev.card.choicesHint') }}</p>
        <JevChoices :ranked="ranked" :champion-id="championId" />
      </section>
    </template>
  </section>
</template>
