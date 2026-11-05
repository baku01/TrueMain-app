<script setup lang="ts">
import type { CompositionBuildRequest } from '~/types/build'
import type { OpenedStep } from '~/components/jev/JevBuildPath.vue'

/**
 * The Jev matchup page's recommendation (`useJevBuild`), on a click: first
 * what it is built against — the enemy team's needs and Jev's reading of each
 * kit (`JevEnemyRead`) — then the recommended and the most played build, each a
 * path of steps (`JevBuildPath`), and every option of the step opened (`JevChoices`).
 */
const props = defineProps<{ championId: number, request: CompositionBuildRequest }>()
const { t } = useT()
const { loadChampion } = useStaticData()
const subject = computed(() => ({ championId: props.championId, request: props.request }))
const { status, error, ranked, needs, enemies, jevBuild, standardBuild, elapsedMs, ask } = useJevBuild(subject)

watch(() => props.championId, id => void loadChampion(id).catch(() => {}), { immediate: true })

/** The step opened below the builds: the one clicked, else the first where Jev parts from the most played. */
const chosen = ref<OpenedStep | null>(null)
const opened = computed(() => {
  const clicked = chosen.value && ranked.value.find(entry => entry.slot.name === chosen.value!.name)
  if (clicked) return { entry: clicked, label: chosen.value!.label }
  const first = ranked.value.find(entry => entry.pick.key !== entry.standard.key) ?? ranked.value[0]
  return first ? { entry: first, label: first.slot.name.startsWith('item') ? t('jev.slot.item', { slot: first.slot.name.slice(4) }) : t(`jev.slot.${first.slot.name}`) } : null
})

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

    <UAlert v-if="status === 'noKey'" color="warning" variant="subtle" icon="i-lucide-key-round" :title="t('jev.card.noKey')" :actions="[{ label: t('jev.card.openSettings'), to: '/settings', color: 'warning', variant: 'outline' }]" />
    <UAlert v-else-if="status === 'noOptions'" color="neutral" variant="subtle" icon="i-lucide-circle-alert" :title="t('jev.card.noOptions')" />
    <UAlert v-else-if="status === 'error'" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="t('jev.card.error')" :description="error ?? undefined" />

    <div v-if="status === 'loading'" class="flex flex-col gap-3">
      <USkeleton class="h-80 rounded-2xl" />
    </div>

    <template v-else-if="status === 'ready'">
      <JevEnemyRead v-if="needs" :needs="needs" :enemies="enemies" />

      <!-- The two builds stacked, step over step, then every option of the step opened. -->
      <JevBuildPath v-if="jevBuild" v-model:opened="chosen" :ranked="ranked" :champion-id="championId" :build="jevBuild" side="jev" />
      <JevBuildPath v-if="standardBuild" v-model:opened="chosen" :ranked="ranked" :champion-id="championId" :build="standardBuild" side="standard" />
      <section v-if="opened" class="surface min-w-0 rounded-2xl p-4">
        <header class="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <h3 class="text-sm font-semibold text-highlighted">{{ t('jev.path.details', { slot: opened.label }) }}</h3>
          <span class="flex items-center gap-1 text-[11px] text-muted"><UIcon name="i-tabler-chess-knight" class="size-3.5 text-primary" />{{ t('jev.card.jevPick') }}</span>
          <span class="flex items-center gap-1 text-[11px] text-muted"><UIcon name="i-tabler-database" class="size-3.5" />{{ t('jev.card.standardPick') }}</span>
          <span class="ml-auto text-[11px] text-dimmed">{{ t('jev.path.hint') }}</span>
        </header>
        <p class="mb-3 text-xs text-muted">{{ t('jev.card.choicesHint') }}</p>
        <JevChoices :ranked="[opened.entry]" :champion-id="championId" />
      </section>
    </template>
  </section>
</template>
