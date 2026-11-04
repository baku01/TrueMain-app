<script setup lang="ts">
import { formatTierName } from '#common/utils/tiers'
import PlayerAvatar from '~/components/PlayerAvatar.vue'
import type { TopPlayer } from '~/utils/sources/analytics'
import { formatPercentage } from '#shared/utils/ddragon'

/** The best players on the champion, as the source ranks them: name, team or region, rank, win rate and games. */
/**
 * With `selectable`, a row is a button: picked, the page reads that player's
 * last game on the champion (`pending` names the row being read, `missing` the
 * rows that had none).
 */
/** `compact`: the champion page's narrow side list — tighter rows, smaller picture. */
defineProps<{ players: TopPlayer[], selectable?: boolean, pending?: string | null, missing?: ReadonlySet<string>, compact?: boolean }>()
const emit = defineEmits<{ select: [player: TopPlayer] }>()
const { t } = useT()
/** A rank as the app names tiers (`challenger` → Desafiante); the division and LP after it kept as written. */
const rankName = (rank: string | null) => {
  if (!rank) return null
  const [tier, ...rest] = rank.split(' ')
  return [formatTierName(tier!.toUpperCase()), ...rest].join(' ')
}
</script>

<template>
  <ol class="grid min-w-0 grid-cols-1 gap-1.5 @3xl:grid-cols-2">
    <li
      v-for="(player, index) in players.slice(0, 16)"
      :key="`${player.name}-${index}`"
      class="flex min-w-0 items-center rounded-lg bg-accented/20"
      :class="[compact ? 'gap-2 px-2 py-1.5' : 'gap-3 px-3 py-2', selectable ? 'cursor-default transition-colors hover:bg-accented/60' : '']"
      :role="selectable ? 'button' : undefined"
      :tabindex="selectable ? 0 : undefined"
      @click="selectable && emit('select', player)"
      @keydown.enter="selectable && emit('select', player)"
    >
      <span class="shrink-0 text-right text-xs font-semibold tabular-nums text-dimmed" :class="compact ? 'w-4' : 'w-5'">{{ index + 1 }}</span>
      <PlayerAvatar :src="player.portraitUrl" :name="player.name" :region="player.region" :size="compact ? 24 : 28" class="rounded-md" />
      <span class="min-w-0 flex-1">
        <span class="block truncate font-semibold text-highlighted" :class="compact ? 'text-xs' : 'text-sm'" :title="player.name">{{ player.name }}</span>
        <span class="block truncate text-dimmed" :class="compact ? 'text-[10px]' : 'text-[11px]'">{{ [player.team, player.region, rankName(player.rank)].filter(Boolean).join(' · ') }}</span>
        <span v-if="missing?.has(player.name)" class="block text-[10px] text-warning">{{ t('analytics.players.noGame') }}</span>
      </span>
      <UIcon v-if="pending === player.name" name="i-lucide-loader-circle" class="size-4 shrink-0 text-dimmed" />
      <span class="shrink-0 text-right">
        <span v-if="player.winRate !== null" class="block font-semibold tabular-nums" :class="[player.winRate >= 0.5 ? 'text-primary' : 'text-error', compact ? 'text-xs' : 'text-sm']">{{ formatPercentage(player.winRate, 0) }}</span>
        <span class="block text-[10px] tabular-nums text-dimmed">{{ t('analytics.players.games', { games: player.games }) }}</span>
      </span>
    </li>
  </ol>
</template>
