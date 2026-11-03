<script setup lang="ts">
import type { DataSource } from '~/utils/data-source'
import { DATA_SOURCES } from '~/utils/data-source'

/**
 * Where builds, the tier list, the champions list and matchups are read from:
 * TrueMain, Blitz, op.gg (its official API), lolalytics or Tencent, the last
 * two marked experimental — their endpoints are not ones they document, and may change without notice
 * (`utils/data-source.ts`). The choice reloads the window, so no page keeps
 * numbers read from another source.
 */
const { t } = useT()
const source = dataSource

const EXPERIMENTAL: ReadonlySet<DataSource> = new Set(['lolalytics', 'tencent'])
</script>

<template>
  <section class="space-y-4 rounded-xl border border-default bg-default/40 p-5">
    <header class="space-y-1">
      <div class="flex items-center gap-2">
        <UIcon name="i-ph-database-light" class="size-5 text-primary" />
        <h2 class="text-sm font-semibold text-highlighted">{{ t('source.title') }}</h2>
      </div>
      <p class="text-xs text-muted">{{ t('source.description') }}</p>
    </header>

    <div class="grid gap-2 sm:grid-cols-2" role="radiogroup" :aria-label="t('source.title')">
      <button
        v-for="option in DATA_SOURCES"
        :key="option"
        type="button"
        role="radio"
        :aria-checked="source === option"
        class="flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors"
        :class="source === option ? 'border-primary/60 bg-primary/10' : 'border-default hover:bg-accented/50'"
        @click="setDataSource(option)"
      >
        <span class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border" :class="source === option ? 'border-primary' : 'border-(--ui-border-accented)'">
          <span v-if="source === option" class="size-2 rounded-full bg-primary" />
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
  </section>
</template>
