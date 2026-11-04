<script setup lang="ts">
import type { ChampionStaticData, RuneTreeResponse, StaticItemData, StaticSummonerSpellData } from '#shared/types/static-data'
import type { ChampionItemContextAxis } from '#shared/types/item-context'
import type { DraftItemPush } from '~/utils/draft-damage'
import type { BuildOptions, ItemOption } from '~/utils/sources/model'
import { localizedAxisPhrase } from '#common/utils/item-context-phrases'
import { formatPercentage } from '#shared/utils/ddragon'
import { formatCount } from '#shared/utils/counts'
import { prioritiesOf, skillOpenings } from '~/utils/sources/model'
import { activeProvider } from '~/utils/sources'

/**
 * A lane build the way the reference client lays it out, from whichever
 * source Settings picked (`utils/sources`): every choice it measured with its
 * win rate and share, not one pick per block — the rune pages, the spell
 * pairs, starters and boots beside them, the most played cores (one picked,
 * the items after it beside it) and the skill orders, the picked one level by
 * level as the games played it. `initialCore` opens on the core of the build
 * row picked.
 *
 * In champion select, `advice` carries what the draft moves the build toward
 * (`useDraftItemAdvice`: the enemy's damage mix, crowd control, sustain…).
 * The recommended boots lead their list — added when the source's top three
 * lack them — and the core holding the recommended item is marked and opened,
 * each with the reason; they follow the draft as it changes.
 */
const props = defineProps<{
  championId: number
  position: string
  initialCore?: number[] | null
  championStatic: ChampionStaticData | null
  championName: string | null
  items: Record<number, StaticItemData>
  summoners: Record<number, StaticSummonerSpellData>
  runeTree: RuneTreeResponse | null
  advice?: DraftItemPush[]
  /** Options already read (the Analytics page reads them with its elo filter): shown as given, nothing asked of the source. */
  preset?: BuildOptions | null
}>()

const { t } = useT()
const options = shallowRef<BuildOptions | null>(null)
const failed = ref(false)

let latest = 0
watch(() => [`${props.championId}:${props.position}`, props.preset] as const, async () => {
  const read = ++latest
  failed.value = false
  if (props.preset !== undefined) {
    options.value = props.preset
    failed.value = props.preset === null
    return
  }
  options.value = null
  try {
    const answer = await activeProvider()?.options(props.championId, props.position)
    if (read === latest) options.value = answer ?? null
    if (read === latest && !answer) failed.value = true
  }
  catch {
    if (read === latest) failed.value = true
  }
}, { immediate: true })

/** A push's reason in the player's words, as the advice strip above the build words it. */
const reason = (push: DraftItemPush) =>
  (localizedAxisPhrase({ axis: push.reason.axis, bucket: push.reason.bucket } as ChampionItemContextAxis) ?? []).map(token => token.text).join('')
const pushOf = (slot: DraftItemPush['slot']) => props.advice?.find(push => push.slot === slot) ?? null

const boots = computed<ItemOption[]>(() => {
  const list = options.value?.boots ?? []
  const push = pushOf('boots')
  if (!push) return list.slice(0, 3)
  const known = list.find(option => option.itemIds[0] === push.itemId)
  const recommended = { ...(known ?? { games: 0, pickRate: push.baseShare, winRate: 0 }), itemIds: [push.itemId], note: reason(push) }
  return [recommended, ...list.filter(option => option.itemIds[0] !== push.itemId)].slice(0, 3)
})

const rawCores = computed(() => options.value?.cores ?? [])
const cores = computed(() => {
  const push = pushOf('build')
  return rawCores.value.map(option => (push && option.itemIds.includes(push.itemId) ? { ...option, note: reason(push) } : option))
})
const core = ref(0)
watch([rawCores, () => props.initialCore, () => pushOf('build')?.itemId], ([list, wanted, pushed]) => {
  // The draft's recommended item opens the core that carries it; otherwise the build row picked on the left.
  const recommended = pushed ? list.findIndex(option => option.itemIds.includes(pushed)) : -1
  const key = wanted?.join(',')
  const picked = key ? list.findIndex(option => option.itemIds.filter(id => wanted!.includes(id)).length === wanted!.length) : -1
  core.value = Math.max(0, recommended >= 0 ? recommended : picked)
}, { immediate: true })

/**
 * What follows the picked core, slot by slot, without the options too thin
 * to read: a handful of games makes a 100% that says nothing. Kept are the
 * ones played in at least 2% of the core's games, and in twenty games.
 */
const followUps = computed(() => {
  const picked = cores.value[core.value] ?? null
  const floor = Math.max(20, (picked?.games ?? 0) * 0.02)
  return (options.value?.followUps(picked) ?? [])
    .map(group => ({ ...group, options: group.options.filter(option => option.games >= floor) }))
    .filter(group => group.options.length > 0)
})
const skills = computed(() => options.value?.skills ?? [])
const skill = ref(0)
watch(options, () => (skill.value = 0))
/** Each sequence named by the levels where they part, so no two tabs read alike. */
const openings = computed(() => skillOpenings(skills.value))
/**
 * The headline over the grid: the max order the picked sequence follows,
 * counted over every game it was played in. A sequence's own win rate only
 * counts the games that reached its last level, which win more than the
 * champion does; its tab still shows it, the note says why it runs high.
 */
