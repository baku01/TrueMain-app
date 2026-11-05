<script setup lang="ts">
import type { ChampionStaticListItem } from '#shared/types/static-data'
import type { ChampionMastery } from '~/types/lcu'
import { championDisplayName } from '#shared/utils/champion-name'
import { formatRelativeTime } from '#common/utils/relativeTime'

/**
 * A player's top five champions by mastery: each one's level (the client's
 * crest from level 4, the number below it) and its exact points — the
 * logged-in player's from their client (`championMastery`), another's from
 * championmastery.gg. Where only Blitz answered, which keeps no points, when it
 * was last played stands in.
 */
const props = defineProps<{
  mastery: ChampionMastery[]
  champions: ChampionStaticListItem[]
}>()

const { t } = useT()
const SHOWN = 5
const championById = computed(() => new Map(props.champions.map(c => [c.championId, c])))
const canonicalIcon = useCanonicalIcon()

/** CommunityDragon has the client's small crests for levels 4 to 10; past 10 the crest stays the tenth. */
function crestOf(level: number): string | null {
  if (level < 4) return null
  return `https://raw.communitydragon.org/latest/game/assets/ux/mastery/legendarychampionmastery/masterycrest_level${Math.min(level, 10)}_minis.png`
}

const rows = computed(() => props.mastery.slice(0, SHOWN).map(entry => ({
  ...entry,
  name: championDisplayName(entry.championId, championById.value.get(entry.championId)),
  icon: canonicalIcon(championById.value.get(entry.championId)?.iconUrl),
  crest: crestOf(entry.championLevel),
  detail: entry.championPoints !== undefined
    ? t('dash.mastery.points', { points: entry.championPoints.toLocaleString() })
    : entry.lastPlayTime ? t('dash.mastery.played', { ago: formatRelativeTime(new Date(entry.lastPlayTime).toISOString()) }) : '',
})))
</script>

<template>
  <section v-if="mastery.length" class="flex flex-col gap-2">
    <h2 class="text-xs font-semibold uppercase tracking-wide text-muted">{{ t('dash.mastery.title') }}</h2>
    <div class="surface overflow-hidden rounded-lg">
      <ul class="flex flex-col divide-y divide-default/40">
        <li v-for="row in rows" :key="row.championId" class="flex items-center gap-3 px-3 py-2">
          <img v-if="row.icon" :src="row.icon" :alt="row.name" width="36" height="36" class="img-skeleton size-9 shrink-0 rounded-md">
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-highlighted">{{ row.name }}</p>
            <p class="text-[11px] tabular-nums text-muted">{{ row.detail }}</p>
          </div>
          <div class="flex w-10 shrink-0 flex-col items-center" :title="t('dash.mastery.level', { level: row.championLevel })">
            <img v-if="row.crest" :src="row.crest" alt="" class="size-7 object-contain">
            <span class="text-[10px] font-bold tabular-nums text-highlighted">{{ t('dash.mastery.short', { level: row.championLevel }) }}</span>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>
