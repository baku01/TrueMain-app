<script setup lang="ts">
import type { GameState } from '~/types/game'
import { ITEM_CONTEXT_TONE_CLASS } from '#shared/utils/item-context'
import { aroundParam } from '~/utils/split-param'

/**
 * What to complete next (#1751): the item the champion's mains take from
 * where this build stands, in a game like this one (#1749), and what of it
 * can be bought with the gold in hand. Read in two seconds while dead or on
 * the walk out of base, so it carries the decision and nothing else: the
 * item, why when a situation moved it, its build path — the components in the
 * order the mains buy them, what the gold buys now (#2183) — the two runners-up,
 * and the boots while they are still open — over it, until one is bought, the
 * starter; under it, the build as a row with the boots at their step (#2101),
 * which also makes the boots the main item when they are due. The overlay draws the item, the gold it still needs and the same
 * build path (`OverlayNextItem`), from the same `useNextItemPanel`.
 */
const props = defineProps<{ game: GameState }>()

const { t } = useT()
const [beforeShort, afterShort] = aroundParam('game.next.goldShort', 'gold')
const [beforeComplete, afterComplete] = aroundParam('game.next.goldToComplete', 'gold')
const games = (count: number) => (count === 1 ? t('game.next.starterGames.one', { count }) : t('game.next.starterGames.other', { count }))
const stepGames = (count: number) => (count === 1 ? t('game.next.stepGames.one', { count }) : t('game.next.stepGames.other', { count }))
const { answer, pending, statics, build, order, top, runnersUp, boots, why, remaining, path, state, name, percent, reason, affordable, starter, starterGold, kit, fromKit, kitDone } = useNextItemPanel(toRef(props, 'game'))
</script>

