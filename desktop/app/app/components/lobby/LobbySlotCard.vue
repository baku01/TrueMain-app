<script setup lang="ts">
import type { LobbySlot } from '~/types/lcu'
import { getPositionIconUrl } from '#shared/utils/ddragon'
import { positionLabel } from '#common/utils/positions'
import { LOBBY_LANES, pickerChampions } from '~/utils/lobby-slots'

/**
 * One of the player's lobby picks (Swiftplay), as Blitz's lobby builds draw
 * it: the champion over its faint splash, its lane among the five — the other
 * slot's taken — and the picker to change it. Clicking the card shows its
 * build below; changing the champion or the lane writes to the client, and
 * only on that click (`useLobbySlots`).
 */
const props = defineProps<{
  entry: LobbySlot
  index: number
  active: boolean
  /** The lanes this slot may move to (`lanesFor`). */
  lanes: string[]
  /** The champions the client lets the player put here; null while unknown. */
  pickable: number[] | null
  /** The write out right now, which disables the card's controls. */
  pending: string | null
}>()

const emit = defineEmits<{ select: [], champion: [id: number, name: string], lane: [position: string] }>()

const { t } = useT()
const { state } = useLcuState()
const { champions, nameOf, portraitOf } = useChampionStatics()

const open = ref(false)
const term = ref('')
watch(open, (value) => {
  if (!value) term.value = ''
})
const listed = computed(() => pickerChampions([...champions.value.values()], props.pickable, state.value.championPool, term.value))

function pick(id: number, name: string) {
  open.value = false
  if (id !== props.entry.championId) emit('champion', id, name)
}
</script>

<template>
  <div
    class="relative flex min-w-0 items-center gap-3 overflow-hidden rounded-xl bg-elevated p-3 ring-1 ring-inset transition-[box-shadow]"
    :class="active ? 'ring-primary/60 shadow-[0_0_0_1px_var(--ui-primary)]' : 'ring-default hover:ring-accented'"
  >
    <ChampionArt v-if="entry.championId" :champion-id="entry.championId" fade="none" position="60% 20%" class="absolute inset-0 opacity-20 [mask-image:linear-gradient(to_right,transparent,black_60%)]" />

    <button type="button" class="relative flex min-w-0 flex-1 items-center gap-3 text-left" :aria-pressed="active" @click="emit('select')">
      <span class="relative shrink-0">
        <span class="block size-14 overflow-hidden rounded-full ring-2" :class="active ? 'ring-primary/70' : 'ring-default'">
          <img v-if="entry.championId && portraitOf(entry.championId)" :src="portraitOf(entry.championId)!" :alt="nameOf(entry.championId)" class="img-skeleton size-full scale-110 object-cover">
          <span v-else class="flex size-full items-center justify-center border border-dashed border-default text-dimmed">?</span>
        </span>
        <span v-if="entry.position" class="absolute -bottom-1.5 left-1/2 flex size-5 -translate-x-1/2 items-center justify-center rounded-full bg-default ring-1 ring-default">
          <img :src="getPositionIconUrl(entry.position)" alt="" class="size-3">
        </span>
      </span>
      <span class="min-w-0">
        <span class="stat-label block">{{ t('lobby.slot.label', { n: index + 1 }) }}</span>
        <span class="block truncate font-display text-[15px] font-bold uppercase tracking-[0.06em] text-highlighted">
          {{ entry.championId ? nameOf(entry.championId) : t('lobby.slot.empty') }}
        </span>
        <span v-if="entry.position" class="block text-xs text-muted">{{ positionLabel(entry.position) }}</span>
      </span>
    </button>

    <div class="relative flex shrink-0 flex-col items-end gap-2">
      <!-- The lanes, the other slot's out of reach: the client keeps the two apart. -->
      <div class="flex gap-0.5" role="group" :aria-label="t('lobby.slot.lane')">
        <UTooltip v-for="lane in LOBBY_LANES" :key="lane" :text="positionLabel(lane)">
          <button
            type="button"
            class="flex size-7 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-25"
            :class="entry.position === lane ? 'bg-primary/15 ring-1 ring-inset ring-primary/50' : 'hover:bg-accented'"
            :disabled="!!pending || (lane !== entry.position && !lanes.includes(lane))"
            :aria-pressed="entry.position === lane"
            :aria-label="positionLabel(lane)"
            @click="lane !== entry.position && emit('lane', lane)"
          >
            <img :src="getPositionIconUrl(lane)" alt="" class="size-4" :class="entry.position === lane ? '' : 'opacity-60'">
          </button>
        </UTooltip>
      </div>

      <UPopover v-model:open="open" :content="{ align: 'end' }">
        <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-repeat" :label="t('lobby.slot.change')" :loading="pending === `champion-${index}`" :disabled="!!pending" />
        <template #content>
          <div class="flex w-80 flex-col gap-2 p-2">
            <UInput v-model="term" icon="i-lucide-search" size="sm" :placeholder="t('lobby.slot.search')" />
            <div class="grid max-h-72 grid-cols-6 gap-1.5 overflow-y-auto pr-1">
              <button
                v-for="champion in listed"
                :key="champion.id"
                type="button"
                class="flex flex-col items-center gap-0.5 rounded-md p-1 transition-colors hover:bg-accented"
                :class="champion.id === entry.championId && 'bg-primary/15 ring-1 ring-inset ring-primary/50'"
                :title="champion.name"
                @click="pick(champion.id, champion.name)"
              >
                <img v-if="portraitOf(champion.id)" :src="portraitOf(champion.id)!" :alt="champion.name" class="img-skeleton size-9 rounded-md">
                <span class="w-full truncate text-center text-[10px] text-muted">{{ champion.name }}</span>
              </button>
            </div>
            <p v-if="!listed.length" class="py-4 text-center text-xs text-muted">{{ t('lobby.slot.noMatch') }}</p>
          </div>
        </template>
      </UPopover>
    </div>
  </div>
</template>
