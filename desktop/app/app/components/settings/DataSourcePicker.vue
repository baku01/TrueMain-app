<script setup lang="ts">
import type { DataSource } from '~/utils/data-source'
import DataSourceOptions from '~/components/settings/DataSourceOptions.vue'
import { dataSource, setDataSource } from '~/utils/data-source'

/**
 * The data source asked at launch: the same cards as Settings, a "remember my
 * choice" box, and a line saying Settings can change it any time. Asked once
 * per launch — a pick that changes the source reloads the window, and the
 * reload is not asked again — and never again once remembered.
 */
const REMEMBER_KEY = 'truemain-data-source-remembered'
const ASKED_KEY = 'truemain-data-source-asked'

const { t } = useT()

function stored(storage: Storage | undefined, key: string) {
  try {
    return storage?.getItem(key) === '1'
  }
  catch {
    return false
  }
}

const open = ref(!stored(globalThis.localStorage, REMEMBER_KEY) && !stored(globalThis.sessionStorage, ASKED_KEY))
const picked = ref<DataSource>(dataSource.value)
const remember = ref(false)

async function confirm() {
  try {
    sessionStorage.setItem(ASKED_KEY, '1')
    if (remember.value) localStorage.setItem(REMEMBER_KEY, '1')
  }
  catch {
    // Storage unavailable: asked again next time.
  }
  open.value = false
  if (picked.value !== dataSource.value) await setDataSource(picked.value)
}
</script>

<template>
  <UModal v-model:open="open" :dismissible="false" :close="false" :ui="{ content: 'max-w-2xl' }">
    <template #content>
      <div class="space-y-4 p-5">
        <header class="space-y-1">
          <div class="flex items-center gap-2">
            <UIcon name="i-ph-database-light" class="size-5 text-primary" />
            <h2 class="text-base font-semibold text-highlighted">{{ t('source.pick.title') }}</h2>
          </div>
          <p class="text-xs text-muted">{{ t('source.pick.description') }}</p>
        </header>

        <DataSourceOptions v-model="picked" />

        <footer class="flex flex-wrap items-center gap-3 border-t border-default pt-4">
          <UCheckbox v-model="remember" :label="t('source.pick.remember')" />
          <p class="flex items-center gap-1 text-[11px] text-dimmed">
            <UIcon name="i-lucide-info" class="size-3.5" />{{ t('source.pick.later') }}
          </p>
          <UButton class="ml-auto" :label="t('source.pick.confirm')" icon="i-lucide-arrow-right" trailing @click="confirm" />
        </footer>
      </div>
    </template>
  </UModal>
</template>
