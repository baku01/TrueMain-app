<script setup lang="ts">
import type { DataSource } from '~/utils/data-source'
import { DATA_SOURCES } from '~/utils/data-source'

/**
 * The data sources as radio cards — name, what each brings, the experimental
 * ones marked — for Settings and for the choice offered at launch
 * (`DataSourcePicker`). The parent decides what a pick does.
 */
const model = defineModel<DataSource>({ required: true })
const { t } = useT()
const EXPERIMENTAL: ReadonlySet<DataSource> = new Set(['lolalytics', 'tencent'])
</script>

<template>
  <div class="grid gap-2 sm:grid-cols-2" role="radiogroup" :aria-label="t('source.title')">
    <button
      v-for="option in DATA_SOURCES"
      :key="option"
      type="button"
      role="radio"
      :aria-checked="model === option"
      class="flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors"
      :class="model === option ? 'bg-primary/10 ring-1 ring-inset ring-primary/50' : 'bg-accented/30 hover:bg-accented/60'"
      @click="model = option"
    >
      <span class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border" :class="model === option ? 'border-primary' : 'border-(--ui-border-accented)'">
        <span v-if="model === option" class="size-2 rounded-full bg-primary" />
      </span>
      <span class="min-w-0">
        <span class="flex items-center gap-2 text-sm font-semibold text-highlighted">
          {{ t(`source.name.${option}`) }}
          <UBadge v-if="EXPERIMENTAL.has(option)" :label="t('source.experimental')" color="warning" variant="subtle" size="sm" />
        </span>
        <span class="block text-xs text-muted">{{ t(`source.hint.${option}`) }}</span>
      </span>
    </button>
  </div>
</template>
