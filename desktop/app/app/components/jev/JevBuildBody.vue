<script setup lang="ts">
import type { OpenedStep } from '~/components/jev/JevBuildPath.vue'
import type { EnemyReading } from '~/composables/useJevBuild'
import type { LaidBuild } from '~/utils/jev-build'
import type { Needs, RankedSlot } from '~/utils/jev-recommend'
import type { JevBase } from '~/utils/jev-bases'
import { jevImportName, jevImportTitles } from '~/utils/jev-bases'

/**
 * Jev's answer for a build (`useJevBuild`'s), laid out: what it is built
 * against — the enemy team's needs and Jev's reading of each kit
 * (`JevEnemyRead`) — then the recommended and the most played build, each a
 * path of steps (`JevBuildPath`), and every option of the step opened
 * (`JevChoices`). Shared by the Jev matchup page and champion select's panel.
 * Both builds are named after the base Jev ranked within (`utils/jev-bases`):
 * "Jev · Lethality" beside that playstyle's most played, and so are their
 * imports (`TrueMain Aatrox vs Akali · Jev Lethality`).
 */
const props = defineProps<{
  championId: number
  /** The lane, for Blitz's buying order in the imported item set. */
  position?: string
  ranked: RankedSlot[]
  needs: { team: Needs, lane: Needs } | null
  enemies: EnemyReading[]
  jevBuild: LaidBuild | null
  standardBuild: LaidBuild | null
  /** The base the answer was ranked within; the lane when absent. */
  base?: JevBase | null
}>()
const { t } = useT()
const { nameOf } = useChampionStatics()
const { short, tag } = useJevBaseLabels()
/** What its imports are named after: the champion against the lane opponent, then the base (`TrueMain Aatrox vs Akali · Jev Lethality`). */
const importName = computed(() => jevImportName(nameOf(props.championId), props.enemies.find(enemy => enemy.opponent)?.name ?? null))
const titles = computed(() => jevImportTitles(importName.value, tag(props.base ?? null)))
/** Each build's heading: "Jev · Lethality", and the base's most played. */
const headings = computed(() => ({
  jev: t('jevbase.jevTitle', { base: short(props.base ?? null) }),
  standard: !props.base || props.base.kind === 'lane' ? t('jev.card.standardBuild') : t('jevbase.standardTitle', { base: short(props.base) }),
}))

/** The step opened below the builds: the one clicked, else the first where Jev parts from the most played. */
const chosen = ref<OpenedStep | null>(null)
const opened = computed(() => {
  const clicked = chosen.value && props.ranked.find(entry => entry.slot.name === chosen.value!.name)
  if (clicked) return { entry: clicked, label: chosen.value!.label }
  const first = props.ranked.find(entry => entry.pick.key !== entry.standard.key) ?? props.ranked[0]
  return first ? { entry: first, label: first.slot.name.startsWith('item') ? t('jev.slot.item', { slot: first.slot.name.slice(4) }) : t(`jev.slot.${first.slot.name}`) } : null
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <JevEnemyRead v-if="needs" :needs="needs" :enemies="enemies" />

    <!-- The two builds stacked, step over step, then every option of the step opened. -->
    <JevBuildPath v-if="jevBuild" v-model:opened="chosen" :ranked="ranked" :champion-id="championId" :position="position" :import-name="titles.jev" :title="headings.jev" :build="jevBuild" side="jev" />
    <JevBuildPath v-if="standardBuild" v-model:opened="chosen" :ranked="ranked" :champion-id="championId" :position="position" :import-name="titles.standard" :title="headings.standard" :build="standardBuild" side="standard" />
    <section v-if="opened" class="surface min-w-0 rounded-2xl p-4">
      <header class="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <h3 class="text-sm font-semibold text-highlighted">{{ t('jev.path.details', { slot: opened.label }) }}</h3>
        <span class="flex items-center gap-1 text-[11px] text-muted"><UIcon name="i-tabler-chess-knight" class="size-3.5 text-primary" />{{ t('jev.card.jevPick') }}</span>
        <span class="flex items-center gap-1 text-[11px] text-muted"><UIcon name="i-tabler-database" class="size-3.5" />{{ t('jev.card.standardPick') }}</span>
        <span class="ml-auto text-[11px] text-dimmed">{{ t('jev.path.hint') }}</span>
      </header>
      <p class="mb-3 text-xs text-muted">{{ t('jev.card.choicesHint') }}</p>
      <JevChoices :ranked="[opened.entry]" :champion-id="championId" />
    </section>
  </div>
</template>
