<script setup lang="ts">
import type { CompositionBuildRequest } from '~/types/build'

/**
 * The Jev matchup page's recommendation (`useJevBuild`), on a click: first
 * what it is built against — the enemy team's needs and Jev's reading of each
 * kit (`JevEnemyRead`) — then the recommended build as a path of steps, each
 * opening every option of it in full (`JevBuildPath`).
 */
const props = defineProps<{ championId: number, request: CompositionBuildRequest }>()
const { t } = useT()
const { loadChampion } = useStaticData()
const subject = computed(() => ({ championId: props.championId, request: props.request }))
const { status, error, ranked, needs, enemies, jevBuild, standardBuild, elapsedMs, ask } = useJevBuild(subject)

watch(() => props.championId, id => void loadChampion(id).catch(() => {}), { immediate: true })

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

    <div v-if="status === 'loading'" class="flex flex-col gap-3">
      <USkeleton class="h-80 rounded-2xl" />
    </div>

    <template v-else-if="status === 'ready'">
      <JevEnemyRead v-if="needs" :needs="needs" :enemies="enemies" />

      <JevBuildPath v-if="jevBuild && standardBuild" :ranked="ranked" :champion-id="championId" :order="jevBuild.order" :standard-order="standardBuild.order" />
    </template>
  </section>
</template>
