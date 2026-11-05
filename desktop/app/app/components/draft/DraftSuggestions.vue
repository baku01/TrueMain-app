<script setup lang="ts">
import type { DraftSuggestionItem } from '~/types/draft'
import type { RankedPick } from '~/utils/jev-recommend'
import { comfortOf, comfortText } from '~/utils/draft-comfort'
import { damageNote } from '~/utils/draft-damage'

/**
 * "Your pick" or "Your ban": what the draft endpoints ranked for our lane,
 * best first, as a grid of posters, all of them — each with the reason that carries it (#1906), or
 * Jev's score when Jev ranked them. A click on one opens its build against this draft. The app never
 * picks or bans on its own: each card carries a separate "Hover" (or, on our
 * ban, "Ban") control the player clicks (#1909), and the search reaches every
 * other champion the same way — the lock itself is the strip's button, away
 * from the cards.
 *
 * Picks: "My pool" ranks the player's own champions (their most-mastered on
 * the lane); off, every champion played on the lane. Bans: the threats to the
 * pick the player declared, else to their pool; never a champion an ally
 * hovers or locks. Either way the order is the endpoint's.
 */
const props = defineProps<{
  mode: 'pick' | 'ban'
  suggestions: DraftSuggestionItem[]
  /** Bans only: what they protect (`pick`, `pool`, `none`) and who. */
  target?: { kind: string, championIds: number[] } | null
  /** The client has told us the player's champions: "My pool" can be on. */
  hasPool: boolean
  pending: boolean
  position: string
  error: string | null
  /** Our locked allies, ourselves excluded — what a pick's damage note is read against (#1907). */
  allies: { championId: number, position: string | null }[]
  /** Jev's score of each pick, when Jev ranked them: the cards show it in place of the source's figure. */
  jevScores?: Map<number, RankedPick> | null
  /** Under the title: where the order comes from. */
  subtitle?: string | null
}>()

const myPool = defineModel<boolean>('myPool', { default: true })
const emit = defineEmits<{ preview: [championId: number] }>()

const { nameOf, champions } = useChampionStatics()
const { t } = useT()
const { writable } = useChampSelectActions()
const { entryOf, status: tierListStatus } = useTierList()
const { profileOf } = useDamageProfiles()
const { games } = usePlayerRecord()

/** What each pick does to our damage mix, when it answers a one-sided team (#1907). Never part of the order, never on a ban. */
const notes = computed(() => {
  if (props.mode !== 'pick') return new Map()
  const allies = props.allies.map(ally => profileOf(ally.championId, ally.position))
  return new Map(props.suggestions.map(item => [
    item.championId,
    damageNote(allies, profileOf(item.championId, props.position)),
  ]))
})

/** The player's own recent games on each pick, from their client (#1906): said on hover, never part of the order. */
const comforts = computed(() => {
  if (props.mode !== 'pick') return new Map<number, string>()
  return new Map(props.suggestions.flatMap((item) => {
    const comfort = comfortOf(games.value, item.championId)
    return comfort ? [[item.championId, comfortText(nameOf(item.championId), comfort)] as const] : []
  }))
})

const search = ref('')
const hovered = ref<number | null>(null)

const shown = computed(() => {
  const query = search.value.trim().toLowerCase()
  return query ? props.suggestions.filter(item => nameOf(item.championId).toLowerCase().includes(query)) : props.suggestions
})

/** What the bans protect, in a few words. */
const targetLabel = computed(() => {
  const target = props.target
  if (props.mode !== 'ban' || !target) return null
  if (target.kind === 'pick' && target.championIds[0]) return t('draft.sugg.protectingPick', { name: nameOf(target.championIds[0]) })
  if (target.kind === 'pool') return t('draft.sugg.threatsPool')
  return t('draft.sugg.mostBanned')
})

/**
 * Champions the search names that the podium does not rank — so any champion
 * can be hovered or banned from here, not only the lane's candidates.
 */
const others = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query || !writable.value) return []
  const ranked = new Set(props.suggestions.map(item => item.championId))
  return [...champions.value.values()]
    .filter(champion => !ranked.has(champion.id) && champion.name.toLowerCase().includes(query))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 12)
})

/** The card in focus: the hovered one, else the best. */
const focused = computed(() => hovered.value ?? shown.value[0]?.championId ?? null)

/**
 * Why the podium is empty. The pool is filtered through the tier list, so
 * without it nothing is ranked — that is a load to wait for, not a search
 * that missed (#1783).
 */
