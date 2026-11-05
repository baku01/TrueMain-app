<script setup lang="ts">
import type { AxisRow } from '#common/utils/timeline-events'

// One line of the Timeline tab: a kill as its killer over its victims (the
// multi-kill named), or an objective as its minimap icon and its label — laid
// out towards the centre line, on the side that scored it.
const props = defineProps<{
  row: AxisRow
  champion: (participantId: number | null) => { name: string, icon: string | null }
  side: 'blue' | 'red'
}>()

const ring = computed(() => (props.side === 'blue' ? 'ring-sky-400' : 'ring-red-400'))
const victimRing = computed(() => (props.side === 'blue' ? 'ring-red-400' : 'ring-sky-400'))
</script>

<template>
  <div class="flex items-center gap-2 rounded-lg bg-elevated/50 px-2.5 py-1.5 text-xs" :class="side === 'blue' && 'flex-row-reverse'">
    <template v-if="row.type === 'kill'">
      <img
        v-if="champion(row.killerId).icon"
        :src="champion(row.killerId).icon!"
        :alt="champion(row.killerId).name"
        :title="champion(row.killerId).name"
        class="img-skeleton size-7 rounded-full ring-2"
        :class="ring"
      >
      <span v-else class="flex size-7 items-center justify-center rounded-full bg-muted text-muted" :title="champion(null).name">
        <UIcon name="i-tabler-tower" class="size-4" />
      </span>
      <span class="font-semibold" :class="side === 'blue' ? 'text-sky-400' : 'text-red-400'">{{ row.label }}</span>
      <UIcon name="i-tabler-swords" class="size-4 text-dimmed" />
      <span class="flex -space-x-1.5" :class="side === 'blue' && 'flex-row-reverse space-x-reverse'">
        <img
          v-for="victim in row.victimIds"
          :key="victim"
          :src="champion(victim).icon ?? undefined"
          :alt="champion(victim).name"
          :title="champion(victim).name"
          class="img-skeleton size-6 rounded-full opacity-80 ring-2 grayscale"
          :class="victimRing"
        >
      </span>
    </template>
    <template v-else>
      <img :src="row.icon" alt="" class="size-6">
      <span class="font-medium text-default">{{ row.marker.label }}</span>
    </template>
  </div>
</template>
