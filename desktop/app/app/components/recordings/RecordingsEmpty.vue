<script setup lang="ts">
import type { ButtonProps } from '@nuxt/ui'
import type { RecordingsEmptyReason } from '~/utils/recording-library'
import { RESOLUTION_LABELS, formatBytes } from '~/utils/recording-library'

const { t } = useT()

/**
 * Why the Recordings page has nothing to list, and the one thing to do about
 * it: capture not allowed or not available, recording off (with what turning
 * it on costs, from the shell's own estimate), nothing recorded yet, or
 * nothing matching the filters.
 */
const props = defineProps<{ reason: RecordingsEmptyReason }>()
const emit = defineEmits<{ clear: [], settings: [] }>()

const { settings, status, saveSettings, requestPermission } = useRecordings()

const hourCost = computed(() => {
  const view = settings.value
  if (!view) return null
  const { resolution, frameRate } = view.settings.quality
  const estimate = view.estimates.find(entry => entry.resolution === resolution && entry.frameRate === frameRate)
  const preset = t('rec.empty.preset', { resolution: RESOLUTION_LABELS[resolution], frameRate })
  return estimate?.bytesPerHour
    ? t('rec.empty.cost', { size: formatBytes(estimate.bytesPerHour), preset, budget: formatBytes(view.settings.budgetBytes) })
    : t('rec.empty.budget', { budget: formatBytes(view.settings.budgetBytes) })
})

function turnOn() {
  if (settings.value) void saveSettings({ ...settings.value.settings, enabled: true })
}

const content = computed<{ icon: string, title: string, description: string, actions: ButtonProps[] }>(() => {
  const settingsButton: ButtonProps = { label: t('rec.settings.button'), icon: 'i-lucide-settings-2', color: 'neutral', variant: 'outline', onClick: () => emit('settings') }
  switch (props.reason) {
    case 'unavailable':
      return { icon: 'i-lucide-video-off', title: t('rec.empty.unavailable.title'), description: t('rec.empty.unavailable.description'), actions: [] }
    case 'permission':
      return {
        icon: 'i-lucide-shield-alert',
        title: t('rec.empty.permission.title'),
        description: t('rec.empty.permission.description', { message: status.value?.message ?? t('rec.empty.permission.fallback') }),
        actions: [{ label: t('rec.empty.permission.allow'), icon: 'i-lucide-monitor', onClick: () => void requestPermission() }],
      }
    case 'unsupported':
      return { icon: 'i-lucide-monitor-x', title: t('rec.empty.unsupported.title'), description: status.value?.message ?? t('rec.empty.unsupported.description'), actions: [] }
    case 'missing':
      return { icon: 'i-lucide-triangle-alert', title: t('rec.empty.missing.title'), description: t('rec.empty.missing.description', { message: status.value?.message ?? t('rec.empty.missing.fallback') }), actions: [] }
    case 'off':
      return {
        icon: 'i-lucide-video',
        title: t('rec.empty.off.title'),
        description: t('rec.empty.off.description', { cost: hourCost.value ?? '' }),
        actions: [{ label: t('rec.empty.off.turnOn'), icon: 'i-lucide-circle-dot', onClick: turnOn }, settingsButton],
      }
    case 'nothing':
      return {
        icon: 'i-lucide-clapperboard',
        title: t('rec.empty.nothing.title'),
        description: settings.value?.settings.queues === 'all'
          ? t('rec.empty.nothing.all')
          : t('rec.empty.nothing.ranked'),
        actions: [settingsButton],
      }
    default:
      return {
        icon: 'i-lucide-search-x',
        title: t('rec.empty.noMatch.title'),
        description: t('rec.empty.noMatch.description'),
        actions: [{ label: t('rec.clearFilters'), icon: 'i-lucide-x', color: 'neutral', variant: 'outline', onClick: () => emit('clear') }],
      }
  }
})
</script>

<template>
  <UEmpty
    :icon="content.icon"
    :title="content.title"
    :description="content.description"
    :actions="content.actions"
    variant="naked"
    class="mx-auto max-w-lg py-16"
  />
</template>
