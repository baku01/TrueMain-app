<script setup lang="ts">
import type { BuildOption, CompositionBuildRequest } from '~/types/build'
import type { DraftBuild } from '~/composables/useDraftBuild'
import type { Kit } from '#shared/types/kit'
import type { DraftItemPush } from '~/utils/draft-damage'
import { externalSource, fromBlitz } from '~/utils/data-source'

/**
 * A champion's build, laid out the way the reference client does after a pick
 * — the builds to choose from and the champion's true mains down the left, the
 * build itself on the right — the core (`BuildCore`, the site's icons and
 * rune block laid out for the pane) over the site's build tree.
 *
 * With a draft, its own build (computed against the draft as it stands) is the
 * first row and the default; the champion's lane builds follow, so the player
 * can compare the draft's answer with what the lane usually runs. A true main
 * clicked in the list shows that player's own build on the champion instead —
 * in a draft, their build against it, read from their games alone (#1987), or
 * their usual one when they have no game of it.
 *
 * In champion select, the player's kits on the champion and lane (#2185,
 * #2205) are listed too, between the builds and the mains: one picked takes
 * the pane (`kitId`), a build row or a main picked goes back to the builds.
 * The default stays the first build — the draft's own.
 */
const props = defineProps<{
  championId: number
  position: string
  /** The build computed for the draft, when there is one. */
  draft?: { build: DraftBuild | null, pending: boolean, error: string | null, opponentId?: number | null, label?: string, request?: CompositionBuildRequest | null } | null
  /** The player's kits on this champion and lane, offered beside the builds. */
  kits?: Kit[]
  /** The items the draft moves the build toward (`useDraftItemAdvice`), marked in the Blitz panel. */
  itemAdvice?: DraftItemPush[]
}>()

/** The kit picked in the list, shown instead of a build; `null` while a build or a main is. */
const kitId = defineModel<string | null>('kitId', { default: null })
const kitShown = computed(() => props.kits?.find(kit => kit.id === kitId.value) ?? null)

const { t } = useT()
const { response, pending: lanePending } = useChampionBuilds(toRef(props, 'championId'), toRef(props, 'position'))
const { items, summoners, runeTree, pending: staticPending, loadChampion, championStatic } = useStaticData()
const { patch } = useChampionStatics()

// The champion's spells need the patch, which may land after the view does.
watch(() => `${props.championId}:${patch.value}`, () => loadChampion(props.championId), { immediate: true })

const options = computed<BuildOption[]>(() => {
  const list: BuildOption[] = []
  const draftBuild = props.draft?.build
  if (draftBuild && draftBuild.championId === props.championId) {
    list.push({
      key: 'draft',
      core: draftBuild.core,
      firstItemId: draftBuild.firstItemId,
      keystoneId: draftBuild.core.runePage?.primaryKeystoneId ?? null,
      buildTree: draftBuild.buildTree,
      games: draftBuild.games,
      winRate: draftBuild.games > 0 ? draftBuild.wins / draftBuild.games : null,
      standard: draftBuild.source === 'standard',
    })
  }
  for (const build of response.value?.builds ?? []) {
    list.push({
      // The whole path: two builds may open on the same item with the same keystone (another source's cores do).
      key: `lane-${build.firstItemId}-${build.primaryKeystoneId}-${(build.core.itemPath?.itemIds ?? []).join('_')}-${(build.core.boots?.itemIds ?? []).join('_')}`,
      core: build.core,
      firstItemId: build.firstItemId,
      keystoneId: build.primaryKeystoneId,
      buildTree: build.buildTree,
      games: build.games,
      winRate: build.winRate,
    })
  }
  return list
})

/** The row on screen: a build's key, or `pro` for the player picked in the list. */
const selected = ref<string | null>(null)

// A new champion puts the view back on its first row; a draft build arriving
// takes the first row too, unless a player's build is on screen.
watch(() => `${props.championId}:${props.position}`, () => {
  pro.value = null
  selected.value = options.value[0]?.key ?? null
})
watch(() => options.value[0]?.key, (first) => {
  if (selected.value !== 'pro') selected.value = first ?? null
})

/** A pro picked in the list (Blitz only): their last game's build, and whose it is. */
const blitz = fromBlitz()
/** Settings picked a source other than TrueMain: its lane builds show every option it measured. */
const external = externalSource() !== null
const pro = ref<{ option: BuildOption, player: string } | null>(null)
function selectPro(option: BuildOption, player: string) {
  kitId.value = null
  pro.value = { option, player }
  selected.value = 'pro'
}

