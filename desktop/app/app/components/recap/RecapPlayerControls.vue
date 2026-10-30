<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { formatClock } from '~/utils/recording-moments'
import { formatRate } from '~/utils/recording-timeline'

const { t } = useT()

/** The recap player's control row: play, the moments either side, the clock, the clip's in and out, speed, sound and full screen. */
defineProps<{
  playing: boolean
  currentMs: number
  lengthMs: number
  /** The recap of a full game: ranges are cut here. */
  editable: boolean
  rate: number
  rateItems: DropdownMenuItem[]
  /** Where the speed menu opens: inside the player while it is full screen, so it shows over it. */
  menuPortal: HTMLElement | true
  muted: boolean
  immersive: boolean
}>()

const emit = defineEmits<{
  toggle: []
  previous: []
  next: []
  setIn: []
  setOut: []
  mute: []
  fullscreen: []
}>()
</script>

<template>
  <div class="flex items-center gap-1">
    <UButton :icon="playing ? 'i-lucide-pause' : 'i-lucide-play'" color="neutral" variant="ghost" size="sm" :aria-label="playing ? t('rec.ctl.pause') : t('rec.ctl.play')" :title="t('rec.ctl.playPause')" @click="emit('toggle')" />
    <UButton icon="i-lucide-skip-back" color="neutral" variant="ghost" size="sm" :aria-label="t('rec.ctl.prev')" :title="t('rec.ctl.prevTitle')" @click="emit('previous')" />
    <UButton icon="i-lucide-skip-forward" color="neutral" variant="ghost" size="sm" :aria-label="t('rec.ctl.next')" :title="t('rec.ctl.nextTitle')" @click="emit('next')" />
    <span class="ml-1 text-xs tabular-nums text-muted">
      <span class="text-highlighted">{{ formatClock(currentMs) }}</span> / {{ formatClock(lengthMs) }}
    </span>

    <div class="ml-auto flex items-center gap-1">
      <template v-if="editable">
        <UButton :label="t('rec.ctl.setIn')" color="neutral" variant="outline" size="xs" :title="t('rec.ctl.setInTitle')" @click="emit('setIn')">
          <template #trailing><UKbd value="I" size="sm" /></template>
        </UButton>
        <UButton :label="t('rec.ctl.setOut')" color="neutral" variant="outline" size="xs" :title="t('rec.ctl.setOutTitle')" @click="emit('setOut')">
          <template #trailing><UKbd value="O" size="sm" /></template>
        </UButton>
      </template>
      <UDropdownMenu :items="rateItems" :portal="menuPortal" :content="{ align: 'end', side: 'top' }" :ui="{ content: 'min-w-28' }">
        <UButton
          :label="formatRate(rate)"
          color="neutral"
          variant="ghost"
          size="sm"
          class="tabular-nums"
          :class="rate !== 1 && 'text-primary'"
          :aria-label="t('rec.ctl.speed')"
          :title="t('rec.ctl.speedTitle')"
        />
      </UDropdownMenu>
      <UButton :icon="muted ? 'i-lucide-volume-x' : 'i-lucide-volume-2'" color="neutral" variant="ghost" size="sm" :aria-label="muted ? t('rec.ctl.unmute') : t('rec.ctl.mute')" :title="t('rec.ctl.muteTitle')" @click="emit('mute')" />
      <UButton :icon="immersive ? 'i-lucide-minimize' : 'i-lucide-maximize'" color="neutral" variant="ghost" size="sm" :aria-label="immersive ? t('rec.ctl.exitFull') : t('rec.ctl.full')" :title="immersive ? t('rec.ctl.exitFullTitle') : t('rec.ctl.fullTitle')" @click="emit('fullscreen')" />
    </div>
  </div>
</template>
