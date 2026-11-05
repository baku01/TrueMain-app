<script setup lang="ts">
import type { MatchDetailParticipant } from '#shared/types/match-detail'
import type { ChampionStaticListItem, RuneTreeResponse } from '#shared/types/static-data'
import { championDisplayName } from '#shared/utils/champion-name'
import { runeStats } from '#common/utils/rune-stats'

const { t } = useT()

/**
 * Compact per-player rune summary tile, laid out in a 10-up grid on the Runes
 * tab: champion portrait with its keystone badge, then the primary minor runes,
 * the secondary runes and the stat shards — the scannable OP.GG-style card —
 * and, where the source carried the runes' end-of-game stats (the app's), the
 * damage they dealt, every rune's line in its tooltip.
 */
const props = defineProps<{
  participant: MatchDetailParticipant
  champion: ChampionStaticListItem | null
  runeTree: RuneTreeResponse
}>()

const champName = computed(() => championDisplayName(props.participant.championId, props.champion))

// Keystone is drawn as the badge on the portrait; the row below shows only the
// three minor primary runes (selectionIndex > 0), preserving catalog order.
const primaryMinors = computed(() =>
  props.participant.runes.filter(r => r.styleId === props.participant.primaryStyleId && r.selectionIndex > 0),
)
const secondaryRunes = computed(() =>
  props.participant.runes.filter(r => r.styleId === props.participant.subStyleId),
)
const shards = computed(() =>
  [props.participant.statPerkOffense, props.participant.statPerkFlex, props.participant.statPerkDefense]
    .filter(id => id > 0),
)

const keystone = computed(() =>
  props.participant.keystoneId ? props.runeTree.perks[props.participant.keystoneId] ?? null : null,
)
const stats = computed(() => runeStats(props.participant.runes, props.runeTree.perks))
const STATS_TOOLTIP = { content: 'h-auto max-w-72 flex-col items-start gap-0.5 px-3 py-2 whitespace-normal' }

function perk(id: number) {
  return props.runeTree.perks[id] ?? null
}
</script>

<template>
  <section class="surface flex flex-col items-center gap-2 rounded-md p-3">
    <!-- Portrait + keystone badge -->
    <div class="relative">
      <SkeletonImage
        :src="champion?.iconUrl"
        :alt="champName"
        :title="champName"
        class="size-12 rounded"
      />
      <div
        class="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-elevated ring-1 ring-default/60"
      >
        <GameTooltipPerkIcon
          :perk="keystone"
          :width="24"
          :height="24"
          class="size-6 rounded-full bg-black/50"
        />
      </div>
    </div>

    <p class="mt-1 max-w-full truncate text-[11px] font-medium text-default">
      {{ participant.gameName ?? participant.summonerName }}
    </p>

    <UTooltip v-if="stats.damage !== null" :content="{ side: 'top' }" :ui="STATS_TOOLTIP">
      <p class="cursor-help text-center leading-tight">
        <span class="block text-sm font-semibold tabular-nums text-highlighted">{{ stats.damage.toLocaleString() }}</span>
        <span class="text-[10px] uppercase tracking-wide text-muted">{{ t('match.runes.damage') }}</span>
      </p>
      <template #content>
        <p class="text-sm font-semibold text-highlighted">{{ t('match.runes.stats') }}</p>
        <p v-for="(line, index) in stats.lines" :key="index" class="flex items-center gap-1.5 text-xs text-muted">
          <img v-if="perk(line.perkId)" :src="perk(line.perkId)!.iconUrl" alt="" class="size-4 rounded-full">
          {{ line.text }}
        </p>
      </template>
    </UTooltip>

    <!-- Primary minors -->
    <div class="flex items-center gap-1">
      <GameTooltipPerkIcon
        v-for="(rune, idx) in primaryMinors"
        :key="`p-${idx}`"
        :perk="perk(rune.perkId)"
        :width="22"
        :height="22"
        class="size-[22px] rounded-full bg-black/40"
      />
    </div>

    <!-- Secondary -->
    <div class="flex items-center gap-1">
      <GameTooltipPerkIcon
        v-for="(rune, idx) in secondaryRunes"
        :key="`s-${idx}`"
        :perk="perk(rune.perkId)"
        :width="20"
        :height="20"
        class="size-5 rounded-full bg-black/40"
      />
    </div>

    <!-- Stat shards -->
    <div v-if="shards.length" class="mt-0.5 flex items-center gap-1.5 border-t border-default/40 pt-2">
      <GameTooltipPerkIcon
        v-for="(shard, idx) in shards"
        :key="`shard-${idx}`"
        :perk="perk(shard)"
        :width="16"
        :height="16"
        class="size-4 rounded-full bg-black/40"
      />
    </div>
  </section>
</template>
