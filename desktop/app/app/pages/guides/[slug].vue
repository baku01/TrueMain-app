<script setup lang="ts">
import type { ItemSetNamedBlocks } from '~/composables/useItemSetImport'
import { nameKey, runePageOf } from '~/utils/guide-entities'
import { guideItemBlocks, guideSetTitle, unresolvedRunes } from '~/utils/guide-build'

/**
 * One MOBAFire guide, read top-down as the app's build pages read: the
 * banner — the author's skin, the title, who wrote it, its figures — with the
 * build's imports in its corner (`GuidesHero`); the build at a glance and the
 * author's item sections as a buying progression (`GuidesBuildPanel`); the
 * threats and synergies; and the author's chapters with their contents beside
 * them. A bar of the page's parts stays at the top as it scrolls, the builds'
 * switch in it for a guide of several.
 *
 * In a language other than English the guide is read as the author wrote it
 * and replaced, part by part, by its translation as it comes (`useGuide`): no
 * switch back, the app's language is the switch.
 */
const { t } = useT()
const route = useRoute()
const checking = useMobafireCheck()
const slug = computed(() => String(route.params.slug ?? ''))
const { guide, status, translating, reload } = useGuide(slug)
const entities = useGuideIndex()
const { nameOf } = useChampionStatics()
const { loadChampion } = useStaticData()

/** The guide's champion in the app's data: its abilities, and its name in the player's language. */
const championId = computed(() => (guide.value?.champion && entities.value ? entities.value.champions.get(nameKey(guide.value.champion)) ?? null : null))
const championName = computed(() => (championId.value ? nameOf(championId.value) : guide.value?.champion ?? null))
// The champion's abilities asked for as soon as the champion is known, not when the ability order mounts.
watch(championId, id => id && loadChampion(id), { immediate: true })

const buildIndex = ref(0)
const runeIndex = ref(0)
const spellIndex = ref(0)
watch(slug, () => (buildIndex.value = 0))
watch([slug, buildIndex], () => {
  runeIndex.value = 0
  spellIndex.value = 0
})
const build = computed(() => guide.value?.builds[buildIndex.value] ?? guide.value?.builds[0] ?? null)

/** The rune page on show, as the banner imports it — or why it cannot. */
const runePage = computed(() => build.value?.runes[runeIndex.value] ?? build.value?.runes[0] ?? null)
const resolvedRunes = computed(() => (runePage.value && entities.value ? runePageOf(runePage.value, entities.value) : null))
const runeProblem = computed(() => {
  if (!runePage.value || !entities.value || resolvedRunes.value) return null
  const missing = unresolvedRunes(runePage.value, entities.value)
  return missing.length ? t('guides.runesUnresolved', { runes: missing.join(', ') }) : t('guides.runesIncomplete')
})

/** The build's whole itemization as one item set (`guideItemBlocks`): its recommended items, then each of the author's sections. */
const itemSet = computed<ItemSetNamedBlocks | null>(() => {
  const value = guide.value
  if (!value || !build.value || !entities.value || !championId.value) return null
  const named = guideItemBlocks(build.value, entities.value, { recommended: t('guides.recommended'), untitled: t('guides.items') })
  if (!named.length) return null
  const champion = championName.value ?? value.champion ?? ''
  return { championId: championId.value, champion, title: guideSetTitle(champion, value.title), named }
})

