<script setup lang="ts">
/**
 * The app in the background, as Blitz runs (`useAutostart`): closing the
 * window leaves it in the tray (the menu bar on macOS) — said here, where the
 * player looks for it —, and a switch to start it with the computer, off
 * until turned on, hidden in the tray until opened.
 */
const { t } = useT()
const { enabled, busy, load, update } = useAutostart()

onMounted(load)
</script>

<template>
  <section class="space-y-4 surface rounded-xl p-5" data-startup>
    <header class="space-y-1">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-power" class="size-5 text-primary" />
        <h2 class="text-sm font-semibold text-highlighted">{{ t('startup.title') }}</h2>
      </div>
      <p class="text-xs text-muted">{{ t('startup.description') }}</p>
    </header>

    <USwitch
      :model-value="enabled ?? false"
      :disabled="enabled === null || busy"
      :label="t('startup.autostart')"
      :description="t('startup.autostartDescription')"
      @update:model-value="update($event)"
    />
  </section>
</template>