<template>
  <section class="surface grid grid-cols-[minmax(0,1fr)_auto] gap-6 rounded-xl px-4 py-3">
    <div class="min-w-0">
      <div v-if="starter" class="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-default pb-3">
        <span class="stat-label">{{ t('game.next.starter') }}</span>
        <div class="flex gap-1.5">
          <GameTooltipItemIcon
            v-for="(itemId, index) in starter.itemIds"
            :key="`${itemId}-${index}`"
            :item="statics[itemId] ?? null"
            :width="30"
            :height="30"
            class="size-[30px] rounded ring-1 ring-primary/60"
          />
        </div>
        <span v-if="affordable(starterGold)" class="text-xs text-stat-gold">{{ t('game.next.canBuy') }}</span>
        <span v-else class="text-xs tabular-nums text-muted">{{ beforeShort }}<span class="text-stat-gold">{{ starterGold - game.gold }}</span>{{ afterShort }}</span>
        <span v-if="!kit" class="text-xs tabular-nums text-dimmed" :title="games(starter.games)">{{ t('game.next.starterShare', { share: percent(starter.pickRate) }) }}</span>
      </div>

      <div class="mb-2 flex items-center gap-2">
        <span class="stat-label">{{ t('game.next.title') }}</span>
        <!-- The player's active kit (#2185): its own next step, or the mains' once it has none left. -->
        <span v-if="fromKit" class="flex min-w-0 items-center gap-1 text-xs text-muted"><UIcon name="i-lucide-swords" class="size-3.5 shrink-0 text-primary" /><span class="truncate">{{ t('game.next.kit', { name: kit?.name ?? '' }) }}</span></span>
        <span v-else-if="kitDone" class="text-xs text-dimmed">{{ t('game.next.kitDone') }}</span>
        <span v-if="build && !build.onTree" class="text-xs text-dimmed" :title="t('game.next.offPathTitle')">{{ t('game.next.offPath') }}</span>
        <UIcon v-if="pending && answer" name="i-lucide-loader-circle" class="size-3.5 animate-spin text-dimmed" />
      </div>

      <template v-if="state === 'ready' && top">
        <div class="flex items-start gap-3">
          <GameTooltipItemIcon :item="statics[top.itemId] ?? null" :width="52" :height="52" class="size-13 shrink-0 rounded-lg ring-1 ring-primary/60" />

          <div class="min-w-0 flex-1 space-y-1.5">
            <div class="flex items-baseline gap-2">
              <span class="truncate text-base font-semibold text-highlighted">{{ name(top.itemId) }}</span>
              <span v-if="!fromKit" class="text-xs tabular-nums text-muted" :title="stepGames(top.games)">{{ t('game.next.mainsShare', { share: percent(top.share) }) }}</span>
            </div>
            <p v-if="why" class="text-sm text-muted">
              <template v-for="(token, index) in why" :key="index">
                <span :class="token.tone && ITEM_CONTEXT_TONE_CLASS[token.tone]">{{ token.text }}</span>
              </template>
            </p>

            <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-0.5">
              <span v-if="remaining > 0" class="text-xs tabular-nums text-muted">
                {{ beforeComplete }}<span class="text-stat-gold">{{ remaining }}</span>{{ afterComplete }}
              </span>
              <span v-else class="text-xs text-stat-gold">{{ t('game.next.ready') }}</span>
              <span v-if="path && path.entries.length && !path.measured" class="text-xs text-dimmed" :title="t('game.next.recipeOrderTitle')">{{ t('game.next.recipeOrder') }}</span>
            </div>
            <GameBuildPath v-if="path" :path="path" :statics="statics" class="pt-1" />
          </div>

          <div v-if="runnersUp.length" class="flex shrink-0 flex-col items-end gap-1.5 border-l border-default pl-3">
            <span class="stat-label">{{ t('game.next.or') }}</span>
            <div class="flex gap-1.5">
              <div v-for="candidate in runnersUp" :key="candidate.itemId" class="flex flex-col items-center gap-0.5">
                <GameTooltipItemIcon :item="statics[candidate.itemId] ?? null" :width="30" :height="30" class="size-[30px] rounded" />
                <span class="text-[10px] tabular-nums text-dimmed">{{ percent(candidate.share) }}</span>
              </div>
            </div>
          </div>
        </div>

        <GameBuildOrder :steps="order" :statics="statics" class="mt-3 border-t border-default pt-3" />
      </template>

      <p v-else-if="state === 'unmeasured'" class="text-sm text-muted">{{ t('game.next.unmeasured') }}</p>
      <p v-else-if="state === 'complete'" class="text-sm text-muted">{{ t('game.next.complete') }}</p>
      <p v-else-if="state === 'offline'" class="text-sm text-muted">{{ t('game.next.offline') }}</p>
      <div v-else class="flex items-center gap-3">
        <USkeleton class="size-13 rounded-lg" />
        <div class="space-y-1.5">
          <USkeleton class="h-4 w-40" />
          <USkeleton class="h-3 w-56" />
        </div>
      </div>
    </div>

    <div v-if="boots.length" class="flex flex-col gap-2 border-l border-default pl-4">
      <span class="stat-label">{{ t('game.next.boots') }}</span>
      <div class="flex gap-2">
        <div v-for="(candidate, index) in boots" :key="candidate.itemId" class="flex flex-col items-center gap-0.5">
          <GameTooltipItemIcon
            :item="statics[candidate.itemId] ?? null"
            :width="index === 0 ? 36 : 28"
            :height="index === 0 ? 36 : 28"
            class="rounded"
            :class="index === 0 ? 'size-9 ring-1 ring-primary/60' : 'size-7 opacity-70'"
          />
          <span class="text-[10px] tabular-nums" :class="index === 0 ? 'text-muted' : 'text-dimmed'">{{ percent(candidate.share) }}</span>
        </div>
      </div>
      <p v-if="reason(boots[0] ?? null)" class="max-w-40 text-xs text-dimmed">
        <template v-for="(token, index) in reason(boots[0] ?? null)" :key="index">
          <span :class="token.tone && ITEM_CONTEXT_TONE_CLASS[token.tone]">{{ token.text }}</span>
        </template>
      </p>
    </div>
  </section>
</template>
