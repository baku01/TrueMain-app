<script setup lang="ts">
/**
 * Where the numbers come from, and how far the collection is. It runs by
 * itself (`plugins/highelo-auto.client.ts`): there is nothing to start here,
 * only a state to read — collecting, up to date, stopped by an error or waiting
 * for a key — and a way to throw the data away.
 */
const { t } = useT()
const { status, load } = useRiotKey()
const { progress, error, standIn, clear } = useHighElo()

onMounted(load)

const percent = computed(() => (progress.value.playersTotal > 0 ? Math.round((progress.value.playersDone / progress.value.playersTotal) * 100) : 0))
const state = computed<'no-key' | 'starting' | 'running' | 'failed' | 'idle'>(() => {
  if (!status.value.saved && !standIn) return 'no-key'
  if (progress.value.running) return 'running'
  if (progress.value.phase === 'failed') return 'failed'
  // A key is saved and nothing has run yet: the collection starts by itself within seconds.
  if (progress.value.phase === '' && progress.value.matchesStored === 0 && !standIn) return 'starting'
  return 'idle'
})
const confirmClear = ref(false)

async function wipe() {
  await clear()
  confirmClear.value = false
}
</script>

<template>
  <section class="space-y-3 rounded-xl border border-default bg-default/40 p-4" aria-live="polite">
    <header class="flex flex-wrap items-center gap-3">
      <UIcon v-if="state === 'running' || state === 'starting'" name="i-lucide-loader-circle" class="size-5 animate-spin text-primary" />
      <UIcon v-else-if="state === 'failed'" name="i-lucide-triangle-alert" class="size-5 text-warning" />
      <UIcon v-else name="i-ph-database-light" class="size-5 text-primary" />
      <div class="min-w-0">
        <h2 class="text-sm font-semibold text-highlighted">{{ t(`probuild.auto.${state}`) }}</h2>
        <p class="text-xs text-muted tabular-nums">{{ t('probuild.collect.stored', { matches: progress.matchesStored, rows: progress.rowsStored }) }}</p>
      </div>
      <UButton v-if="state === 'no-key'" :label="t('probuild.collect.addKey')" to="/settings" icon="i-ph-key-light" size="xs" class="ml-auto" />
      <template v-else-if="progress.matchesStored > 0 && state !== 'running'">
        <UButton v-if="!confirmClear" :label="t('probuild.collect.clear')" icon="i-lucide-trash-2" size="xs" color="neutral" variant="ghost" class="ml-auto" @click="confirmClear = true" />
        <div v-else class="ml-auto flex gap-2">
          <UButton :label="t('probuild.collect.clearConfirm')" size="xs" color="error" variant="soft" @click="wipe()" />
          <UButton :label="t('riotkey.cancel')" size="xs" color="neutral" variant="ghost" @click="confirmClear = false" />
        </div>
      </template>
    </header>

    <div v-if="state === 'running'" class="space-y-1.5">
      <div class="flex items-baseline justify-between gap-3 text-xs">
        <span class="text-default">{{ t(`probuild.phase.${progress.phase || 'idle'}`) }}</span>
        <span v-if="progress.playersTotal > 0" class="text-muted tabular-nums">{{ t('probuild.collect.players.progress', { done: progress.playersDone, total: progress.playersTotal }) }}</span>
      </div>
      <div class="h-1.5 overflow-hidden rounded-full bg-accented" role="progressbar" :aria-valuenow="percent" aria-valuemin="0" aria-valuemax="100">
        <div class="h-full rounded-full bg-primary transition-all" :style="{ width: `${percent}%` }" />
      </div>
    </div>

    <p v-if="state === 'failed' || error" class="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-default">{{ error ?? progress.error }}</p>
    <p class="text-xs text-dimmed">{{ t('probuild.collect.note') }}</p>
  </section>
</template>