const shown = computed(() => {
  if (selected.value === 'pro' && pro.value) return pro.value.option
  return options.value.find(option => option.key === selected.value) ?? options.value[0] ?? null
})
/** What the item set button imports: the build on screen, named for the set's title. */
const itemSetSubject = computed(() => {
  const name = championStatic(props.championId)?.championName
  return shown.value && name ? { championId: props.championId, champion: name, position: props.position, build: shown.value } : null
})
const waiting = computed(() => !shown.value && (lanePending.value || props.draft?.pending))
const emptyMessage = computed(() => t('build.view.none'))
</script>

<template>
  <div class="surface relative grid h-full min-h-0 grid-cols-[18rem_minmax(0,1fr)] overflow-hidden rounded-xl">
    <!-- The thin bar that says a newer draft is being asked for, without hiding the answer on screen. -->
    <div v-if="draft?.pending && shown" class="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden">
      <div class="h-full w-1/3 animate-[tm-scan_1.1s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-primary to-transparent" />
    </div>

    <aside class="flex min-h-0 flex-col border-r border-default bg-muted/50">
      <div class="border-b border-default px-3 py-2.5">
        <slot name="header" />
      </div>
      <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-2">
        <BuildList
          :model-value="kitShown ? null : selected"
          :options="options"
          :pending="lanePending || !!draft?.pending"
          :draft-label="draft?.label"
          :draft-opponent="draft?.opponentId ?? null"
          @update:model-value="selected = $event; kitId = null"
        />
        <section v-if="kits?.length">
          <h3 class="px-2 pb-1 stat-label">{{ t('kit.list.label') }}</h3>
          <KitList v-model="kitId" :kits="kits" />
        </section>
        <!-- Settings reads from Blitz: its pros, each with their last game's build. -->
        <BuildPros v-if="blitz" :champion-id="championId" :position="position" :selected-key="selected === 'pro' && !kitShown ? pro?.option.key : null" @select="selectPro" />
        <!-- op.gg and lolalytics: their ranked players; a pick reads that player's last game on the champion from Blitz. -->
        <ProbuildTopPlayers v-else-if="external" :champion-id="championId" :position="position" compact selectable @select="selectPro" />
      </div>
    </aside>

    <div v-if="kitShown" class="min-h-0 space-y-4 overflow-y-auto p-3">
      <slot name="advice" />
      <KitBuild :kit="kitShown" />
    </div>

    <div v-else-if="shown" class="min-h-0 space-y-4 overflow-y-auto p-3">
      <p v-if="selected === 'pro' && pro" class="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs text-default">
        <UIcon name="i-lucide-trophy" class="size-4 shrink-0 text-primary" />
        {{ t('pro.banner', { player: pro.player, result: pro.option.winRate ? t('pro.win') : t('pro.loss') }) }}
      </p>

      <!-- What the page around the view adds above the build: the draft's item advice (#1907). -->
      <slot name="advice" />

      <!-- Settings reads from another source: a lane build shows every option it measured, each with its win rate. -->
      <BuildSourcePanel
        v-if="external && shown.key.startsWith('lane-')"
        :champion-id="championId"
        :position="position"
        :initial-core="shown.core.itemPath?.itemIds ?? null"
        :champion-static="championStatic(championId)"
        :champion-name="championStatic(championId)?.championName || null"
        :items="items"
        :summoners="summoners"
        :rune-tree="runeTree"
        :advice="itemAdvice ?? []"
      />
      <BuildCore
        v-else
        :summoner-spells="shown.core.summonerSpells"
        :starter-items="shown.core.starterItems"
        :skill-order="shown.core.skillOrder"
        :boots="shown.core.boots"
        :rune-page="shown.core.runePage"
        :champion-static="championStatic(championId)"
        :items-map="items"
        :summoners-map="summoners"
        :summoners-pending="staticPending"
        :rune-tree="runeTree"
        :no-runes-message="shown.key === 'draft' ? t('build.view.noRunes') : null"
        :champion-name="championStatic(championId)?.championName || null"
      >
        <template #tree>
          <BuildTreeBlock :build="shown" :items="items" :item-set-subject="itemSetSubject" />
        </template>
      </BuildCore>
    </div>

    <div v-else class="flex flex-col items-center justify-center gap-2 p-8 text-center">
      <UIcon :name="waiting ? 'i-lucide-loader-circle' : 'i-lucide-scroll-text'" class="size-6 text-dimmed" />
      <p class="text-sm text-muted">{{ waiting ? t('build.view.reading') : emptyMessage }}</p>
      <p v-if="draft?.error && !waiting" class="max-w-xs text-xs text-dimmed">{{ draft.error }}</p>
    </div>
  </div>
</template>
