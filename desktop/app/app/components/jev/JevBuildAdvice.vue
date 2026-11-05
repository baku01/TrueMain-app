<script setup lang="ts">
import type { CompositionBuildRequest } from '~/types/build'
import type { LaidBuild } from '~/utils/jev-build'

/**
 * The Jev matchup page's build (`useJevBuild`): on a click, Jev's whole build
 * — runes, spells, starter, skill order, boots and their timing, the items in
 * the order to buy them — beside the selected source's most played, then every
 * choice option by option: the source's pick rate and win rate, Jev's
 * probability, which one Jev took and which one the source leads with.
 */
const props = defineProps<{ championId: number, request: CompositionBuildRequest }>()
const { t } = useT()
const { items, summoners, runeTree, pending, loadChampion, championStatic } = useStaticData()
const { nameOf } = useChampionStatics()
const subject = computed(() => ({ championId: props.championId, request: props.request }))
const { status, error, decisions, jevBuild, standardBuild, elapsedMs, ask } = useJevBuild(subject)

watch(() => props.championId, id => void loadChampion(id).catch(() => {}), { immediate: true })
const kit = computed(() => championStatic(props.championId))

const percent = (value: number | undefined) => `${Math.round((value ?? 0) * 100)}%`
const sides = computed(() => [
  { key: 'jev', title: t('jev.card.jevBuild'), build: jevBuild.value },
  { key: 'standard', title: t('jev.card.standardBuild'), build: standardBuild.value },
] as { key: string, title: string, build: LaidBuild | null }[])
</script>

<template>
  <section class="flex flex-col gap-4">
    <header class="surface flex flex-wrap items-center gap-3 rounded-xl p-4">
      <UIcon name="i-tabler-sparkles" class="size-5 text-primary" />
      <div class="min-w-0 flex-1">
        <h2 class="text-sm font-semibold text-highlighted">{{ t('jev.card.title') }}</h2>
        <p class="text-xs text-muted">{{ t('jev.card.description') }}</p>
      </div>
      <span v-if="status === 'ready' && elapsedMs !== null" class="text-xs tabular-nums text-dimmed">{{ t('jev.card.elapsed', { ms: elapsedMs }) }}</span>
      <UButton icon="i-tabler-sparkles" :label="status === 'ready' ? t('jev.card.again') : t('jev.card.ask')" :loading="status === 'loading'" size="sm" @click="ask()" />
    </header>

    <UAlert v-if="status === 'noKey'" color="warning" variant="subtle" icon="i-lucide-key-round" :title="t('jev.card.noKey')" :actions="[{ label: t('jev.card.openSettings'), to: '/settings', color: 'warning', variant: 'outline' }]" />
    <UAlert v-else-if="status === 'noSource'" color="neutral" variant="subtle" icon="i-lucide-database" :title="t('jev.card.noSource')" />
    <UAlert v-else-if="status === 'noOptions'" color="neutral" variant="subtle" icon="i-lucide-circle-alert" :title="t('jev.card.noOptions')" />
    <UAlert v-else-if="status === 'error'" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="t('jev.card.error')" :description="error ?? undefined" />

    <div v-if="status === 'loading'" class="grid gap-3 2xl:grid-cols-2">
      <USkeleton v-for="i in 2" :key="i" class="h-96 rounded-xl" />
    </div>

    <template v-else-if="status === 'ready'">
      <!-- The two builds side by side: Jev's, and the source's most played. -->
      <div class="grid gap-4 2xl:grid-cols-2">
        <div v-for="side in sides" :key="side.key" class="flex flex-col gap-2">
          <h3 class="flex items-center gap-2 text-sm font-semibold" :class="side.key === 'jev' ? 'text-primary' : 'text-muted'">
            <UIcon :name="side.key === 'jev' ? 'i-tabler-sparkles' : 'i-tabler-database'" class="size-4" />
            {{ side.title }}
          </h3>
          <BuildCore
            v-if="side.build"
            :summoner-spells="side.build.summonerSpells"
            :starter-items="side.build.starterItems"
            :skill-order="side.build.skillOrder"
            :boots="side.build.boots"
            :rune-page="side.build.runePage"
            :champion-static="kit"
            :items-map="items"
            :summoners-map="summoners"
            :summoners-pending="pending"
            :rune-tree="runeTree"
            :champion-name="nameOf(championId)"
            :champion-id="championId"
          >
            <template #tree>
              <div class="surface h-full rounded-xl p-4">
                <p class="stat-label mb-3">{{ t('jev.card.order') }}</p>
                <ol class="flex flex-wrap items-center gap-1.5">
                  <template v-for="(itemId, index) in side.build.order" :key="`${itemId}-${index}`">
                    <UIcon v-if="index > 0" name="i-lucide-chevron-right" class="size-3.5 text-dimmed" aria-hidden="true" />
                    <li class="flex flex-col items-center gap-0.5">
                      <GameTooltipItemIcon :item="items[itemId] ?? null" :width="36" :height="36" class="rounded-md" />
                      <span class="text-[10px] tabular-nums text-dimmed">{{ index + 1 }}</span>
                    </li>
                  </template>
                </ol>
              </div>
            </template>
          </BuildCore>
        </div>
      </div>

      <!-- Every choice, option by option, as the analytics page lays a slot. -->
      <section class="surface min-w-0 rounded-2xl p-4">
        <header class="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1">
          <h3 class="stat-label">{{ t('jev.card.choices') }}</h3>
          <span class="flex items-center gap-1 text-[11px] text-muted"><UIcon name="i-tabler-sparkles" class="size-3.5 text-primary" />{{ t('jev.card.jevPick') }}</span>
          <span class="flex items-center gap-1 text-[11px] text-muted"><UIcon name="i-tabler-database" class="size-3.5" />{{ t('jev.card.standardPick') }}</span>
        </header>
        <p class="mb-3 text-xs text-muted">{{ t('jev.card.choicesHint') }}</p>
        <JevChoices :decisions="decisions" />
      </section>
    </template>
  </section>
</template>
