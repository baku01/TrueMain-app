<script setup lang="ts">
import type { GuideSummary } from '~/utils/mobafire'
import { getActiveLocale } from '#common/utils/i18n'
import { formatTierName, tierColor } from '#common/utils/tiers'
import { guideRoleIcon } from '~/utils/guide-roles'
import { nameKey } from '~/utils/guide-entities'

/**
 * One guide of MOBAFire's list, a row of the list's table: the skin the
 * author chose, the game's tile of it fading into the row (`GuidesSkinTile`),
 * the lane on it; the title, the champion in the player's language, who wrote
 * it and when they updated it, its tags; the author's rank; and its rating
 * ring and votes — the columns lined up row under row, to be read down.
 */
const props = defineProps<{ guide: GuideSummary }>()
const { t } = useT()
const index = useGuideIndex()
const { nameOf } = useChampionStatics()

const championId = computed(() => (props.guide.champion && index.value ? index.value.champions.get(nameKey(props.guide.champion)) ?? null : null))
const champion = computed(() => (championId.value ? nameOf(championId.value) : props.guide.champion))
const updated = computed(() => (props.guide.updatedAt
  ? new Intl.DateTimeFormat(getActiveLocale(), { day: 'numeric', month: 'short', year: 'numeric' }).format(props.guide.updatedAt)
  : null))
/** The ranks Community Dragon draws a crest for. */
const CRESTS = new Set(['iron', 'bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond', 'master', 'grandmaster', 'challenger'])
</script>

<template>
  <NuxtLink
    :to="`/guides/${guide.slug}`"
    class="guide-row group relative grid items-center gap-x-4 py-1.5 pr-4 transition-colors hover:bg-accented/35 focus-visible:bg-accented/35 focus-visible:outline-none"
  >
    <span class="relative h-14 w-[4.5rem] overflow-hidden">
      <GuidesSkinTile
        :picture="guide.avatar"
        :champion="guide.champion"
        class="size-full object-cover object-[50%_20%] transition-transform duration-300 [mask-image:linear-gradient(to_right,black_55%,transparent)] group-hover:scale-105"
        loading="lazy"
      />
      <img v-if="guide.role" :src="guideRoleIcon(guide.role)" :alt="t(`guides.role.${guide.role}`)" class="absolute bottom-1 left-1 size-4 rounded bg-ink-950/80 p-px">
    </span>

    <span class="flex min-w-0 flex-col gap-1">
      <span class="truncate text-sm font-semibold text-highlighted group-hover:text-primary">{{ guide.title }}</span>
      <span class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <span v-if="champion" class="font-medium text-toned">{{ champion }}</span>
        <span v-if="guide.author" class="truncate">{{ t('guides.by', { author: guide.author }) }}</span>
        <span v-if="updated" class="flex items-center gap-1 text-dimmed"><UIcon name="i-lucide-clock-3" class="size-3" />{{ updated }}</span>
        <span v-for="tag in guide.tags" :key="tag" class="rounded bg-primary/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-primary ring-1 ring-primary/20">{{ tag }}</span>
      </span>
    </span>

    <span class="guide-row-rank flex items-center gap-1.5 text-xs font-semibold" :class="guide.rank ? tierColor(guide.rank) : 'text-dimmed'">
      <template v-if="guide.rank">
        <RankIcon v-if="CRESTS.has(guide.rank)" :tier="guide.rank" :size="20" loading="lazy" />
        <span class="truncate">{{ formatTierName(guide.rank) }}</span>
      </template>
      <template v-else>–</template>
    </span>

    <GuidesRating :score="guide.score" :current="guide.current" :up="guide.votesUp" :down="guide.votesDown" />
  </NuxtLink>
</template>

<style scoped>
/* The list's columns: the art, the guide, the author's rank, the rating — the rank's column given up on a narrow pane. */
.guide-row {
  grid-template-columns: 4.5rem minmax(0, 1fr) 8.5rem 8.5rem;
}

@container (width < 44rem) {
  .guide-row { grid-template-columns: 4.5rem minmax(0, 1fr) 8.5rem; }
  .guide-row-rank { display: none; }
}
</style>
