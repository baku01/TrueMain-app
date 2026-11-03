<script setup lang="ts">
import { formatPercentage } from '#shared/utils/ddragon'
import type { ChampionItemContextAxis } from '#shared/types/item-context'
import type { DraftItemPush } from '~/utils/draft-damage'
import { ITEM_CONTEXT_TONE_CLASS } from '#shared/utils/item-context'
import { localizedAxisPhrase } from '#common/utils/item-context-phrases'

/**
 * "Against this draft" (#1907): the boots and the first legendary this
 * draft's situation moves the mains toward — Mercury's Treads against a magic
 * team, an armour item against a physical one — each with the situation that
 * moves it, in the site's item-context wording. Measured: it is the in-game
 * next-item read asked before the first purchase. Absent when the draft moves
 * nothing; the build below is then already the answer.
 */
/** The draft's pushes, read once by the screen (`useDraftItemAdvice`): the Blitz build panel marks the same items. */
const props = defineProps<{ pushes: DraftItemPush[] }>()
const pushes = toRef(props, 'pushes')
const { items } = useStaticData()
const { t } = useT()

const name = (itemId: number) => items.value[itemId]?.name ?? t('draft.advice.item', { id: itemId })
const percent = (share: number) => formatPercentage(share, 0)

/** Only the advice the site has words for: an axis without a sentence is a reason nobody could read. */
const shown = computed(() => pushes.value.flatMap((push) => {
  const phrase = localizedAxisPhrase({ axis: push.reason.axis, bucket: push.reason.bucket } as ChampionItemContextAxis)
  return phrase ? [{ ...push, phrase }] : []
}))
</script>

<template>
  <div v-if="shown.length" class="flex flex-wrap items-stretch gap-2">
    <div
      v-for="push in shown"
      :key="push.slot"
      class="flex min-w-0 flex-1 basis-56 items-center gap-2.5 rounded-lg bg-elevated/60 py-1.5 pl-1.5 pr-2.5"
      :title="t('draft.advice.title', { share: percent(push.share), base: percent(push.baseShare) })"
    >
      <GameTooltipItemIcon :item="items[push.itemId] ?? null" :width="32" :height="32" class="size-8 shrink-0 rounded-md" />
      <div class="min-w-0 leading-tight">
        <p class="truncate text-[13px] font-semibold text-highlighted">
          {{ name(push.itemId) }}
          <span class="ml-1 text-[11px] font-normal tabular-nums text-dimmed">{{ t('draft.advice.vs', { share: percent(push.share), base: percent(push.baseShare) }) }}</span>
        </p>
        <p class="truncate text-xs text-muted">
          <template v-for="(token, index) in push.phrase" :key="index">
            <span :class="token.tone && ITEM_CONTEXT_TONE_CLASS[token.tone]">{{ token.text }}</span>
          </template>
        </p>
      </div>
    </div>
  </div>
</template>
