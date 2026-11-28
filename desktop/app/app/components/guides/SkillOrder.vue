<script setup lang="ts">
import type { GuideAbility } from '~/utils/mobafire'
import type { SkillKey } from '~/utils/skill-grid'
import { abilityPoints, maxOrder } from '~/utils/guide-build'

/**
 * A guide's ability order, laid out as the app's own skill order
 * (`BuildSkillGrid`): the order the basic abilities are maxed in, the
 * champion's passive beside it, then the four abilities against levels 1–18,
 * each point lettered in its cell — the ultimate's a step brighter, the
 * moments the order is built around. The icons are the app's, with their
 * tooltips (`GuidesAbilityIcon`), MOBAFire's standing in until they come.
 */
const props = defineProps<{ rows: GuideAbility[], championId: number | null }>()
const { t } = useT()
const { championStatic } = useStaticData()

const SKILLS: SkillKey[] = ['Q', 'W', 'E', 'R']
const LEVELS = Array.from({ length: 18 }, (_, at) => at + 1)
const rowOf = (key: string) => props.rows.find(row => row.key === key) ?? null
const spellOf = (key: string) => (props.championId ? championStatic(props.championId)?.championSpells[key] ?? null : null)
const nameOf = (key: string) => spellOf(key)?.name ?? rowOf(key)?.name ?? key
const points = computed(() => abilityPoints(props.rows))
const order = computed(() => maxOrder(props.rows))
const passive = computed(() => rowOf('P'))
const skills = computed(() => SKILLS.filter(key => rowOf(key)))

/** The app's icons asked for first: the browser takes them before the pictures a page has queued behind them. */
watch(() => SKILLS.map(key => spellOf(key)?.iconUrl).concat(spellOf('P')?.iconUrl), (urls) => {
  for (const url of urls) {
    if (!url) continue
    const image = new Image()
    image.fetchPriority = 'high'
    image.src = url
  }
}, { immediate: true })
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-x-8 gap-y-3">
      <div v-if="order.length" class="flex items-center gap-3">
        <span class="stat-label">{{ t('build.skillGrid.maxOrder') }}</span>
        <div class="flex items-center gap-1.5">
          <template v-for="(key, index) in order" :key="key">
            <span class="relative">
              <GuidesAbilityIcon :spell="spellOf(key)" :fallback="rowOf(key)?.image" :name="nameOf(key)" :size="40" class="rounded-lg!" />
              <span class="absolute -bottom-1 -right-1 grid size-4 place-items-center rounded bg-default text-[10px] font-extrabold text-highlighted">{{ key }}</span>
            </span>
            <UIcon v-if="index < order.length - 1" name="i-lucide-chevron-right" class="size-4 shrink-0 text-dimmed" />
          </template>
        </div>
      </div>
      <div v-if="passive" class="flex min-w-0 items-center gap-2.5">
        <GuidesAbilityIcon :spell="spellOf('P')" :fallback="passive.image" :name="nameOf('P')" :size="32" />
        <span class="flex min-w-0 flex-col leading-tight">
          <span class="text-[11px] text-dimmed">{{ t('guides.passive') }}</span>
          <span class="truncate text-xs font-semibold text-toned">{{ nameOf('P') }}</span>
        </span>
      </div>
    </div>

    <div class="overflow-x-auto pb-1">
      <div
        class="grid min-w-[34rem] items-center gap-1 text-[11px] font-bold"
        style="grid-template-columns: minmax(8rem, 11rem) repeat(18, minmax(1.25rem, 1fr))"
        role="table"
        :aria-label="t('guides.abilities')"
      >
        <div role="row" class="contents">
          <span role="columnheader" />
          <span v-for="level in LEVELS" :key="`level-${level}`" role="columnheader" class="grid h-5 place-items-center font-medium tabular-nums text-dimmed">{{ level }}</span>
        </div>
        <div v-for="key in skills" :key="key" role="row" class="contents">
          <span role="rowheader" class="flex min-w-0 items-center gap-2 pr-2">
            <GuidesAbilityIcon :spell="spellOf(key)" :fallback="rowOf(key)?.image" :name="nameOf(key)" :size="28" />
            <span class="min-w-0 truncate text-xs font-medium text-toned">{{ nameOf(key) }}</span>
          </span>
          <span
            v-for="level in LEVELS"
            :key="`${key}-${level}`"
            role="cell"
            class="grid aspect-square max-h-8 w-full place-items-center rounded-md transition-colors"
            :class="points[level] === key ? (key === 'R' ? 'bg-primary/25 text-primary' : 'bg-primary/12 text-highlighted') : 'bg-accented/25'"
          >{{ points[level] === key ? key : '' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
