<script setup lang="ts">
import type { Lane, TeamRow } from '~/types/draft'
import type { EnemyCounter } from '~/utils/draft-counters'

/**
 * One side of the board: its five picks over their lanes, under its name in
 * the side's colour (the damage mix is the screen's own section). The enemy side's lanes can be corrected by drag; once they
 * have been, a reset puts the guesser's answer back.
 */
defineProps<{
  team: 'ally' | 'enemy'
  rows: TeamRow[]
  selectedCell: number
  opponentCell: number
  /** Portraits to suggest in our own empty slot. */
  suggested?: number[]
  /** Enemy lanes resolved: the cards can be dragged to correct them. */
  correctable?: boolean
  /** The player moved an enemy lane by hand: the reset is offered. */
  hasCorrections?: boolean
  /** By enemy champion: who beats it on its lane (the enemy side). */
  counters?: Map<number, EnemyCounter[]> | null
}>()

const emit = defineEmits<{ view: [championId: number], swap: [from: Lane, to: Lane], reset: [] }>()
const { t } = useT()
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <p class="stat-label flex items-center gap-1.5"><span class="size-2 rounded-full" :class="team === 'ally' ? 'bg-ally' : 'bg-enemy'" />{{ team === 'ally' ? t('draft.team.ours') : t('draft.team.theirs') }}</p>
    <div class="relative">
      <DraftTeam
        :team="team"
        :rows="rows"
        :selected-cell="selectedCell"
        :opponent-cell="opponentCell"
        :suggested="suggested"
        :correctable="correctable"
        :counters="counters"
        @view="emit('view', $event)"
        @swap="(from, to) => emit('swap', from, to)"
      />
      <UButton
        v-if="hasCorrections"
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-rotate-ccw"
        :label="t('draft.team.resetLanes')"
        class="absolute -bottom-1.5 right-0"
        @click="emit('reset')"
      />
    </div>
  </div>
</template>
