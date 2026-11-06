<script setup lang="ts">
import type { GameflowPhase, LobbyState } from '~/types/lcu'
import type { ImportChoice } from '~/composables/useDraftAutoImport'
import { getPositionIconUrl } from '#shared/utils/ddragon'
import { positionLabel } from '#common/utils/positions'
import { LOBBY_RUNE_TARGET } from '~/composables/useLobbySlots'
import { lanesFor } from '~/utils/lobby-slots'

/**
 * The lobby builds (Swiftplay), as Blitz's: a queue with no champion select
 * picks its champions in the lobby, one per lane, and the game starts on
 * them. The two picks across the top — each changeable there, champion and
 * lane — and under them the build of the one selected, in champion select's
 * layout (`BuildView`): its rows, the pros' builds, the runes, the spells and
 * the items.
 *
 * Read-only until the player clicks. The runes go onto the slot rather than
 * into a rune page (`LOBBY_RUNE_TARGET`), the spells too, from the button in
 * the build's header; the item set is a file per champion, the view's own.
 */
const props = defineProps<{ lobby: LobbyState, phase: GameflowPhase }>()

const { t } = useT()
const { nameOf } = useChampionStatics()
const { pickable, pending, loadChoices, setChampion, setLane, importSpells, importRunes } = useLobbySlots()
onMounted(loadChoices)

const active = ref(0)
watch(() => props.lobby.slots.length, (length) => {
  if (active.value >= length) active.value = 0
})
const shown = computed(() => props.lobby.slots[active.value] ?? null)

// The runes of the build on screen go onto the slot on screen.
provide(LOBBY_RUNE_TARGET, page => importRunes(active.value, page))

/** The build on screen, told by the view: its spells are what the spells button writes. */
const selection = shallowRef<ImportChoice | null>(null)
const spells = computed(() => (selection.value?.spells?.[0] && selection.value.spells[1] ? selection.value.spells : null))

const status = computed(() => {
  if (props.phase === 'Matchmaking') return t('lobby.status.matchmaking')
  if (props.phase === 'ReadyCheck') return t('lobby.status.readyCheck')
  return t('lobby.status.lobby')
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-5">
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <span class="eyebrow">{{ t('lobby.eyebrow') }}</span>
        <h1 class="text-2xl font-semibold tracking-tight text-highlighted">{{ t('lobby.title') }}</h1>
      </div>
      <span class="flex items-center gap-2 text-sm text-muted">
        <span class="relative flex size-2">
          <span class="absolute inline-flex size-full animate-tm-pulse rounded-full bg-primary" />
          <span class="relative inline-flex size-2 rounded-full bg-primary/80" />
        </span>
        {{ status }}
      </span>
    </header>

    <div class="grid gap-3 md:grid-cols-2">
      <LobbySlotCard
        v-for="(entry, index) in lobby.slots"
        :key="index"
        :entry="entry"
        :index="index"
        :active="index === active"
        :lanes="lanesFor(lobby.slots, index)"
        :pickable="pickable"
        :pending="pending"
        @select="active = index"
        @champion="(id, name) => setChampion(index, id, name)"
        @lane="setLane(index, $event)"
      />
    </div>

    <section class="surface flex min-h-[32rem] flex-1 flex-col rounded-xl p-4">
      <BuildView
        v-if="shown?.championId && shown.position"
        :key="active"
        :champion-id="shown.championId"
        :position="shown.position"
        compact
        class="flex-1"
        @selection="selection = $event.selected"
      >
        <template #header>
          <div class="flex items-center gap-2.5">
            <ChampionPortrait :champion-id="shown.championId" size="sm" class="size-10! rounded-lg!" />
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-highlighted">{{ nameOf(shown.championId) }}</p>
              <p class="flex items-center gap-1 text-xs text-muted">
                <img :src="getPositionIconUrl(shown.position)" alt="" class="size-3.5">{{ positionLabel(shown.position) }}
              </p>
            </div>
            <UButton
              v-if="spells"
              size="xs"
              color="neutral"
              variant="soft"
              icon="i-lucide-sparkles"
              class="ml-2"
              :label="t('lobby.spells.import')"
              :loading="pending === `spells-${active}`"
              :disabled="!!pending"
              @click="importSpells(active, spells)"
            />
          </div>
        </template>
      </BuildView>
      <div v-else class="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <UIcon name="i-lucide-user-round-search" class="size-6 text-dimmed" />
        <p class="max-w-sm text-sm text-muted">{{ t('lobby.slot.pickFirst') }}</p>
      </div>
    </section>
  </div>
</template>
