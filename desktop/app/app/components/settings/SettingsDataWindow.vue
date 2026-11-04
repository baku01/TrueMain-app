<script setup lang="ts">
import { DATA_WINDOWS, dataWindow, recentPatches, setDataWindow } from '~/utils/data-window'
import { currentPatch } from '~/utils/sources/champions'
import { dataSource } from '~/utils/data-source'

/**
 * Which games the numbers come from (`utils/data-window.ts`): the current
 * patch, the one before, a patch picked, or automatic. The choice reloads the
 * window, like the source's. Only lolalytics takes it; with another source
 * the panel says the source answers its own latest patch.
 */
const { t } = useT()
const takesWindow = computed(() => dataSource.value === 'lolalytics')

/** The patches a specific one is picked from: the live one and the ten before it. */
const patches = ref<string[]>([])
onMounted(async () => {
  patches.value = recentPatches(await currentPatch().catch(() => ''))
})
const specific = computed(() => (dataWindow.value.startsWith('patch:') ? dataWindow.value.slice('patch:'.length) : null))
const patchItems = computed(() => patches.value.map(value => ({ value, label: t('dataWindow.patch', { patch: value }) })))
</script>

<template>
  <section class="space-y-4 surface rounded-xl p-5">
    <header class="space-y-1">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-calendar-range" class="size-5 text-primary" />
        <h2 class="text-sm font-semibold text-highlighted">{{ t('dataWindow.title') }}</h2>
      </div>
      <p class="text-xs text-muted">{{ t('dataWindow.description') }}</p>
    </header>
    <div class="grid gap-2 sm:grid-cols-3" role="radiogroup" :aria-label="t('dataWindow.title')">
      <button
        v-for="option in DATA_WINDOWS"
        :key="option"
        type="button"
        role="radio"
        :aria-checked="dataWindow === option"
        class="rounded-lg px-3 py-2 text-left transition-colors"
        :class="dataWindow === option ? 'bg-primary/10 ring-1 ring-inset ring-primary/50' : 'bg-accented/30 hover:bg-accented/60'"
        @click="setDataWindow(option)"
      >
        <span class="block text-sm font-medium text-highlighted">{{ t(`dataWindow.option.${option}`) }}</span>
        <span class="block text-xs text-muted">{{ t(`dataWindow.option.${option}.description`) }}</span>
      </button>
    </div>
    <div
      class="flex flex-wrap items-center gap-3 rounded-lg px-3 py-2"
      :class="specific ? 'bg-primary/10 ring-1 ring-inset ring-primary/50' : 'bg-accented/30'"
    >
      <div class="min-w-0 flex-1">
        <span class="block text-sm font-medium text-highlighted">{{ t('dataWindow.option.specific') }}</span>
        <span class="block text-xs text-muted">{{ t('dataWindow.option.specific.description') }}</span>
      </div>
      <USelect
        :model-value="specific ?? undefined"
        :items="patchItems"
        :placeholder="t('dataWindow.pickPatch')"
        size="sm"
        class="w-40"
        :aria-label="t('dataWindow.option.specific')"
        @update:model-value="(value: string) => setDataWindow(`patch:${value}`)"
      />
    </div>
    <p class="flex items-start gap-2 rounded-lg bg-accented/50 px-3 py-2 text-xs text-muted">
      <UIcon name="i-lucide-info" class="mt-0.5 size-3.5 shrink-0" />
      {{ takesWindow ? t('dataWindow.supported') : t('dataWindow.unsupported') }}
    </p>
  </section>
</template>
