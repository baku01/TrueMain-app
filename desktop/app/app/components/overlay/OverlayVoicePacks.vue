<script setup lang="ts">
import { formatPercentage } from '#shared/utils/ddragon'
import type { VoicePack } from '~/utils/tips/voice-store'
import { coverage } from '~/utils/tips/voice'

/**
 * The tips' voice: on or off, whatever the overlay shows; the pack spoken
 * with them — none until the player imports one — and its volume, then the packs imported, each with how much of the
 * scheme it records and what it lacks, to use, try or remove. A pack is a ZIP
 * picked from disk and read in the page (`useVoicePacks`); the template ZIP
 * lists every file to record.
 */
const { t } = useT()
const { settings, update } = useTipSettings()
const { packs, busy, importFile, remove, select, test, downloadTemplate } = useVoicePacks()

const NONE = 'none'
const items = computed(() => [{ label: t('tips.voice.none'), value: NONE }, ...packs.value.map(pack => ({ label: pack.name, value: pack.id }))])
const chosen = computed(() => (packs.value.some(pack => pack.id === settings.value.pack) ? settings.value.pack! : NONE))

const rows = computed(() => packs.value.map(pack => ({ pack, ...coverage(pack.clips), active: pack.id === chosen.value })))

const picker = ref<HTMLInputElement | null>(null)
async function picked(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) await importFile(file)
}

const byline = (pack: VoicePack) => [pack.author && t('tips.voice.by', { author: pack.author }), pack.version && `v${pack.version}`, pack.language].filter(Boolean).join(' · ')
</script>

<template>
  <div class="space-y-3 border-t border-default pt-4" data-voice-packs>
    <div class="flex items-center justify-between gap-3">
      <h3 class="stat-label">{{ t('tips.voice.title') }}</h3>
      <USwitch :model-value="settings.voice" :label="t('tips.voice.speak')" size="sm" data-tips-voice @update:model-value="update({ voice: $event })" />
    </div>
    <div class="grid gap-3 sm:grid-cols-2" :class="!settings.voice && 'opacity-50'">
      <div class="space-y-1.5">
        <span class="block text-xs text-muted">{{ t('tips.voice.pack') }}</span>
        <USelect
          :model-value="chosen"
          :items="items"
          :disabled="!packs.length"
          size="sm"
          class="w-full"
          :aria-label="t('tips.voice.pack')"
          @update:model-value="(value: string) => select(value === NONE ? null : value)"
        />
      </div>
      <div class="space-y-1.5">
        <div class="flex items-baseline justify-between text-xs">
          <span class="text-muted">{{ t('tips.voice.volume') }}</span>
          <span class="stat-value">{{ formatPercentage(settings.volume, 0) }}</span>
        </div>
        <USlider :model-value="settings.volume" :min="0" :max="1" :step="0.05" size="sm" class="pt-2" :aria-label="t('tips.voice.volume')" @update:model-value="(value) => update({ volume: value ?? settings.volume })" />
      </div>
    </div>
    <p class="text-xs text-muted">{{ t('tips.voice.hint') }}</p>

    <div class="flex flex-wrap gap-2">
      <UButton :label="t('tips.voice.import')" icon="i-lucide-upload" size="xs" :loading="busy" @click="picker?.click()" />
      <UButton :label="t('tips.voice.template')" icon="i-lucide-download" size="xs" color="neutral" variant="outline" @click="downloadTemplate" />
      <!-- Only the ZIP's bytes are read, in the page: nothing of it is opened, run or shown. -->
      <input ref="picker" type="file" accept=".zip,application/zip" class="hidden" :aria-label="t('tips.voice.import')" @change="picked">
    </div>

    <ul v-if="rows.length" class="space-y-2">
      <li
        v-for="row in rows"
        :key="row.pack.id"
        class="rounded-lg px-3 py-2 ring-1 ring-inset"
        :class="row.active ? 'bg-primary/10 ring-primary/50' : 'bg-accented/30 ring-transparent'"
        data-pack
      >
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-audio-lines" class="size-4 shrink-0" :class="row.active ? 'text-primary' : 'text-muted'" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-highlighted">{{ row.pack.name }}</p>
            <p class="truncate text-xs text-muted">
              <span v-if="byline(row.pack)">{{ byline(row.pack) }} · </span>
              <span class="tabular-nums" data-coverage>{{ t('tips.voice.coverage', { covered: row.covered, total: row.total }) }}</span>
              · {{ t('tips.voice.names', { champions: row.champions, numbers: row.numbers }) }}
            </p>
          </div>
          <UButton
            :label="row.active ? t('tips.voice.inUse') : t('tips.voice.use')"
            size="xs"
            :color="row.active ? 'primary' : 'neutral'"
            :variant="row.active ? 'soft' : 'outline'"
            :disabled="row.active"
            @click="select(row.pack.id)"
          />
          <UButton :label="t('tips.voice.test')" icon="i-lucide-play" size="xs" color="neutral" variant="ghost" @click="test(row.pack)" />
          <UButton
            icon="i-lucide-trash-2"
            size="xs"
            color="error"
            variant="ghost"
            :aria-label="t('tips.voice.remove', { name: row.pack.name })"
            :title="t('tips.voice.remove', { name: row.pack.name })"
            @click="remove(row.pack)"
          />
        </div>
        <details v-if="row.missing.length" class="mt-1.5 pl-7 text-xs">
          <summary class="cursor-pointer text-muted">{{ t('tips.voice.missing', { count: row.missing.length }) }}</summary>
          <p class="mt-1 font-mono text-[11px] leading-relaxed break-words text-dimmed">{{ row.missing.join(', ') }}</p>
        </details>
      </li>
    </ul>
    <p v-else class="text-xs text-dimmed">{{ t('tips.voice.empty') }}</p>
  </div>
</template>
