<script setup lang="ts">
import { getPositionIconUrl } from '#shared/utils/ddragon'
import { POSITIONS, positionLabel } from '#common/utils/positions'
import type { DropdownMenuItem } from '@nuxt/ui'
import type { Lane, TeamRow } from '~/types/draft'
import type { EnemyCounter } from '~/utils/draft-counters'

/**
 * Five picks of one side, left to right, each over the lane it holds. Ours
 * follow the lanes the client assigned; theirs follow the lanes the guesser
 * resolved, and the player corrects one by clicking its lane icon and picking
 * the lane it really plays — or by dragging it onto another — which swaps the
 * two (pinned, so the rest re-solve around the correction). A guessed lane
 * carries no doubt mark: it is simply the one to correct when it is wrong.
 * With `counters`, each enemy shows under its lane the champions that beat it
 * there; the ally side passes none, an empty strip keeping both boards level.
 */
const props = withDefaults(defineProps<{
  team: 'ally' | 'enemy'
  rows: TeamRow[]
  /** The card whose build is on screen, ringed. */
  selectedCell?: number | null
  /** The selected champion's lane opponent, when it is on this side. */
  opponentCell?: number | null
  /** Portraits to suggest in our own empty slot. */
  suggested?: number[]
  /** Enemy lanes resolved: the cards can be dragged to correct them. */
  correctable?: boolean
  /** By enemy champion: who beats it on its lane. Absent on a side that shows no counters. */
  counters?: Map<number, EnemyCounter[]> | null
  /** One pick a line, top to bottom: a team drawn as a column beside the screen's card. */
  vertical?: boolean
}>(), { selectedCell: null, opponentCell: null, suggested: () => [], correctable: false, counters: null, vertical: false })

const emit = defineEmits<{ view: [championId: number], swap: [from: Lane, to: Lane] }>()

const { nameOf, portraitOf } = useChampionStatics()
const { t } = useT()
const { entryOf, mainEntryOf } = useTierList()

/** The tier on the lane the card holds; an enemy on no lane yet reads its main lane's. */
function tierOf(row: TeamRow): string | null {
  if (row.championId === null) return null
  return (entryOf(row.championId, row.lane) ?? mainEntryOf(row.championId))?.tier ?? null
}

const dragging = ref<Lane | null>(null)

/** The row whose player card is open; the riotIds of our side, for its duo line. */
const card = ref<number | null>(null)
function openCard(index: number, open: boolean) {
  if (open) card.value = index
  else if (card.value === index) card.value = null
}
const teammates = computed(() => props.rows.flatMap(row => (row.riotId ? [row.riotId] : [])))

/** WebKit starts no drag that carries no data, so the lane rides along as text. */
function onDragStart(event: DragEvent, lane: Lane | null) {
  dragging.value = lane
  if (!event.dataTransfer || !lane) return
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', lane)
}

function onDragOver(event: DragEvent) {
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}

function onDrop(lane: Lane | null) {
  if (dragging.value && lane && dragging.value !== lane) emit('swap', dragging.value, lane)
  dragging.value = null
}

/**
 * A card opens its champion's build once the draft can place it: our own
 * always, anyone else locked on a lane — a hovered ally or an enemy with no
 * lane yet has no build to read.
 */
const readable = (row: TeamRow) => row.championId !== null && (row.me || (row.locked && row.lane !== null))

/** The lanes an enemy can be moved to, the one it holds marked. */
function laneChoices(row: TeamRow): DropdownMenuItem[] {
  return POSITIONS.map(lane => ({
    label: positionLabel(lane, { short: true }),
    avatar: { src: getPositionIconUrl(lane), alt: '' },
    type: 'checkbox' as const,
    checked: lane === row.lane,
    onSelect: () => {
      if (row.lane && lane !== row.lane) emit('swap', row.lane, lane)
    },
  }))
}

function countersOf(row: TeamRow): EnemyCounter[] {
  return row.championId === null ? [] : (props.counters?.get(row.championId) ?? [])
}

