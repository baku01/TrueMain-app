<script setup lang="ts">
import type { CompositionBuildRequest } from '~/types/build'

/**
 * The Jev matchup page's recommendation (`useJevBuild`), on a click: first
 * what it is built against — the enemy team's needs and Jev's reading of each
 * kit — then the recommended and the most played build, each a path of steps,
 * and every option of the step opened (`JevBuildBody`). The family Jev ranks
 * within is the player's to choose first (`JevBaseSelect`, `useJevBases`).
 */
const props = defineProps<{
  championId: number
  request: CompositionBuildRequest
}>()
const { t } = useT()
const { loadChampion } = useStaticData()
const subject = computed(() => ({ championId: props.championId, request: props.request }))
const bases = useJevBases(subject, ref(true))
const { offered, selected, pending } = bases
const { status, error, ranked, needs, enemies, jevBuild, standardBuild, elapsedMs, answered, ask } = useJevBuild(subject, bases.chosen)

watch(() => props.championId, id => void loadChampion(id).catch(() => {}), { immediate: true })

</script>

<template>
  <section class="flex flex-col gap-4">
    <header class="surface flex flex-wrap items-center gap-3 rounded-xl p-4">
      <UIcon name="i-tabler-chess-knight" class="size-5 text-primary" />
      <div class="min-w-0 flex-1">
        <h2 class="text-sm font-semibold text-highlighted">{{ t('jev.card.title') }}</h2>
        <p class="text-xs text-muted">{{ t('jev.card.description') }}</p>
      </div>
      <span v-if="status === 'ready' && elapsedMs !== null" class="text-xs tabular-nums text-dimmed">{{ t('jev.card.elapsed', { ms: elapsedMs }) }}</span>
      <UButton icon="i-tabler-chess-knight" :label="status === 'ready' ? t('jev.card.again') : t('jev.card.ask')" :loading="status === 'loading'" size="sm" @click="ask()" />
    </header>

    <JevBaseSelect v-model="selected" :offered="offered" :pending="pending" :answered="status === 'ready' ? answered : null" class="px-1" />

    <UAlert v-if="status === 'noKey'" color="warning" variant="subtle" icon="i-lucide-key-round" :title="t('jev.card.noKey')" :actions="[{ label: t('jev.card.openSettings'), to: '/settings', color: 'warning', variant: 'outline' }]" />
    <UAlert v-else-if="status === 'noOptions'" color="neutral" variant="subtle" icon="i-lucide-circle-alert" :title="t('jev.card.noOptions')" />
    <UAlert v-else-if="status === 'error'" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="t('jev.card.error')" :description="error ?? undefined" />

    <div v-if="status === 'loading'" class="flex flex-col gap-3">
      <USkeleton class="h-80 rounded-2xl" />
    </div>

    <template v-else-if="status === 'ready'">
      <JevBuildBody :champion-id="championId" :position="request.position" :ranked="ranked" :needs="needs" :enemies="enemies" :jev-build="jevBuild" :standard-build="standardBuild" :base="answered" />
    </template>
  </section>
</template>