const headline = computed(() => {
  const picked = skills.value[skill.value]
  if (!picked) return null
  const priority = prioritiesOf({ skills: skills.value, priorities: options.value?.priorities }).find(entry => entry.order.join('') === picked.order.join(''))
  const measure = priority ?? picked
  return { sequence: picked.order, games: measure.games, pickRate: measure.pickRate, winRate: measure.winRate }
})

/** The sequence's letters in one tone, the ultimate's in the accent: the order reads without a rainbow. */
const SKILL_TEXT: Record<string, string> = { Q: 'text-toned', W: 'text-toned', E: 'text-toned', R: 'text-primary' }
const ORDINAL: Record<number, string> = { 4: 'panel.slot4', 5: 'panel.slot5', 6: 'panel.slot6' }
const percent = (value: number) => formatPercentage(value, 1)
const tone = (value: number) => (value >= 0.52 ? 'text-primary' : value < 0.48 ? 'text-muted' : 'text-default')
</script>

<template>
  <div v-if="options" class="@container">
    <!-- Areas, not rows: `blitz-grid` in main.css lays them out for the pane's width. -->
    <div class="blitz-grid">
      <BuildSourceRunes v-if="runeTree" :options="options" :tree="runeTree" :champion="championName" class="[grid-area:runes]" />
      <div class="blitz-small [grid-area:small]">
        <BuildSourceChoices :title="t('panel.spells')" :options="options.spells" :summoners="summoners" layout="rows" :icon-size="28" />
        <BuildSourceChoices :title="t('panel.starters')" :options="options.starters" :items="items" layout="rows" :icon-size="28" />
        <BuildSourceChoices :title="t('panel.boots')" :options="boots" :items="items" layout="rows" :icon-size="28" />
      </div>

      <!-- The cores and, beside them on a wide pane, what the picked one is followed by. -->
      <div class="blitz-build [grid-area:build]">
        <div class="grid min-w-0 content-start gap-3">
          <BuildSourceChoices v-model:selected="core" :title="t('panel.cores')" :options="cores" :items="items" selectable arrows layout="rows" :icon-size="30" />
          <section v-if="followUps.length" class="surface min-w-0 rounded-2xl p-3">
            <!-- One column per group the source has: lolalytics measures two slots after the core, op.gg three. -->
            <div class="grid gap-x-3 gap-y-3 @2xl:[grid-template-columns:repeat(var(--groups),minmax(0,1fr))]" :style="{ '--groups': followUps.length }">
              <BuildSourceChoices v-for="group in followUps" :key="group.slot" :title="t(ORDINAL[group.slot]!)" :options="group.options.slice(0, 3)" :items="items" bare layout="rows" :icon-size="28" />
            </div>
          </section>
        </div>
        <BuildSourceRecipe :champion-id="championId" :position="position" :core="cores[core] ?? null" :starter="options.starters[0] ?? null" :boots="boots" :follow-ups="followUps" :cores="cores" :items="items" />
      </div>

      <section v-if="championStatic && skills.length" class="surface rounded-2xl p-4 [grid-area:skills]">
        <!-- One centred column: the sequences, the max order and grid, and the note share its axis. -->
        <div class="mx-auto w-full max-w-[68rem] space-y-3">
          <header class="flex flex-wrap items-center justify-center gap-2 pb-2">
            <h3 class="stat-label mr-2">{{ t('panel.skills') }}</h3>
            <button
              v-for="(option, index) in skills"
              :key="index"
              type="button"
              class="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs transition-colors"
              :class="skill === index ? 'bg-primary/10 ring-1 ring-inset ring-primary/50' : 'bg-accented/20 hover:bg-accented/50'"
              @click="skill = index"
            >
              <span class="flex gap-0.5 font-mono text-[11px] font-bold">
                <span v-for="(key, at) in openings[index]" :key="at" :class="SKILL_TEXT[key]">{{ key }}</span>
              </span>
              <span class="font-semibold tabular-nums" :class="tone(option.winRate)">{{ percent(option.winRate) }}</span>
              <span class="tabular-nums text-dimmed">{{ t('panel.skillsGames', { games: formatCount(option.games) }) }}</span>
            </button>
          </header>
          <BuildSkillGrid :champion-id="championId" :skill-order="headline" :points="skills[skill]!.points" :champion-static="championStatic" :note="t('panel.skillsNote')" />
        </div>
      </section>
    </div>
  </div>
  <div v-else class="flex flex-col items-center justify-center gap-2 p-8 text-center">
    <UIcon :name="failed ? 'i-lucide-scroll-text' : 'i-lucide-loader-circle'" class="size-6 text-dimmed" />
    <p class="text-sm text-muted">{{ failed ? t('build.view.none') : t('build.view.reading') }}</p>
  </div>
</template>
