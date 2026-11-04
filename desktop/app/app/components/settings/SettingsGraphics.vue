<script setup lang="ts">
/**
 * Hardware acceleration (`useGraphics`). Saved as soon as it is flipped; on
 * Windows the webview's own switch waits for a restart, offered right here.
 */
const { t } = useT()
const { view, busy, load, setHardwareAcceleration, relaunch } = useGraphics()

const restartFailed = ref(false)

onMounted(load)

async function restart() {
  restartFailed.value = false
  try {
    await relaunch()
  }
  catch {
    restartFailed.value = true
  }
}
</script>

<template>
  <section class="space-y-4 surface rounded-xl p-5">
    <header class="flex items-center gap-2">
      <UIcon name="i-ph-cpu-light" class="size-5 text-primary" />
      <h2 class="text-sm font-semibold text-highlighted">{{ t('graphics.title') }}</h2>
    </header>

    <USwitch
      :model-value="view?.hardwareAcceleration ?? true"
      :disabled="!view || busy"
      :label="t('graphics.acceleration')"
      :description="view?.gpuSwitchable ? t('graphics.description.windows') : t('graphics.description.mac')"
      @update:model-value="setHardwareAcceleration($event)"
    />

    <div v-if="view?.restartRequired" class="flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2" aria-live="polite">
      <UIcon name="i-lucide-refresh-cw" class="size-4 shrink-0 text-warning" />
      <span class="text-sm text-default">{{ t('graphics.restart') }}</span>
      <UButton :label="t('graphics.restartNow')" size="xs" color="warning" variant="soft" class="ml-auto" @click="restart()" />
    </div>
    <p v-if="restartFailed" class="text-sm text-error">{{ t('graphics.restartFailed') }}</p>
  </section>
</template>
