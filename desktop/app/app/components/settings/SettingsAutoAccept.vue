<script setup lang="ts">
/**
 * Accepting a found match (`useReadyCheck`): a switch, off until the player
 * turns it on, and the wait before the shell accepts — the player's time to
 * answer the client first, or to decline.
 */
const { t } = useT()
const { settings, busy, load, update } = useReadyCheck()

const DELAYS = [0, 3, 5, 8] as const

onMounted(load)
</script>

<template>
  <section class="space-y-4 surface rounded-xl p-5" data-auto-accept>
    <header class="space-y-1">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-circle-check" class="size-5 text-primary" />
        <h2 class="text-sm font-semibold text-highlighted">{{ t('readyCheck.title') }}</h2>
      </div>
      <p class="text-xs text-muted">{{ t('readyCheck.description') }}</p>
    </header>

    <USwitch
      :model-value="settings?.autoAccept ?? false"
      :disabled="!settings || busy"
      :label="t('readyCheck.autoAccept')"
      :description="t('readyCheck.autoAcceptDescription')"
      @update:model-value="update({ autoAccept: $event })"
    />

    <div v-if="settings?.autoAccept" class="flex flex-wrap items-center gap-3 pl-11">
      <span class="text-sm text-default">{{ t('readyCheck.delay') }}</span>
      <div class="flex gap-1" role="radiogroup" :aria-label="t('readyCheck.delay')">
        <UButton
          v-for="seconds in DELAYS"
          :key="seconds"
          :label="seconds ? t('readyCheck.seconds', { seconds }) : t('readyCheck.atOnce')"
          size="xs"
          :color="settings.delaySeconds === seconds ? 'primary' : 'neutral'"
          :variant="settings.delaySeconds === seconds ? 'soft' : 'ghost'"
          role="radio"
          :aria-checked="settings.delaySeconds === seconds"
          :disabled="busy"
          @click="update({ delaySeconds: seconds })"
        />
      </div>
    </div>
  </section>
</template>
