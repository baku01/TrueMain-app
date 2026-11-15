<script setup lang="ts">
import type { KitRunePage } from '#shared/types/kit'
import type { ItemSetNamedBlocks } from '~/composables/useItemSetImport'
import type { Guide } from '~/utils/mobafire'
import { getActiveLocale } from '#common/utils/i18n'
import { formatTierName, tierColor } from '#common/utils/tiers'
import { guideRoleIcon } from '~/utils/guide-roles'

/**
 * A guide's banner, framed as the app's champion pages frame theirs
 * (`PageHero`): the skin the author chose, Riot's full splash of it, anchored
 * right and fading under the title (`useGuideSkin`) — the champion's base
 * splash where the skin's fails, MOBAFire's own banner where the guide names
 * no champion —; the skin's tile beside the title; who wrote it and when; the
 * imports in the corner, the point of the page — the rune page on show, and
 * the build's items as one set —; and the guide's figures in one strip under
 * it all: its rating and votes, the author's rank, its views and comments.
 */
const props = defineProps<{
  guide: Guide
  championId: number | null
  /** The champion's name in the player's language. */
  championName: string | null
  /** The rune page on show, ready to import; null with `runeProblem` saying why, or for a build without runes. */
  runePage: KitRunePage | null
  runeProblem: string | null
  itemSet: ItemSetNamedBlocks | null
}>()

const { t } = useT()
const { splash, tile, baseSplash, baseTile } = useGuideSkin(() => props.guide.banner, () => props.guide.champion)
/**
 * The author's picture is a skin too: the game's tile of it, MOBAFire's own
 * where the tile fails, and the author's initial under both — what shows when
 * neither loads. The site's picture alone could come up empty in the app's
 * window though the site serves it as it serves its others; the game's art
 * comes from Data Dragon, as every other picture of the app.
 */
const { tile: authorTile } = useGuideSkin(() => props.guide.author.avatar)
const { portraitOf } = useChampionStatics()

const updated = computed(() => (props.guide.updatedAt
  ? new Intl.DateTimeFormat(getActiveLocale(), { day: 'numeric', month: 'long', year: 'numeric' }).format(props.guide.updatedAt)
  : null))

/** The ranks Community Dragon draws a crest for; another word is written alone. */
const CRESTS = new Set(['iron', 'bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond', 'master', 'grandmaster', 'challenger'])
const initial = computed(() => props.guide.author.name.trim().charAt(0).toUpperCase() || '?')
</script>

