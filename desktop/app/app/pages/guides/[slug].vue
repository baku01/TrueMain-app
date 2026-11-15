<script setup lang="ts">
import { getActiveLocale } from '#common/utils/i18n'
import { formatTierName, tierColor } from '#common/utils/tiers'
import { guideRoleIcon } from '~/utils/guide-roles'
import { nameKey } from '~/utils/guide-entities'

/**
 * One MOBAFire guide, as the site lays it: the banner — the author's splash,
 * the title, the rating, the author's rank, views and comments —, then each
 * of its builds (`GuidesBuildPanel`), its threats and synergies, and its
 * chapters, the author's own writing (`useGuide`).
 */
const { t } = useT()
const route = useRoute()
const checking = useMobafireCheck()
const slug = computed(() => String(route.params.slug ?? ''))
const { guide, status, translating, translatable, reload } = useGuide(slug)
const entities = useGuideIndex()
const { nameOf } = useChampionStatics()
/** The guide's champion in the app's data: its abilities, and its name in the player's language. */
const championId = computed(() => (guide.value?.champion && entities.value ? entities.value.champions.get(nameKey(guide.value.champion)) ?? null : null))
const championName = computed(() => (championId.value ? nameOf(championId.value) : guide.value?.champion ?? null))

const buildIndex = ref(0)
watch(slug, () => (buildIndex.value = 0))
const build = computed(() => guide.value?.builds[buildIndex.value] ?? guide.value?.builds[0] ?? null)

const updated = computed(() => (guide.value?.updatedAt
  ? new Intl.DateTimeFormat(getActiveLocale(), { day: 'numeric', month: 'long', year: 'numeric' }).format(guide.value.updatedAt)
  : null))

/** The list of the champion's guides: the site's word for the champion is its name, lowercased and joined (`kha'zix` → `khazix`). */
const championList = computed(() => {
  const name = guide.value?.champion
  if (!name) return null
  const word = name.toLowerCase().replace(/&/g, 'amp').replace(/['.]/g, '').trim().replace(/\s+/g, '-')
  return { path: '/guides', query: { champion: word } }
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-6 *:shrink-0">
    <div class="flex shrink-0 items-center gap-2">
      <UButton to="/guides" icon="i-lucide-arrow-left" :label="t('guides.back')" color="neutral" variant="ghost" size="sm" />
      <UButton v-if="championList && guide" :to="championList" icon="i-lucide-list" :label="t('guides.moreFor', { champion: championName ?? '' })" color="neutral" variant="ghost" size="sm" />
      <GuidesTranslationToggle v-if="translatable && guide" class="ml-auto" :translating="translating" />
    </div>

    <p v-if="checking" class="flex shrink-0 items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm text-default">
      <UIcon name="i-lucide-shield-check" class="size-4 shrink-0 text-primary" />{{ t('guides.check') }}
    </p>

    <div v-if="status === 'error'" class="surface rounded-xl p-8 text-center">
      <p class="text-sm text-muted">{{ t('guides.guideError') }}</p>
      <UButton class="mt-3" :label="t('guides.retry')" icon="i-lucide-refresh-cw" size="sm" @click="reload()" />
    </div>
    <div v-else-if="!guide" aria-busy="true" class="flex flex-col gap-3">
      <USkeleton class="h-52 w-full rounded-xl" />
      <USkeleton class="h-32 w-full rounded-xl" />
      <USkeleton class="h-64 w-full rounded-xl" />
    </div>

    <template v-else>
      <!-- The banner: the author's splash behind the title, the rating, and who wrote it. -->
      <header class="surface relative shrink-0 overflow-hidden rounded-xl">
        <img v-if="guide.banner" :src="guide.banner" alt="" class="absolute inset-0 size-full object-cover object-[50%_25%] [mask-image:linear-gradient(to_right,transparent,black_55%)]">
        <div class="relative flex min-h-56 flex-col justify-between gap-4 bg-gradient-to-r from-default via-default/80 to-transparent p-6">
          <div class="max-w-[60%]">
            <h1 class="flex items-start gap-2 text-xl font-semibold tracking-tight text-highlighted">
              <img v-if="guide.role" :src="guideRoleIcon(guide.role)" alt="" class="mt-1 size-5 shrink-0">
              <span>{{ guide.title }}</span>
            </h1>
            <p v-if="updated" class="mt-1 text-xs uppercase tracking-wider text-muted">{{ t('guides.updatedOn', { date: updated }) }}</p>
          </div>
          <div class="flex flex-wrap items-center gap-6">
            <GuidesRating :score="guide.score" :current="guide.current" :up="guide.votesUp" :down="guide.votesDown" large />
            <span v-if="guide.rank" class="rounded-md bg-black/60 px-2.5 py-1 text-xs font-bold uppercase tracking-widest" :class="tierColor(guide.rank)">{{ formatTierName(guide.rank) }}</span>
          </div>
          <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
            <span class="flex items-center gap-2">
              <img v-if="guide.author.avatar" :src="guide.author.avatar" alt="" class="size-7 rounded-full ring-1 ring-white/20">
              <span>{{ t('guides.buildBy') }} <span class="font-semibold text-primary">{{ guide.author.name }}</span></span>
            </span>
            <span v-if="guide.views" class="flex items-center gap-1"><UIcon name="i-lucide-eye" class="size-3.5" />{{ t('guides.views', { views: guide.views }) }}</span>
            <span v-if="guide.comments !== null" class="flex items-center gap-1"><UIcon name="i-lucide-messages-square" class="size-3.5" />{{ t('guides.comments', { count: guide.comments }) }}</span>
          </div>
        </div>
      </header>

      <div v-if="guide.builds.length > 1" class="flex shrink-0 flex-wrap gap-1">
        <UButton
          v-for="(entry, index) in guide.builds"
          :key="index"
          :label="t('guides.build', { number: index + 1 })"
          size="sm"
          :color="index === buildIndex ? 'primary' : 'neutral'"
          :variant="index === buildIndex ? 'soft' : 'ghost'"
          @click="buildIndex = index"
        />
      </div>
      <GuidesBuildPanel v-if="build" :build="build" :champion-id="championId" :champion-name="championName" />

      <GuidesMatchups v-if="guide.threats.length || guide.synergies.length" :threats="guide.threats" :synergies="guide.synergies" />

      <template v-if="guide.chapters.length">
        <h2 class="stat-label px-1 pt-2">{{ t('guides.chapters') }}</h2>
        <GuidesChapter v-for="(chapter, index) in guide.chapters" :key="`${chapter.title}-${index}`" :chapter="chapter" />
      </template>
    </template>
  </div>
</template>