/** The list of the champion's guides: the site's word for the champion is its name, lowercased and joined (`kha'zix` → `khazix`). */
const championList = computed(() => {
  const name = guide.value?.champion
  if (!name) return null
  const word = name.toLowerCase().replace(/&/g, 'amp').replace(/['.]/g, '').trim().replace(/\s+/g, '-')
  return { path: '/guides', query: { champion: word } }
})

/** The page's parts, for the bar at its top: those the guide has. */
const parts = computed(() => {
  const value = guide.value
  if (!value) return []
  return [
    build.value && { id: 'guide-build', label: t('guides.partBuild') },
    build.value?.items.length && { id: 'guide-items', label: t('guides.itemPath') },
    (value.threats.length || value.synergies.length) && { id: 'guide-matchups', label: t('guides.partMatchups') },
    value.chapters.length && { id: 'guide-chapters', label: t('guides.partGuide') },
  ].filter((part): part is { id: string, label: string } => !!part)
})

const scroller = useTemplateRef<HTMLElement>('scroller')
const chapterIds = computed(() => guide.value?.chapters.map((_, index) => `guide-chapter-${index}`) ?? [])
/** The part and the chapter read now: the last whose top has passed under the bar. */
const current = ref<string | null>(null)
const currentChapter = ref<string | null>(null)
let frame = 0
function spy() {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(() => {
    const root = scroller.value
    if (!root) return
    const line = root.getBoundingClientRect().top + 96
    const passed = (ids: string[]) => ids.filter(id => (document.getElementById(id)?.getBoundingClientRect().top ?? Infinity) <= line).at(-1) ?? null
    current.value = passed(parts.value.map(part => part.id)) ?? parts.value[0]?.id ?? null
    currentChapter.value = passed(chapterIds.value) ?? chapterIds.value[0] ?? null
  })
}
watch(guide, () => nextTick(spy))
onBeforeUnmount(() => cancelAnimationFrame(frame))

function go(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div ref="scroller" class="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-6 *:shrink-0" @scroll.passive="spy">
    <div class="flex items-center gap-2">
      <UButton to="/guides" icon="i-lucide-arrow-left" :label="t('guides.back')" color="neutral" variant="ghost" size="sm" />
      <UButton v-if="championList && guide" :to="championList" icon="i-lucide-list" :label="t('guides.moreFor', { champion: championName ?? '' })" color="neutral" variant="ghost" size="sm" />
    </div>

    <p v-if="checking" class="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm text-default">
      <UIcon name="i-lucide-shield-check" class="size-4 shrink-0 text-primary" />{{ t('guides.check') }}
    </p>

    <div v-if="status === 'error'" class="surface rounded-xl p-8 text-center">
      <p class="text-sm text-muted">{{ t('guides.guideError') }}</p>
      <UButton class="mt-3" :label="t('guides.retry')" icon="i-lucide-refresh-cw" size="sm" @click="reload()" />
    </div>
    <div v-else-if="!guide" aria-busy="true" class="flex flex-col gap-3">
      <USkeleton class="h-56 w-full rounded-lg" />
      <USkeleton class="h-10 w-full rounded-lg" />
      <div class="grid gap-3 lg:grid-cols-[23rem_minmax(0,1fr)]">
        <USkeleton class="h-80 rounded-xl" />
        <USkeleton class="h-80 rounded-xl" />
      </div>
    </div>

    <template v-else>
      <GuidesHero
        :guide="guide"
        :champion-id="championId"
        :champion-name="championName"
        :rune-page="resolvedRunes"
        :rune-problem="runeProblem"
        :item-set="itemSet"
      />

      <!-- The page's parts, at its top as it scrolls; a guide's builds beside them. -->
      <nav class="sticky top-[-1.5rem] z-20 -mx-6 flex flex-wrap items-end gap-x-6 border-b border-default bg-default/85 px-6 pt-3 backdrop-blur-md">
        <button
          v-for="part in parts"
          :key="part.id"
          type="button"
          class="tm-tab"
          :data-active="current === part.id || undefined"
          :aria-current="current === part.id ? 'location' : undefined"
          @click="go(part.id)"
        >
          {{ part.label }}
        </button>
        <div v-if="guide.builds.length > 1" class="mb-2 ml-auto flex items-center gap-1 rounded-lg bg-elevated/60 p-0.5 ring-1 ring-default" role="tablist" :aria-label="t('guides.builds')">
          <button
            v-for="(entry, index) in guide.builds"
            :key="index"
            type="button"
            role="tab"
            :aria-selected="index === buildIndex"
            class="rounded-md px-2.5 py-1 text-xs font-semibold transition-colors"
            :class="index === buildIndex ? 'bg-primary/15 text-highlighted ring-1 ring-primary/40' : 'text-muted hover:text-highlighted'"
            @click="buildIndex = index"
          >
            {{ t('guides.build', { number: index + 1 }) }}
          </button>
        </div>
        <!-- While the translation comes: a glint along the bar, the page readable under it as written. -->
        <GuidesGlint v-if="translating" />
      </nav>

      <GuidesBuildPanel
        v-if="build"
        id="guide-build"
        v-model:rune-page="runeIndex"
        v-model:spell-set="spellIndex"
        class="scroll-mt-16"
        :build="build"
        :champion-id="championId"
        :champion-name="championName"
        :item-set="itemSet"
      />

      <section v-if="guide.threats.length || guide.synergies.length" id="guide-matchups" class="flex scroll-mt-16 flex-col gap-2">
        <h2 class="stat-label px-1">{{ t('guides.partMatchups') }}</h2>
        <GuidesMatchups :threats="guide.threats" :synergies="guide.synergies" />
      </section>

      <!-- The author's chapters, their contents beside them on a wide pane, above them on a narrow one. -->
      <section v-if="guide.chapters.length" id="guide-chapters" class="@container flex scroll-mt-16 flex-col gap-2">
        <h2 class="stat-label px-1">{{ t('guides.chapters') }}</h2>
        <div class="grid items-start gap-4 @4xl:grid-cols-[14rem_minmax(0,1fr)]">
          <nav class="surface rounded-xl p-2 @4xl:sticky @4xl:top-16" :aria-label="t('guides.contents')">
            <h3 class="stat-label px-2 pb-1.5 pt-1">{{ t('guides.contents') }}</h3>
            <ol class="flex flex-wrap gap-1 @4xl:flex-col @4xl:gap-0.5">
              <li v-for="(chapter, index) in guide.chapters" :key="`${chapter.title}-${index}`">
                <button
                  type="button"
                  class="flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors"
                  :class="currentChapter === chapterIds[index] ? 'bg-primary/12 font-semibold text-highlighted' : 'text-muted hover:bg-accented/40 hover:text-highlighted'"
                  @click="go(chapterIds[index]!)"
                >
                  <span class="w-4 shrink-0 text-right tabular-nums text-dimmed">{{ index + 1 }}</span>
                  <span class="line-clamp-2 min-w-0">{{ chapter.title }}</span>
                </button>
              </li>
            </ol>
          </nav>
          <div class="flex min-w-0 flex-col gap-3">
            <GuidesChapter
              v-for="(chapter, index) in guide.chapters"
              :id="chapterIds[index]"
              :key="`${chapter.title}-${index}`"
              class="scroll-mt-16"
              :chapter="chapter"
            />
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

