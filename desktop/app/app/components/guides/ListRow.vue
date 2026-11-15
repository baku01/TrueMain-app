<script setup lang="ts">
import type { GuideSummary } from '~/utils/mobafire'
import { getActiveLocale } from '#common/utils/i18n'
import { formatTierName, tierColor } from '#common/utils/tiers'
import { guideRoleIcon } from '~/utils/guide-roles'

/**
 * One guide of MOBAFire's list, laid out as the site's row: its rating ring
 * and votes, the champion's picture the author chose with their rank under it,
 * the lane, the title, who wrote it and when they updated it, its tags.
 */
const props = defineProps<{ guide: GuideSummary }>()
const { t } = useT()

const updated = computed(() => (props.guide.updatedAt
  ? new Intl.DateTimeFormat(getActiveLocale(), { day: 'numeric', month: 'long', year: 'numeric' }).format(props.guide.updatedAt)
  : null))
</script>

<template>
  <NuxtLink
    :to="`/guides/${guide.slug}`"
    class="surface group flex items-stretch gap-4 overflow-hidden rounded-xl pr-4 transition-[filter] hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
  >
    <div class="flex w-40 shrink-0 items-center border-r border-default/60 px-4">
      <GuidesRating :score="guide.score" :current="guide.current" :up="guide.votesUp" :down="guide.votesDown" />
    </div>
    <div class="relative w-22 shrink-0 overflow-hidden">
      <img v-if="guide.avatar" :src="guide.avatar" :alt="guide.champion ?? ''" class="img-skeleton size-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy">
      <span
        v-if="guide.rank"
        class="absolute inset-x-0 bottom-0 truncate bg-black/70 px-1 py-0.5 text-center text-[9px] font-bold uppercase tracking-wider"
        :class="tierColor(guide.rank)"
      >{{ formatTierName(guide.rank) }}</span>
    </div>
    <div class="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-3">
      <h3 class="flex min-w-0 items-center gap-2 text-sm font-semibold text-highlighted">
        <img v-if="guide.role" :src="guideRoleIcon(guide.role)" alt="" class="size-4 shrink-0 opacity-80">
        <span class="truncate">{{ guide.title }}</span>
      </h3>
      <p class="truncate text-xs text-muted">
        {{ [guide.author ? t('guides.by', { author: guide.author }) : null, updated ? t('guides.updated', { date: updated }) : null].filter(Boolean).join(' · ') }}
      </p>
      <div v-if="guide.tags.length" class="flex flex-wrap gap-1">
        <UBadge v-for="tag in guide.tags" :key="tag" :label="tag" color="primary" variant="subtle" size="sm" class="uppercase" />
      </div>
    </div>
  </NuxtLink>
</template>
