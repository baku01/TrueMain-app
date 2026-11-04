<script setup lang="ts">
import DataSourceOptions from '~/components/settings/DataSourceOptions.vue'

/**
 * Where builds, the tier list, the champions list and matchups are read from:
 * TrueMain, Blitz, op.gg (its official API), lolalytics or Tencent, the last
 * two marked experimental — their endpoints are not ones they document, and may change without notice
 * (`utils/data-source.ts`). The choice reloads the window, so no page keeps
 * numbers read from another source.
 */
const { t } = useT()
const source = dataSource

// Asked at launch (`DataSourcePicker`) unless "remember my choice" was ticked there.
const REMEMBER_KEY = 'truemain-data-source-remembered'
const askAtLaunch = ref(true)
onMounted(() => {
  try {
    askAtLaunch.value = localStorage.getItem(REMEMBER_KEY) !== '1'
  }
  catch {
    // Storage unavailable: asked every launch.
  }
})
watch(askAtLaunch, (ask) => {
  try {
    if (ask) localStorage.removeItem(REMEMBER_KEY)
    else localStorage.setItem(REMEMBER_KEY, '1')
  }
  catch {
    // Storage unavailable: nothing to keep.
  }
})

</script>

<template>
  <section class="space-y-4 surface rounded-xl p-5">
    <header class="space-y-1">
      <div class="flex items-center gap-2">
        <UIcon name="i-ph-database-light" class="size-5 text-primary" />
        <h2 class="text-sm font-semibold text-highlighted">{{ t('source.title') }}</h2>
      </div>
      <p class="text-xs text-muted">{{ t('source.description') }}</p>
    </header>

    <DataSourceOptions :model-value="source" @update:model-value="setDataSource" />
    <USwitch v-model="askAtLaunch" :label="t('source.askAtLaunch')" size="sm" />
  </section>
</template>
