<script setup lang="ts">
import type { JevKeyStatus } from '~/utils/jev'
import { jevKeyStatus, setJevKey } from '~/utils/jev'

/**
 * The Jev API key (TypeSafe, `typesafe.ai`), for the Jev matchup page's build
 * and rune picks. Saved in the shell, out of the webview's reach (`jev.rs`):
 * once saved, only its last four characters show again.
 */
const { t } = useT()
const status = ref<JevKeyStatus | null>(null)
const draft = ref('')
const busy = ref(false)
const failed = ref(false)

onMounted(async () => {
  status.value = await jevKeyStatus().catch(() => null)
})

async function save(key: string | null) {
  busy.value = true
  failed.value = false
  try {
    status.value = await setJevKey(key)
    draft.value = ''
  }
  catch {
    failed.value = true
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="space-y-4 surface rounded-xl p-5">
    <header class="flex items-center gap-2">
      <UIcon name="i-tabler-sparkles" class="size-5 text-primary" />
      <h2 class="text-sm font-semibold text-highlighted">{{ t('jev.settings.title') }}</h2>
    </header>
    <p class="text-sm text-muted">{{ t('jev.settings.description') }}</p>

    <p v-if="status?.set" class="flex items-center gap-2 text-sm text-default">
      <UIcon name="i-lucide-key-round" class="size-4 text-primary" />
      {{ t('jev.settings.saved', { hint: status.hint ?? '' }) }}
    </p>

    <form class="flex flex-wrap items-center gap-2" @submit.prevent="save(draft)">
      <UInput
        v-model="draft"
        type="password"
        autocomplete="off"
        :placeholder="status?.set ? t('jev.settings.replace') : t('jev.settings.placeholder')"
        class="min-w-64 flex-1"
        :aria-label="t('jev.settings.title')"
      />
      <UButton type="submit" :label="t('jev.settings.save')" :disabled="!draft.trim() || busy" :loading="busy" size="sm" />
      <UButton v-if="status?.set" :label="t('jev.settings.remove')" color="neutral" variant="soft" size="sm" :disabled="busy" @click="save(null)" />
    </form>
    <p v-if="failed" class="text-sm text-error">{{ t('jev.settings.failed') }}</p>
  </section>
</template>
