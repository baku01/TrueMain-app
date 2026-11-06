<script setup lang="ts">
import type { GamePlayer } from '~/types/game'
import { skillGrid } from '~/utils/skill-grid'

/**
 * Our champion's skill order, as Blitz's game page carries it under the
 * build: the lane's most played order from the picked source
 * (`useChampionBuilds`), max order and level-by-level grid, the column of
 * the level we are at marked — the point it calls for — moving as we level.
 */
const props = defineProps<{ player: GamePlayer, championId: number | null }>()
const { t } = useT()
const { loadChampion, championStatic } = useStaticData()

const championId = computed(() => props.championId)
const position = computed(() => props.player.position || null)
const { response } = useChampionBuilds(championId, position)
watch(championId, (id) => {
  if (id) void loadChampion(id)
}, { immediate: true })

const skillOrder = computed(() => response.value?.builds[0]?.core.skillOrder ?? null)
const champion = computed(() => (props.championId ? championStatic(props.championId) : null))
const level = computed(() => Math.min(18, Math.max(1, props.player.level)))
const next = computed(() => (skillOrder.value ? skillGrid(skillOrder.value.sequence)?.[level.value] ?? null : null))
</script>

<template>
  <section v-if="champion && position" class="surface rounded-xl p-4">
    <header class="mb-3 flex flex-wrap items-center gap-2">
      <UIcon name="i-tabler-arrow-big-up-lines" class="size-4 text-primary" />
      <h3 class="text-sm font-semibold text-highlighted">{{ t('game.skills.title') }}</h3>
      <span v-if="next" class="rounded-md bg-primary/12 px-2 py-0.5 text-xs font-semibold text-primary ring-1 ring-primary/30">{{ t('game.skills.next', { key: next }) }}</span>
      <span class="ml-auto text-[11px] text-dimmed">{{ t('game.skills.source') }}</span>
    </header>
    <BuildSkillGrid v-if="skillOrder" :skill-order="skillOrder" :champion-static="champion" :champion-id="championId" :current="level" />
    <p v-else class="text-sm text-muted">{{ t('game.skills.none', { champion: champion.championName ?? '' }) }}</p>
  </section>
</template>
