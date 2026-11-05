<script setup lang="ts">
import type { CompositionBuildRequest } from '~/types/build'
import type { PickSubject } from '~/composables/useJevPick'
import type { PickParts } from '~/utils/jev-recommend'
import type { ItemSetBlocks } from '~/composables/useItemSetImport'
import { PICK_WEIGHTS, itemSetOf } from '~/utils/jev-recommend'

/**
 * Jev beside champion select's lower half, a narrow panel next to the
 * source's own: while our pick is open, the source's best candidates for our
 * lane as Jev ranks them (`useJevPick`) — a list, each with its score, its
 * breakdown on hover, a click opening its build and a control hovering it in
 * the client; once our champion is set, Jev's build for the draft
 * (`useJevBuild`) in short — its buy order and the import buttons — the
 * whole of it in a slide-over. Jev only answers a click: each
 * ask is a paid call.
 */
const props = defineProps<{
  mode: 'pick' | 'build'
  pick: PickSubject | null
  build: { championId: number, request: CompositionBuildRequest } | null
}>()
const emit = defineEmits<{ preview: [championId: number], collapse: [] }>()
const { t } = useT()
const { nameOf } = useChampionStatics()
const { items } = useStaticData()

const pick = toRef(props, 'pick')
const picks = useJevPick(pick)
const build = toRef(props, 'build')
const jev = useJevBuild(build)

const status = computed(() => (props.mode === 'pick' ? picks.status.value : jev.status.value))
const error = computed(() => (props.mode === 'pick' ? picks.error.value : jev.error.value))
const ask = () => (props.mode === 'pick' ? picks.ask() : jev.ask())
const ready = computed(() => status.value === 'ready')
const details = ref(false)

const PARTS: (keyof PickParts)[] = ['stats', 'lane', 'team', 'enemy']
/** Each part read, its share of the weight that counted, and the points it brings. */
const breakdown = (parts: PickParts) => {
  const present = PARTS.filter(part => parts[part] !== undefined)
  const weight = present.reduce((sum, part) => sum + PICK_WEIGHTS[part], 0)
  return present.map(part => ({ part, value: parts[part]!, weight: PICK_WEIGHTS[part] / weight, points: (PICK_WEIGHTS[part] / weight) * parts[part]! * 100 }))
}
const laid = computed(() => jev.jevBuild.value)
const itemSet = computed((): ItemSetBlocks | null => (laid.value && props.build ? { championId: props.build.championId, champion: nameOf(props.build.championId), blocks: itemSetOf(jev.ranked.value, laid.value) } : null))
</script>

