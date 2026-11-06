<script setup lang="ts">
import type { BuildOption, CompositionBuildRequest } from '~/types/build'
import type { DraftBuild } from '~/composables/useDraftBuild'
import type { Kit } from '#shared/types/kit'
import type { DraftItemPush } from '~/utils/draft-damage'
import type { ImportChoice } from '~/composables/useDraftAutoImport'
import type { ImportBuild } from '~/utils/recommended-item-set'
import type { ItemSetSubject } from '~/composables/useItemSetImport'
import { externalSource, fromBlitz } from '~/utils/data-source'
import { situationalFromTree } from '~/utils/item-set'
import { formatPercentage } from '#shared/utils/ddragon'
import { kitPaths } from '~/utils/kit-tree'

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
  /** Champion select's layout: the build as Blitz lays it there, runes beside spells, path, situational and max order (`BuildCore`'s `compact`). */
  compact?: boolean
}>()

/** The kit picked in the list, shown instead of a build; `null` while a build or a main is. */
const kitId = defineModel<string | null>('kitId', { default: null })
const prosOpen = ref(false)
const kitShown = computed(() => props.kits?.find(kit => kit.id === kitId.value) ?? null)

const { t } = useT()
const { response, pending: lanePending } = useChampionBuilds(toRef(props, 'championId'), toRef(props, 'position'))
/** Blitz measures builds by lane matchup: against the draft's lane opponent, its builds in those games (Blitz's "matchup builds"). */
const versusOpponent = computed(() => (fromBlitz() ? props.draft?.opponentId ?? null : null))
const { response: versusResponse } = useChampionBuilds(toRef(props, 'championId'), toRef(props, 'position'), versusOpponent)
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
  const versus = versusResponse.value?.championId === props.championId && versusOpponent.value ? versusResponse.value.builds : []
  const rows = [...versus.map(build => ['versus', build] as const), ...(response.value?.builds ?? []).map(build => ['lane', build] as const)]
  for (const [group, build] of rows) {
    if (group === 'versus' && build.games <= 0) continue
    list.push({
      // The whole path: two builds may open on the same item with the same keystone (another source's cores do).
      key: `${group}-${build.firstItemId}-${build.primaryKeystoneId}-${(build.core.itemPath?.itemIds ?? []).join('_')}-${(build.core.boots?.itemIds ?? []).join('_')}`,
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
const { nameOf } = useChampionStatics()
/** What an import is named after: the champion, against the draft's lane opponent when there is one (`TrueMain Aatrox vs Akali`). */
const importName = computed(() => {
  const name = championStatic(props.championId)?.championName
  if (!name) return null
  return props.draft?.opponentId ? `${name} vs ${nameOf(props.draft.opponentId)}` : name
})
/** What the item set button imports: the build on screen, named for the set's title. */
const itemSetSubject = computed((): ItemSetSubject | null =>
  shown.value && importName.value ? { championId: props.championId, champion: importName.value, position: props.position, build: shown.value } : null)
/**
 * What the draft's automatic import writes (`useDraftAutoImport`): the build
 * on screen — a row, a pro's, a kit — and every other row, each as an item
 * set. Told on every change, so another build picked is imported in turn.
 */
const emit = defineEmits<{ selection: [value: { championId: number, selected: ImportChoice | null, others: ImportBuild[] }] }>()
function choiceOf(option: BuildOption, title: string): ImportChoice {
  const path = option.core.itemPath?.itemIds ?? []
  const spells = option.core.summonerSpells
  return {
    key: option.key,
    title,
    runePage: option.core.runePage,
    spells: spells ? [spells.spell1Id, spells.spell2Id] : null,
    starter: option.core.starterItems?.itemIds ?? [],
    path,
    boots: option.core.boots?.itemIds ?? [],
    situational: situationalFromTree(option.buildTree, path),
  }
}
function titleOf(option: BuildOption): string {
  const champion = nameOf(props.championId)
  if (option.key === 'draft') return props.draft?.opponentId ? `${champion} vs ${nameOf(props.draft.opponentId)}` : champion
  const first = option.core.itemPath?.itemIds[0]
  const name = option.key.startsWith('versus-') && versusOpponent.value ? `${champion} vs ${nameOf(versusOpponent.value)}` : champion
  return first && items.value[first] ? `${name} · ${items.value[first]!.name}` : name
}
const selection = computed(() => {
  const kit = kitShown.value
  let chosen: ImportChoice | null = null
  if (kit) {
    const paths = kitPaths(kit.tree)
    const path = paths[0] ?? []
    chosen = { key: `kit-${kit.id}`, title: kit.name, runePage: kit.runes, spells: kit.spells, starter: kit.starter, path, boots: kit.boots, situational: [...new Set(paths.slice(1).flat())].filter(id => !path.includes(id)) }
  }
  else if (shown.value) {
    chosen = choiceOf(shown.value, selected.value === 'pro' && pro.value ? `${pro.value.player} ${nameOf(props.championId)}` : titleOf(shown.value))
  }
  return { championId: props.championId, selected: chosen, others: options.value.map(option => choiceOf(option, titleOf(option))) }
})
watch(() => JSON.stringify(selection.value), () => emit('selection', selection.value), { immediate: true })

const waiting = computed(() => !shown.value && (lanePending.value || props.draft?.pending))
const emptyMessage = computed(() => t('build.view.none'))
</script>

<template>
  <!-- Champion select's card, as Blitz lays a build there: one header — whose build, which build, how it does — over the runes beside spells and build. -->
  <div v-if="compact" class="flex h-full min-h-0 flex-col gap-3">
    <header class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-default pb-3">
      <div class="min-w-48"><slot name="header" /></div>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="option in options.slice(0, 6)"
          :key="option.key"
          type="button"
          class="flex h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold tabular-nums ring-1 ring-inset transition-colors"
          :class="!kitShown && shown?.key === option.key ? 'bg-accented/70 text-highlighted ring-primary/50' : 'text-muted ring-default hover:text-highlighted'"
          :title="option.key === 'draft' ? t('build.list.thisDraft') : undefined"
          @click="selected = option.key; kitId = null"
        >
          <GameTooltipPerkIcon v-if="option.keystoneId && runeTree" :perk="runeTree.perks[option.keystoneId] ?? null" :width="20" :height="20" class="size-5 rounded-full bg-black/30" />
          <GameTooltipItemIcon :item="items[option.firstItemId] ?? null" :width="20" :height="20" class="rounded" />
          <span v-if="option.key === 'draft'">{{ t('build.compact.thisDraft') }}</span>
          <span v-else-if="option.winRate !== null">{{ formatPercentage(option.winRate, 1) }}</span>
        </button>
        <button
          v-for="kit in kits ?? []"
          :key="kit.id"
          type="button"
          class="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold ring-1 ring-inset transition-colors"
          :class="kitShown?.id === kit.id ? 'bg-accented/70 text-highlighted ring-primary/50' : 'text-muted ring-default hover:text-highlighted'"
          @click="kitId = kit.id"
        >
          <UIcon name="i-lucide-package" class="size-4" />{{ kit.name }}
        </button>
      </div>
      <!-- The pros' builds: a list a click away, the one picked shown in this card. -->
      <UPopover v-if="blitz || external" v-model:open="prosOpen" :content="{ align: 'start' }">
        <button
          type="button"
          class="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold ring-1 ring-inset transition-colors"
          :class="selected === 'pro' && pro && !kitShown ? 'bg-accented/70 text-highlighted ring-primary/50' : 'text-muted ring-default hover:text-highlighted'"
        >
          <UIcon name="i-lucide-trophy" class="size-4 text-primary" />{{ selected === 'pro' && pro && !kitShown ? pro.player : t('build.compact.pros') }}
          <UIcon name="i-lucide-chevron-down" class="size-3.5" />
        </button>
        <template #content>
          <div class="max-h-[28rem] w-80 overflow-y-auto p-2">
            <BuildPros v-if="blitz" :champion-id="championId" :position="position" :selected-key="selected === 'pro' && !kitShown ? pro?.option.key : null" @select="(...args) => { selectPro(...args); prosOpen = false }" />
            <ProbuildTopPlayers v-else :champion-id="championId" :position="position" compact selectable @select="(...args) => { selectPro(...args); prosOpen = false }" />
          </div>
        </template>
      </UPopover>
      <div v-if="shown && !kitShown" class="ml-auto flex gap-6 text-right">
        <div v-if="shown.winRate !== null">
          <p class="text-lg font-bold leading-tight tabular-nums text-data-good">{{ formatPercentage(shown.winRate, 1) }}</p>
          <p class="text-[11px] text-muted">{{ t('build.compact.gameWinRate') }}</p>
        </div>
        <div v-if="draft?.build?.lane?.winRate != null">
          <p class="text-lg font-bold leading-tight tabular-nums text-data-good">{{ formatPercentage(draft.build.lane.winRate, 1) }}</p>
          <p class="text-[11px] text-muted">{{ t('build.compact.laneWinRate') }}</p>
        </div>
      </div>
    </header>

    <p v-if="selected === 'pro' && pro && !kitShown" class="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs text-default">
      <UIcon name="i-lucide-trophy" class="size-4 shrink-0 text-primary" />
      {{ t('pro.banner', { player: pro.player, result: pro.option.winRate ? t('pro.win') : t('pro.loss') }) }}
    </p>
    <slot name="advice" />
    <KitBuild v-if="kitShown" :kit="kitShown" />
    <BuildCore
      v-else-if="shown"
      compact
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
      :champion-name="importName"
      :champion-id="championId"
      :item-path="shown.core.itemPath"
      :situational="situationalFromTree(shown.buildTree, shown.core.itemPath?.itemIds ?? [])"
    >
      <template #itemImport>
        <BuildItemSetImport v-if="itemSetSubject" :subject="itemSetSubject" labeled />
      </template>
    </BuildCore>
    <div v-else class="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
      <UIcon :name="waiting ? 'i-lucide-loader-circle' : 'i-lucide-scroll-text'" class="size-6 text-dimmed" />
      <p class="text-sm text-muted">{{ waiting ? t('build.view.reading') : emptyMessage }}</p>
    </div>
  </div>

  <div v-else class="surface relative grid h-full min-h-0 grid-cols-[18rem_minmax(0,1fr)] overflow-hidden rounded-xl">
    <!-- The thin bar that says a newer draft is being asked for, without hiding the answer on screen. -->
    <div v-if="draft?.pending && shown" class="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden">
      <div class="h-full w-1/3 animate-[tm-scan_1.1s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-primary to-transparent" />
    </div>

    <aside class="flex min-h-0 flex-col border-r border-default bg-muted/50">
      <div class="border-b border-default px-3 py-2.5">
        <slot name="header" />
      </div>
      <div class="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden p-2">
        <BuildList
          :model-value="kitShown ? null : selected"
          :options="options"
          :pending="lanePending || !!draft?.pending"
          :draft-label="draft?.label"
          :draft-opponent="draft?.opponentId ?? null"
          :versus-opponent="versusOpponent"
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
        :champion-name="importName"
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
        :champion-name="importName"
        :champion-id="championId"
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