<template>
  <section class="on-art relative overflow-hidden rounded-lg border border-default bg-ink-950">
    <div class="pointer-events-none absolute inset-0" aria-hidden="true">
      <GuidesArt
        :sources="[splash, baseSplash, guide.banner]"
        class="absolute right-0 top-[-24%] h-[190%] w-auto max-w-none [mask-image:linear-gradient(to_right,transparent,black_35%)]"
      />
    </div>
    <div class="pointer-events-none absolute inset-0 bg-linear-to-r from-ink-950/90 via-ink-950/45 to-transparent" />
    <div class="pointer-events-none absolute inset-0 bg-linear-to-t from-ink-950 via-ink-950/40 to-transparent" />

    <div class="relative flex flex-col gap-5 p-5">
      <div class="flex flex-wrap items-start gap-x-4 gap-y-3">
        <div class="flex min-w-0 flex-[1_1_28rem] items-start gap-4">
          <span class="relative size-[72px] shrink-0 overflow-hidden rounded-lg bg-ink-950/60 shadow-lg ring-1 ring-white/10">
            <GuidesArt :sources="[tile, baseTile, championId ? portraitOf(championId) : null]" class="size-full object-cover" />
            <img v-if="guide.role" :src="guideRoleIcon(guide.role)" :alt="t(`guides.role.${guide.role}`)" class="absolute bottom-1 right-1 size-5 rounded bg-ink-950/80 p-0.5">
          </span>
          <div class="min-w-0 [text-shadow:0_1px_12px_rgb(0_0_0/0.6)]">
            <h1 class="line-clamp-2 text-2xl font-semibold leading-tight text-highlighted" :title="guide.title">{{ guide.title }}</h1>
            <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted">
              <span v-if="championName" class="font-medium text-default">{{ championName }}</span>
              <span v-if="guide.role" class="flex items-center gap-1.5">
                <img :src="guideRoleIcon(guide.role)" alt="" class="size-4 opacity-80">{{ t(`guides.role.${guide.role}`) }}
              </span>
              <span class="flex items-center gap-2">
                <span class="relative grid size-6 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/20 text-[11px] font-bold text-primary ring-1 ring-white/15">
                  {{ initial }}
                  <GuidesArt :sources="[authorTile, guide.author.avatar]" class="absolute inset-0 size-full object-cover" />
                </span>
                <span>{{ t('guides.buildBy') }} <span class="font-semibold text-primary">{{ guide.author.name }}</span></span>
              </span>
              <span v-if="updated" class="flex items-center gap-1.5"><UIcon name="i-lucide-calendar-clock" class="size-3.5" />{{ t('guides.updatedOn', { date: updated }) }}</span>
            </div>
          </div>
        </div>

        <!-- The imports: the rune page on show and the whole itemization, the guide's point. -->
        <div class="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
          <BuildRuneImport
            v-if="runePage && championName"
            :page="runePage"
            :champion="championName"
            :closed-hint="t('guides.importClosed')"
            labeled
            size="md"
            color="primary"
            variant="solid"
          />
          <!-- A page that cannot be imported says why, rather than vanish. -->
          <UTooltip v-else-if="runeProblem" :text="runeProblem">
            <span class="inline-flex" tabindex="0">
              <UButton icon="i-lucide-download" :label="t('build.importRunes')" size="md" color="neutral" variant="solid" class="bg-ink-950/70 ring-1 ring-white/10 backdrop-blur-md" disabled />
            </span>
          </UTooltip>
          <BuildItemSetImport
            v-if="itemSet"
            :subject="itemSet"
            :closed-hint="t('guides.importClosed')"
            labeled
            size="md"
            color="primary"
            variant="solid"
          />
        </div>
      </div>

      <!-- The guide's figures as one strip, cells split by hairlines (Blitz's way). -->
      <div class="grid grid-cols-2 overflow-hidden rounded-lg bg-ink-950/55 ring-1 ring-white/5 backdrop-blur-md sm:grid-cols-4 sm:divide-x sm:divide-white/5">
        <div class="flex flex-col items-center gap-1.5 px-3 py-2.5">
          <span class="stat-label">{{ t('guides.rating') }}</span>
          <GuidesRating :score="guide.score" :current="guide.current" :up="guide.votesUp" :down="guide.votesDown" />
        </div>
        <div class="flex flex-col items-center gap-1.5 px-3 py-2.5">
          <span class="stat-label">{{ t('guides.authorRank') }}</span>
          <span v-if="guide.rank" class="flex items-center gap-2 text-base font-semibold" :class="tierColor(guide.rank)">
            <RankIcon v-if="CRESTS.has(guide.rank)" :tier="guide.rank" :size="26" />{{ formatTierName(guide.rank) }}
          </span>
          <span v-else class="stat-value text-xl leading-none text-dimmed">–</span>
        </div>
        <div class="flex flex-col items-center gap-1.5 px-3 py-2.5">
          <span class="stat-label">{{ t('guides.viewsLabel') }}</span>
          <span class="stat-value text-xl leading-none">{{ guide.views ?? '–' }}</span>
        </div>
        <div class="flex flex-col items-center gap-1.5 px-3 py-2.5">
          <span class="stat-label">{{ t('guides.commentsLabel') }}</span>
          <span class="stat-value text-xl leading-none">{{ guide.comments ?? '–' }}</span>
        </div>
      </div>
    </div>
  </section>
</template>