function counterTip(counter: EnemyCounter, enemyId: number) {
  return t('draft.counters.tip', {
    name: nameOf(counter.championId),
    rate: `${(counter.winRate * 100).toFixed(1)}%`,
    enemy: nameOf(enemyId),
    games: counter.games.toLocaleString(),
  })
}

function label(row: TeamRow) {
  if (row.championId === null) return undefined
  const name = nameOf(row.championId)
  return row.lane ? t('draft.team.buildForLane', { name, lane: positionLabel(row.lane, { short: true }) }) : t('draft.team.buildFor', { name })
}
</script>

<template>
  <div v-if="vertical" class="flex flex-col gap-1.5">
    <div
      v-for="(row, index) in rows"
      :key="`${team}-${index}`"
      class="flex min-w-0 flex-col"
      @dragover.prevent="onDragOver"
      @drop.prevent="onDrop(row.lane)"
    >
      <div class="flex items-center gap-1" :class="team === 'enemy' && 'flex-row-reverse'">
        <!-- An ally the client names: who they are, on hover, as Blitz shows them (`DraftPlayerCard`).
             The card is only `aria-disabled` while it has no build to open: a disabled button gets no hover. -->
        <UPopover
          mode="hover"
          :open="card === index"
          :open-delay="350"
          :close-delay="120"
          :content="{ side: team === 'ally' ? 'right' : 'left', align: 'start', sideOffset: 8 }"
          @update:open="(open: boolean) => openCard(index, open && !!row.riotId)"
        >
          <button
            type="button"
            class="block min-w-0 flex-1 rounded-md outline-none transition-[filter] focus-visible:ring-2 focus-visible:ring-primary"
            :class="[counters && countersOf(row).length ? 'h-[5.5rem]' : 'h-16', readable(row) ? 'hover:brightness-125' : 'cursor-default']"
            :aria-disabled="!readable(row)"
            :draggable="correctable && row.championId !== null"
            :aria-label="label(row)"
            @click="readable(row) && emit('view', row.championId!)"
            @dragstart="onDragStart($event, row.lane)"
            @dragend="dragging = null"
          >
            <DraftCard
              row
              :team="team"
              :champion-id="row.championId"
              :tier="tierOf(row)"
              :lane="row.lane"
              :selected="selectedCell === index"
              :opponent="opponentCell === index"
              :tentative="row.championId !== null && !row.locked"
              :drop-target="dragging !== null && row.lane !== null && dragging !== row.lane"
              :suggested="row.me ? suggested : []"
              :class="counters && countersOf(row).length ? 'items-start! pt-2.5' : ''"
            >
              <!-- Who beats this enemy on its lane, on the band's inner side. -->
              <span v-if="counters && countersOf(row).length" class="absolute bottom-2 z-10 flex items-center gap-3.5" :class="team === 'enemy' ? 'right-3' : 'left-3'" :title="t('draft.counters.label')">
                <span v-for="counter in countersOf(row)" :key="counter.championId" class="flex items-center gap-1.5" :title="counterTip(counter, row.championId!)">
                  <img v-if="portraitOf(counter.championId)" :src="portraitOf(counter.championId)!" :alt="nameOf(counter.championId)" class="img-skeleton size-6 rounded ring-1 ring-white/15">
                  <span class="text-[11px] font-bold leading-none tabular-nums text-data-good">{{ Math.round(counter.winRate * 100) }}%</span>
                </span>
              </span>
            </DraftCard>
          </button>
          <template #content>
            <DraftPlayerCard v-if="row.riotId" :riot-id="row.riotId" :champion-id="row.championId" :position="row.lane" :me="!!row.me" :teammates="teammates.filter(id => id !== row.riotId)" />
          </template>
        </UPopover>
        <UDropdownMenu
          v-if="correctable && row.lane && row.championId !== null"
          :items="laneChoices(row)"
          :content="{ align: 'center' }"
          :ui="{ itemLeadingAvatar: 'size-4 rounded-none bg-transparent' }"
        >
          <button
            type="button"
            class="flex size-7 shrink-0 items-center justify-center rounded transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            :aria-label="t('draft.team.change', { name: nameOf(row.championId), lane: positionLabel(row.lane, { short: true }) })"
            :title="t('draft.team.clickToChange', { lane: positionLabel(row.lane, { short: true }) })"
          >
            <img :src="getPositionIconUrl(row.lane)" alt="" class="size-4">
          </button>
        </UDropdownMenu>
        <span v-else class="flex size-7 shrink-0 items-center justify-center">
          <img v-if="row.lane" :src="getPositionIconUrl(row.lane)" :alt="positionLabel(row.lane, { short: true }) ?? ''" class="size-4">
        </span>
      </div>
    </div>
  </div>

  <div v-else class="grid grid-cols-5 gap-1.5">
    <div
      v-for="(row, index) in rows"
      :key="`${team}-${index}`"
      class="flex min-w-0 flex-col items-center gap-1.5"
      @dragover.prevent="onDragOver"
      @drop.prevent="onDrop(row.lane)"
    >
      <button
        type="button"
        class="block h-36 w-full rounded-2xl outline-none transition-[filter] focus-visible:ring-2 focus-visible:ring-primary enabled:enabled:hover:brightness-110 disabled:cursor-default"
        :disabled="!readable(row)"
        :draggable="correctable && row.championId !== null"
        :aria-label="label(row)"
        @click="emit('view', row.championId!)"
        @dragstart="onDragStart($event, row.lane)"
        @dragend="dragging = null"
      >
        <DraftCard
          :team="team"
          :champion-id="row.championId"
          :tier="tierOf(row)"
          :lane="row.lane"
          :selected="selectedCell === index"
          :opponent="opponentCell === index"
          :tentative="row.championId !== null && !row.locked"
          :drop-target="dragging !== null && row.lane !== null && dragging !== row.lane"
          :suggested="row.me ? suggested : []"
        />
      </button>

      <!-- The lane, under a placed champion — an empty card already carries it. An enemy's is a menu to correct it. -->
      <div class="flex h-5 items-center justify-center">
        <UDropdownMenu
          v-if="correctable && row.lane && row.championId !== null"
          :items="laneChoices(row)"
          :content="{ align: 'center' }"
          :ui="{ itemLeadingAvatar: 'size-4 rounded-none bg-transparent' }"
        >
          <button
            type="button"
            class="flex size-6 items-center justify-center rounded transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            :aria-label="t('draft.team.change', { name: nameOf(row.championId), lane: positionLabel(row.lane, { short: true }) })"
            :title="t('draft.team.clickToChange', { lane: positionLabel(row.lane, { short: true }) })"
          >
            <img :src="getPositionIconUrl(row.lane)" alt="" class="size-4">
          </button>
        </UDropdownMenu>
        <img
          v-else-if="row.lane && row.championId !== null"
          :src="getPositionIconUrl(row.lane)"
          :alt="positionLabel(row.lane, { short: true })"
          :title="positionLabel(row.lane, { short: true })"
          class="size-4"
        >
      </div>

      <!-- Who beats this enemy on its lane, best first, its win rate under each. -->
      <div v-if="counters" class="flex h-[38px] w-full flex-col items-center gap-0.5">
        <template v-if="countersOf(row).length">
          <span class="stat-label text-[9px]!">{{ t('draft.counters.label') }}</span>
          <div class="flex gap-1">
            <div
              v-for="counter in countersOf(row)"
              :key="counter.championId"
              class="flex flex-col items-center"
              :title="counterTip(counter, row.championId!)"
            >
              <img v-if="portraitOf(counter.championId)" :src="portraitOf(counter.championId)!" :alt="nameOf(counter.championId)" class="img-skeleton size-5 rounded ring-1 ring-ink-950">
              <span class="text-[9px] font-semibold tabular-nums text-data-good">{{ Math.round(counter.winRate * 100) }}%</span>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
