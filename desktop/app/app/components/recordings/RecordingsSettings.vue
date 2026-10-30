<script setup lang="ts">
import type { RecordingFrameRate, RecordingQueues, RecordingResolution, RecordingSettings } from '~/types/recordings'
import { RESOLUTION_LABELS, formatBytes, revealLabel } from '~/utils/recording-library'

const { t } = useT()

/**
 * Recording settings — the product owner's short list and nothing more (no
 * OBS): on/off, the queues, resolution and frame rate, the mark key (#2079),
 * the plays clipped automatically (#1766), the disk budget and the folder. Each change is saved as it is made; the shell clamps and
 * normalises, and its answer is what the panel then shows. The size of an
 * hour is the shell's own estimate for the preset, labelled as one.
 */
const open = defineModel<boolean>('open', { default: false })

const { settings, status, library, saveSettings, requestPermission, reveal } = useRecordings()

const GB = 1_000_000_000
const RESOLUTIONS = (['native', '1440p', '1080p', '720p'] as RecordingResolution[]).map(value => ({ value, label: RESOLUTION_LABELS[value] }))
const FRAME_RATES: { value: RecordingFrameRate, label: string }[] = [{ value: 30, label: '30 fps' }, { value: 60, label: '60 fps' }]
const QUEUES: { value: RecordingQueues, label: string }[] = [{ value: 'ranked', label: t('rec.settings.rankedOnly') }, { value: 'all', label: t('rec.settings.everyGame') }]

const current = computed(() => settings.value?.settings ?? null)

function apply(change: Partial<RecordingSettings>) {
  if (current.value) void saveSettings({ ...current.value, ...change })
}
function applyQuality(change: Partial<RecordingSettings['quality']>) {
  if (current.value) apply({ quality: { ...current.value.quality, ...change } })
}

// The budget in whole gigabytes, saved once the slider settles.
const minGb = computed(() => Math.ceil((settings.value?.minBudgetBytes ?? 5 * GB) / GB))
const maxGb = computed(() => Math.max(500, minGb.value))
const budgetGb = ref(20)
watch(() => current.value?.budgetBytes, bytes => (budgetGb.value = Math.round((bytes ?? 20 * GB) / GB)), { immediate: true })
let budgetTimer: ReturnType<typeof setTimeout> | undefined
function onBudget(value: number | undefined) {
  budgetGb.value = value ?? budgetGb.value
  clearTimeout(budgetTimer)
  budgetTimer = setTimeout(() => apply({ budgetBytes: budgetGb.value * GB }), 400)
}
onBeforeUnmount(() => clearTimeout(budgetTimer))

const estimate = computed(() => {
  const view = settings.value
  if (!view) return null
  const { resolution, frameRate } = view.settings.quality
  const found = view.estimates.find(entry => entry.resolution === resolution && entry.frameRate === frameRate)
  if (!found?.bytesPerHour) return t('rec.settings.nativeEstimate')
  return t('rec.settings.estimate', { size: formatBytes(found.bytesPerHour), resolution: RESOLUTION_LABELS[resolution], frameRate })
})

const availability = computed(() => {
  switch (status.value?.availability) {
    case 'ready': return { icon: 'i-lucide-circle-check', tone: 'text-data-good', text: t('rec.settings.ready') }
    case 'permission': return { icon: 'i-lucide-shield-alert', tone: 'text-warning', text: status.value.message ?? t('rec.empty.permission.fallback') }
    case 'unsupported': return { icon: 'i-lucide-monitor-x', tone: 'text-muted', text: status.value.message ?? t('rec.settings.unsupported') }
    case 'missing': return { icon: 'i-lucide-triangle-alert', tone: 'text-warning', text: status.value.message ?? t('rec.settings.missing') }
    default: return { icon: 'i-lucide-circle-help', tone: 'text-muted', text: t('rec.empty.unavailable.title') + '.' }
  }
})
</script>

<template>
  <USlideover v-model:open="open" :title="t('rec.settings.title')" :description="t('rec.settings.subtitle')" :ui="{ content: 'max-w-sm', body: 'flex flex-col gap-6' }">
    <template #body>
      <div class="flex items-start gap-2 text-sm">
        <UIcon :name="availability.icon" class="mt-0.5 size-4 shrink-0" :class="availability.tone" />
        <div class="flex flex-col items-start gap-2">
          <p class="text-muted">{{ availability.text }}</p>
          <UButton
            v-if="status?.availability === 'permission'"
            :label="t('rec.empty.permission.allow')"
            icon="i-lucide-monitor"
            size="xs"
            @click="requestPermission"
          />
        </div>
      </div>

      <template v-if="current">
        <USwitch
          :model-value="current.enabled"
          :label="t('rec.settings.record')"
          :description="t('rec.settings.recordDescription')"
          @update:model-value="apply({ enabled: $event })"
        />

        <section class="flex flex-col gap-2" :class="!current.enabled && 'opacity-50'">
          <h3 class="stat-label">{{ t('rec.settings.games') }}</h3>
          <RecordingsSegmented :model-value="current.queues" :items="QUEUES" @update:model-value="apply({ queues: $event })" />
        </section>

        <section class="flex flex-col gap-2" :class="!current.enabled && 'opacity-50'">
          <h3 class="stat-label">{{ t('rec.settings.quality') }}</h3>
          <RecordingsSegmented :model-value="current.quality.resolution" :items="RESOLUTIONS" @update:model-value="applyQuality({ resolution: $event })" />
          <RecordingsSegmented :model-value="current.quality.frameRate" :items="FRAME_RATES" @update:model-value="applyQuality({ frameRate: $event })" />
          <p class="text-xs text-muted">{{ estimate }} {{ t('rec.settings.neverLarger') }}</p>
        </section>

        <RecordingsMarkKey
          :class="!current.enabled && 'opacity-50'"
          :mark-key="current.markKey"
          :chord="settings?.markKey ?? null"
          :length="current.markLength"
          @change="apply({ markKey: $event })"
          @length="apply({ markLength: $event })"
        />

        <RecordingsAutoClips
          :class="!current.enabled && 'opacity-50'"
          :kinds="current.autoClips"
          @change="apply({ autoClips: $event })"
        />

        <section class="flex flex-col gap-2">
          <div class="flex items-baseline justify-between">
            <h3 class="stat-label">{{ t('rec.settings.budget') }}</h3>
            <span class="stat-value text-sm">{{ budgetGb }} GB</span>
          </div>
          <USlider :model-value="budgetGb" :min="minGb" :max="maxGb" :step="1" size="sm" @update:model-value="onBudget" />
          <p class="text-xs text-muted">
            <template v-if="library">{{ t('rec.settings.used', { size: formatBytes(library.usedBytes) }) }} </template>
            {{ t('rec.settings.pastBudget') }}
          </p>
        </section>

        <section v-if="settings" class="flex flex-col gap-2">
          <h3 class="stat-label">{{ t('rec.settings.folder') }}</h3>
          <div class="flex items-center gap-2">
            <code class="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1 text-xs text-muted" :title="settings.folder">{{ settings.folder }}</code>
            <UButton icon="i-lucide-folder-open" color="neutral" variant="outline" size="xs" :aria-label="revealLabel()" :title="revealLabel()" @click="reveal(settings.folder)" />
          </div>
        </section>
      </template>
    </template>
  </USlideover>
</template>
