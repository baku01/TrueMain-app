<script setup lang="ts">
import PlayerAvatar from '~/components/PlayerAvatar.vue'
import type { TopPlayer } from '~/utils/sources/analytics'
import { formatPercentage } from '#shared/utils/ddragon'

/** The best players on the champion, as the source ranks them: name, team or region, rank, win rate and games. */
/**
 * With `selectable`, a row is a button: picked, the page reads that player's
 * last game on the champion (`pending` names the row being read, `missing` the
 * rows that had none).
 */
defineProps<{ players: TopPlayer[], selectable?: boolean, pending?: string | null, missing?: ReadonlySet<string> }>()
const emit = defineEmits<{ select: [player: TopPlayer] }>()
const { t } = useT()
</script>

<template>
  <ol class="grid gap-1.5 @3xl:grid-cols-2">
    <li
      v-for="(player, index) in players.slice(0, 16)"
      :key="`${player.name}-${index}`"
      class="flex items-center gap-3 rounded-lg bg-accented/20 px-3 py-2"
      :class="selectable ? 'transition-colors hover:bg-accented/60' : ''"
      :role="selectable ? 'button' : undefined"
      :tabindex="selectable ? 0 : undefined"
      @click="selectable && emit('select', player)"
      @keydown.enter="selectable && emit('select', player)"
    >
      <span class="w-5 text-right text-xs font-semibold tabular-nums text-dimmed">{{ index + 1 }}</span>
      <PlayerAvatar :src="player.portraitUrl" :name="player.name" :size="28" class="rounded-md" />
      <span class="min-w-0 flex-1">
        <span class="block truncate text-sm font-semibold text-highlighted">{{ player.name }}</span>
        <span class="block truncate text-[11px] uppercase text-dimmed">{{ [player.team, player.region, player.rank].filter(Boolean).join(' · ') }}</span>
        <span v-if="missing?.has(player.name)" class="block text-[10px] text-warning">{{ t('analytics.players.noGame') }}</span>
      </span>
      <UIcon v-if="pending === player.name" name="i-lucide-loader-circle" class="size-4 shrink-0 text-dimmed" />
      <span class="text-right">
        <span v-if="player.winRate !== null" class="block text-sm font-semibold tabular-nums" :class="player.winRate >= 0.5 ? 'text-primary' : 'text-error'">{{ formatPercentage(player.winRate, 0) }}</span>
        <span class="block text-[10px] tabular-nums text-dimmed">{{ t('analytics.players.games', { games: player.games }) }}</span>
      </span>
    </li>
  </ol>
</template>