<template>
  <aside class="surface flex h-full min-h-0 flex-col gap-2.5 rounded-xl p-3">
    <header class="flex items-center gap-2">
      <UIcon name="i-tabler-chess-knight" class="size-4 text-primary" />
      <h3 class="min-w-0 flex-1 truncate text-sm font-semibold text-highlighted">{{ mode === 'pick' ? t('jev.pick.title') : t('jev.card.jevBuild') }}</h3>
      <UButton
        size="xs"
        :label="ready ? t('jev.panel.again') : t('jev.panel.ask')"
        :loading="status === 'loading'"
        :disabled="mode === 'pick' ? !pick : !build"
        :title="mode === 'pick' ? t('jev.pick.description') : t('jev.card.description')"
        @click="ask()"
      />
      <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-panel-right-close" :aria-label="t('jev.panel.collapse')" @click="emit('collapse')" />
    </header>

    <p v-if="status === 'noKey'" class="text-xs text-warning">{{ t('jev.card.noKey') }} <ULink to="/settings" class="underline">{{ t('jev.card.openSettings') }}</ULink></p>
    <p v-else-if="status === 'error'" class="text-xs text-error" :title="error ?? undefined">{{ t('jev.card.error') }}</p>
    <p v-else-if="status === 'noCandidates'" class="text-xs text-muted">{{ t('jev.pick.noCandidates') }}</p>
    <p v-else-if="status === 'idle'" class="text-xs text-dimmed">{{ mode === 'pick' && !pick ? t('jev.pick.waiting') : t('jev.panel.idle') }}</p>

    <div v-if="status === 'loading'" class="flex flex-col gap-1.5">
      <USkeleton v-for="i in 5" :key="i" class="h-9 rounded-lg" />
    </div>

    <!-- The pick: a ranked list. -->
    <ol v-else-if="mode === 'pick' && ready" class="-mx-1 flex min-h-0 flex-col gap-0.5 overflow-y-auto px-1">
      <li v-for="(entry, index) in picks.ranked.value" :key="entry.championId" class="flex items-center gap-1">
        <UTooltip :content="{ side: 'left' }" :delay-duration="150" class="min-w-0 flex-1">
          <button
            type="button"
            class="flex w-full min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors"
            :class="index === 0 ? 'bg-primary/12' : 'hover:bg-accented/40'"
            :aria-label="t('draft.sugg.buildFor', { name: nameOf(entry.championId) })"
            @click="emit('preview', entry.championId)"
          >
            <span class="w-3 text-right text-[11px] font-semibold tabular-nums text-dimmed">{{ index + 1 }}</span>
            <ChampionPortrait :champion-id="entry.championId" size="sm" class="size-7! rounded-md!" />
            <span class="min-w-0 flex-1 truncate text-[13px] font-semibold text-highlighted">{{ nameOf(entry.championId) }}</span>
            <span class="text-sm font-bold tabular-nums" :class="index === 0 ? 'text-primary' : 'text-default'">{{ Math.round(entry.total * 100) }}</span>
          </button>
          <template #content>
            <div class="flex w-56 flex-col gap-1.5 rounded-md bg-default p-2 ring-1 ring-default">
              <p class="text-xs font-semibold text-highlighted">{{ t('jev.pick.breakdown') }}</p>
              <div class="grid grid-cols-[minmax(0,1fr)_2.5rem_2.5rem] gap-x-2 gap-y-1 text-[11px] tabular-nums">
                <span class="text-dimmed">{{ t('jev.pick.signal') }}</span>
                <span class="text-right text-dimmed">{{ t('jev.pick.weight') }}</span>
                <span class="text-right text-dimmed">{{ t('jev.pick.points') }}</span>
                <template v-for="row in breakdown(entry.parts)" :key="row.part">
                  <span class="truncate text-muted">{{ t(`jev.pick.part.${row.part}`) }} · {{ Math.round(row.value * 100) }}</span>
                  <span class="text-right text-muted">{{ Math.round(row.weight * 100) }}%</span>
                  <span class="text-right font-semibold text-highlighted">{{ Math.round(row.points) }}</span>
                </template>
              </div>
              <p v-if="entry.confidence !== null" class="text-[10px] text-dimmed">{{ t('jev.card.confidence', { value: `${Math.round(entry.confidence * 100)}%` }) }}</p>
            </div>
          </template>
        </UTooltip>
        <DraftChampionAction :champion-id="entry.championId" compact />
      </li>
    </ol>

    <!-- The build: in short, the whole of it a click away. -->
    <div v-else-if="mode === 'build' && ready && laid && build" class="flex min-h-0 flex-col gap-3 overflow-y-auto">
      <div class="flex flex-col gap-1">
        <p class="stat-label">{{ t('jev.card.order') }}</p>
        <ol class="flex flex-wrap items-center gap-1">
          <template v-for="(itemId, index) in laid.order" :key="`${itemId}-${index}`">
            <UIcon v-if="index > 0" name="i-lucide-chevron-right" class="size-3 text-dimmed" aria-hidden="true" />
            <li><GameTooltipItemIcon :item="items[itemId] ?? null" :width="28" :height="28" class="rounded-md" /></li>
          </template>
        </ol>
      </div>
      <div class="flex flex-wrap items-center gap-1.5">
        <BuildRuneImport v-if="laid.runePage" :page="laid.runePage" :champion="nameOf(build.championId)" labeled />
        <BuildItemSetImport v-if="itemSet" :subject="itemSet" labeled />
        <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-maximize-2" :label="t('jev.panel.details')" @click="details = true" />
      </div>
    </div>

    <USlideover v-model:open="details" side="right" :title="`${t('jev.card.jevBuild')} · ${build ? nameOf(build.championId) : ''}`" :ui="{ content: 'max-w-6xl' }">
      <template #body>
        <JevBuildBody
          v-if="build"
          :champion-id="build.championId"
          :ranked="jev.ranked.value"
          :needs="jev.needs.value"
          :enemies="jev.enemies.value"
          :jev-build="jev.jevBuild.value"
          :standard-build="jev.standardBuild.value"
        />
      </template>
    </USlideover>
  </aside>
</template>
