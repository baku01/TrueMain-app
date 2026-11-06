<script setup lang="ts">
import type { OpenedStep } from '~/components/jev/JevBuildPath.vue'
import type { EnemyReading } from '~/composables/useJevBuild'
import type { LaidBuild } from '~/utils/jev-build'
import type { Needs, RankedSlot } from '~/utils/jev-recommend'

/**
 * Jev's answer for a build (`useJevBuild`'s), laid out: what it is built
 * against — the enemy team's needs and Jev's reading of each kit
 * (`JevEnemyRead`) — then the recommended and the most played build, each a
 * path of steps (`JevBuildPath`), and every option of the step opened
 * (`JevChoices`). Shared by the Jev matchup page and champion select's panel.
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
}>()
const { t } = useT()

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
    <JevBuildPath v-if="jevBuild" v-model:opened="chosen" :ranked="ranked" :champion-id="championId" :position="position" :build="jevBuild" side="jev" />
    <JevBuildPath v-if="standardBuild" v-model:opened="chosen" :ranked="ranked" :champion-id="championId" :position="position" :build="standardBuild" side="standard" />
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