const empty = computed(() => {
  if (props.error) return { icon: 'i-lucide-wifi-off', text: props.mode === 'ban' ? t('draft.sugg.rankBansFailed') : t('draft.sugg.rankPicksFailed') }
  if (tierListStatus.value === 'error') return { icon: 'i-lucide-wifi-off', text: t('draft.sugg.tierListFailed') }
  if (tierListStatus.value !== 'ready') return { icon: 'i-lucide-loader-circle', text: t('draft.sugg.tierListLoading') }
  if (props.pending) return { icon: 'i-lucide-loader-circle', text: props.mode === 'ban' ? t('draft.sugg.rankingBans') : t('draft.sugg.rankingPicks') }
  if (props.mode === 'ban') return { icon: 'i-lucide-search-x', text: t('draft.sugg.noBan') }
  if (search.value.trim()) return { icon: 'i-lucide-search-x', text: t('draft.sugg.noMatch') }
  if (myPool.value && props.hasPool) return { icon: 'i-lucide-search-x', text: t('draft.sugg.noPoolOnLane') }
  return { icon: 'i-lucide-search-x', text: t('draft.sugg.noneOnLane') }
})

/** Every suggestion, always open: the card scrolls when they outgrow it. */
const cards = computed(() => shown.value)
</script>

<template>
  <section class="@container flex min-w-0 flex-col gap-4">
    <header class="flex flex-wrap items-start gap-x-6 gap-y-2">
      <div class="min-w-0 flex-1">
        <h2 class="font-display text-lg font-bold tracking-tight text-highlighted">{{ mode === 'ban' ? t('draft.sugg.yourBan') : t('draft.sugg.yourPick') }}</h2>
        <p class="text-xs text-muted">
          <UTooltip v-if="targetLabel" :text="t('draft.sugg.neverAlly')"><span>{{ targetLabel }}</span></UTooltip>
          <template v-else>{{ subtitle }}</template>
        </p>
      </div>
      <div class="flex items-center gap-3">
        <slot name="tools" />
        <UIcon v-if="pending" name="i-lucide-loader-circle" class="size-4 animate-spin text-dimmed" />
        <UTooltip v-if="mode === 'pick'" :text="hasPool ? t('draft.sugg.poolTen') : t('draft.sugg.poolNeedsClient')">
          <USwitch :model-value="myPool && hasPool" :label="t('draft.sugg.myPool')" size="sm" :disabled="!hasPool" :ui="{ label: 'stat-label' }" @update:model-value="myPool = $event" />
        </UTooltip>
        <UInput v-model="search" icon="i-lucide-search" :placeholder="t('draft.sugg.search')" size="sm" class="w-44" />
      </div>
    </header>

    <template v-if="shown.length || others.length">
      <ol v-if="cards.length" class="grid grid-cols-2 gap-2.5 @lg:grid-cols-3 @5xl:grid-cols-4" @mouseleave="hovered = null">
        <li v-for="(item, index) in cards" :key="item.championId" class="relative" @mouseenter="hovered = item.championId">
          <DraftSuggestionCard
            :champion-id="item.championId"
            :reasons="item.reasons"
            :thin="item.thin"
            :position="position"
            :entry="entryOf(item.championId, position)"
            :focused="focused === item.championId"
            :rank="index + 1"
            :jev="jevScores?.get(item.championId) ?? null"
            :note="notes.get(item.championId) ?? null"
            :comfort="comforts.get(item.championId) ?? null"
          >
            <!-- The card's click opens the build; the write is the control over its corner, a separate target. -->
            <button
              type="button"
              class="absolute inset-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary"
              :aria-label="t('draft.sugg.buildFor', { name: nameOf(item.championId) })"
              @focus="hovered = item.championId"
              @click="emit('preview', item.championId)"
            />
            <template #action>
              <DraftChampionAction :champion-id="item.championId" compact />
            </template>
          </DraftSuggestionCard>
        </li>
      </ol>

      <div v-if="others.length" class="flex flex-col gap-1.5">
        <span class="stat-label">{{ t('draft.sugg.notRanked') }}</span>
        <div class="grid grid-cols-2 gap-1.5 @2xl:grid-cols-3">
          <div v-for="champion in others" :key="champion.id" class="flex items-center gap-2 rounded-lg bg-elevated p-1.5 ring-1 ring-default">
            <ChampionPortrait :champion-id="champion.id" size="sm" class="size-8! rounded-md!" />
            <span class="min-w-0 flex-1 truncate text-xs font-semibold text-highlighted">{{ champion.name }}</span>
            <DraftChampionAction :champion-id="champion.id" />
          </div>
        </div>
      </div>
    </template>

    <div v-else class="flex min-h-48 flex-col items-center justify-center gap-2 text-center">
      <UIcon :name="empty.icon" class="size-6 text-dimmed" />
      <p class="text-sm text-muted">{{ empty.text }}</p>
      <p v-if="error" class="max-w-sm text-xs text-dimmed">{{ error }}</p>
    </div>
  </section>
</template>
