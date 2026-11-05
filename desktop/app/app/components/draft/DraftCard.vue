<script setup lang="ts">
import { getPositionIconUrl } from '#shared/utils/ddragon'

/**
 * One pick of a team, as Blitz draws a player in champion select: the
 * champion's splash faint behind the card, a round portrait in the side's
 * colour with its lane on a badge over its edge, the name under it, its tier
 * on its lane in the corner. The card's outline is the side's colour.
 *
 * One ring, in TrueMain's colour, marks the card whose build and lane are on
 * screen (`selected`); a faint one of the same colour marks its lane opponent
 * across the board, so the duel reads as a pair rather than as a second
 * selection. A dragged enemy shows its drop targets.
 */
const props = withDefaults(defineProps<{
  championId?: number | null
  team: 'ally' | 'enemy'
  tier?: string | null
  /** The lane glyph an empty slot shows. */
  lane?: string | null
  /** Hovered, not locked in yet. */
  tentative?: boolean
  /** Its build and lane are the ones on screen. */
  selected?: boolean
  /** The selected champion's lane opponent. */
  opponent?: boolean
  dropTarget?: boolean
  /** Portraits to suggest in our own empty slot. */
  suggested?: number[]
}>(), { championId: null, tier: null, lane: null, suggested: () => [] })

const { nameOf, portraitOf } = useChampionStatics()
const { t } = useT()

const ring = computed(() => {
  if (props.dropTarget) return 'ring-2 ring-accented'
  if (props.selected) return 'ring-2 ring-primary'
  if (props.opponent) return 'ring-2 ring-primary/35'
  return props.team === 'ally' ? 'ring-1 ring-ally/35' : 'ring-1 ring-enemy/35'
})
</script>

<template>
  <div
    class="relative flex size-full flex-col items-center justify-end gap-1.5 overflow-hidden rounded-2xl bg-elevated px-1.5 pb-2.5 transition-[box-shadow,opacity]"
    :class="ring"
    :title="championId ? nameOf(championId) : undefined"
  >
    <template v-if="championId">
      <!-- The splash, faint, behind the card, as Blitz backs a player's card. -->
      <ChampionArt :champion-id="championId" kind="splash" fade="none" position="50% 20%" class="absolute inset-0 opacity-25 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
      <TierBadge v-if="tier && !tentative" :caption="false" :size="22" :tier="tier" class="absolute left-2 top-2" />

      <span class="relative">
        <span class="block size-14 overflow-hidden rounded-full ring-2" :class="[team === 'ally' ? 'ring-ally/70' : 'ring-enemy/70', tentative && 'opacity-55 grayscale']">
          <img v-if="portraitOf(championId)" :src="portraitOf(championId)!" :alt="nameOf(championId)" class="img-skeleton size-full scale-110 object-cover">
        </span>
        <span v-if="lane" class="absolute -bottom-1.5 left-1/2 flex size-5 -translate-x-1/2 items-center justify-center rounded-full bg-default ring-1 ring-default">
          <img :src="getPositionIconUrl(lane)" alt="" class="size-3">
        </span>
      </span>
      <span class="relative mt-1 w-full truncate text-center text-[13px] font-semibold text-highlighted">{{ nameOf(championId) }}</span>
      <span v-if="tentative" class="relative stat-label text-[9px]! text-muted!">{{ t('draft.card.hovering') }}</span>
    </template>

    <template v-else>
      <span class="mb-auto mt-auto flex size-14 items-center justify-center rounded-full border border-dashed border-default">
        <img v-if="lane" :src="getPositionIconUrl(lane)" alt="" class="size-6 opacity-30">
      </span>
      <div v-if="suggested.length" class="flex flex-col items-center gap-1">
        <span class="stat-label text-[9px]!">{{ t('draft.card.suggested') }}</span>
        <div class="flex -space-x-1">
          <template v-for="id in suggested.slice(0, 3)" :key="id">
            <img v-if="portraitOf(id)" :src="portraitOf(id)!" :alt="nameOf(id)" class="img-skeleton size-5 rounded-full ring-1 ring-ink-950">
          </template>
        </div>
      </div>
    </template>

    <slot />
  </div>
</template>
