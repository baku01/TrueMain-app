<script setup lang="ts">
import type { GameRecording } from '~/types/recordings'
import { dateLocale, dayLabel, formatBytes, itemTitle, gameItem, recordingKda, revealLabel } from '~/utils/recording-library'
import { getQueueLabel } from '#common/utils/queues'

const { t } = useT()

/**
 * The recap's header: the game (champion, result, K/D/A, queue, when) and the
 * decision about the full game — keep it (exempt from the disk budget) or
 * delete it (the clips saved from it stay).
 */
const props = defineProps<{ recording: GameRecording }>()
const emit = defineEmits<{ delete: [] }>()

const { nameOf } = useChampionStatics()
const { setKept, reveal } = useRecordings()

const title = computed(() => itemTitle(gameItem(props.recording), nameOf))
const kda = computed(() => recordingKda(props.recording))
const when = computed(() => {
  const time = new Date(props.recording.startedAtMs).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' })
  return `${dayLabel(props.recording.startedAtMs)} ${time}`
})
const busy = ref(false)

async function toggleKept() {
  busy.value = true
  await setKept(props.recording.id, !props.recording.kept)
  busy.value = false
}
</script>

<template>
  <header class="flex items-center gap-3">
    <UButton to="/recordings" icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm" :aria-label="t('rec.clip.back')" />
    <ChampionPortrait :champion-id="recording.championId" size="sm" />
    <div class="min-w-0 leading-tight">
      <h1 class="truncate text-lg font-semibold tracking-tight text-highlighted">
        {{ title }}
      </h1>
      <p class="flex items-center gap-1.5 truncate text-xs text-muted tabular-nums">
        <template v-if="kda">
          <span class="text-default">{{ kda.line }}</span>
          <span>{{ kda.ratio }}</span>
          <span class="text-dimmed">·</span>
        </template>
        <span>{{ getQueueLabel(recording.queueId) }}</span>
        <span class="text-dimmed">·</span>
        <span>{{ when }}</span>
        <span class="text-dimmed">·</span>
        <span>{{ formatBytes(recording.sizeBytes) }}</span>
      </p>
    </div>

    <div class="ml-auto flex shrink-0 items-center gap-2">
      <UButton
        :icon="recording.kept ? 'i-lucide-check' : 'i-lucide-pin'"
        :label="recording.kept ? t('rec.header.kept') : t('rec.card.keepGame')"
        :color="recording.kept ? 'primary' : 'neutral'"
        :variant="recording.kept ? 'soft' : 'outline'"
        size="sm"
        :loading="busy"
        :aria-pressed="recording.kept"
        :title="recording.kept ? t('rec.header.keptTitle') : t('rec.header.keepTitle')"
        @click="toggleKept"
      />
      <UButton icon="i-lucide-folder-open" color="neutral" variant="ghost" size="sm" :aria-label="revealLabel()" :title="revealLabel()" @click="reveal(recording.videoPath)" />
      <UButton icon="i-lucide-trash-2" :label="t('rec.deleteGame')" color="error" variant="ghost" size="sm" @click="emit('delete')" />
    </div>
  </header>
</template>
