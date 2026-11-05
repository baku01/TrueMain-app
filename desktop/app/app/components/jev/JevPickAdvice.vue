<script setup lang="ts">
import type { PickSubject } from '~/composables/useJevPick'
import type { PickParts } from '~/utils/jev-recommend'

/**
 * Champion select's "pick with Jev": the source's best candidates for our
 * lane, read by Jev against the lane opponent, with our team and against the
 * enemy team, ranked with the source's own ranking — on a click, each ask a
 * paid call. Each card says its score and its parts; a click on it opens its
 * build against this draft, and its corner control hovers it in the client.
 */
const props = defineProps<{ subject: PickSubject | null }>()
const emit = defineEmits<{ preview: [championId: number] }>()
const { t } = useT()
const { nameOf } = useChampionStatics()
const subject = toRef(props, 'subject')
const { status, error, ranked, ask } = useJevPick(subject)

const PARTS: (keyof PickParts)[] = ['stats', 'lane', 'team', 'enemy']
const percent = (value: number) => `${Math.round(value * 100)}%`
const barTone = (value: number) => (value >= 0.6 ? 'bg-primary' : value <= 0.35 ? 'bg-error/70' : 'bg-(--ui-text-dimmed)')
</script>

<template>
  <section class="flex h-full min-h-0 flex-col gap-3">
    <header class="flex flex-wrap items-center gap-3">
      <UIcon name="i-tabler-chess-knight" class="size-5 text-primary" />
      <div class="min-w-0 flex-1">
        <h2 class="text-base font-semibold text-highlighted">{{ t('jev.pick.title') }}</h2>
        <p class="text-xs text-muted">{{ t('jev.pick.description') }}</p>
      </div>
      <UButton icon="i-tabler-chess-knight" :label="status === 'ready' ? t('jev.card.again') : t('jev.card.ask')" :loading="status === 'loading'" :disabled="!subject" size="sm" @click="ask()" />
    </header>

    <UAlert v-if="status === 'noKey'" color="warning" variant="subtle" icon="i-lucide-key-round" :title="t('jev.card.noKey')" :actions="[{ label: t('jev.card.openSettings'), to: '/settings', color: 'warning', variant: 'outline' }]" />
    <UAlert v-else-if="status === 'noCandidates'" color="neutral" variant="subtle" icon="i-lucide-circle-alert" :title="t('jev.pick.noCandidates')" />
    <UAlert v-else-if="status === 'error'" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="t('jev.card.error')" :description="error ?? undefined" />

    <div v-if="status === 'loading'" class="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <USkeleton v-for="i in 8" :key="i" class="h-28 rounded-xl" />
    </div>

    <ol v-else-if="status === 'ready'" class="grid min-h-0 grid-cols-2 gap-2 overflow-y-auto lg:grid-cols-4">
      <li v-for="(pick, index) in ranked" :key="pick.championId" class="relative">
        <button
          type="button"
          class="flex h-full w-full flex-col gap-2 rounded-xl p-2.5 text-left transition-colors"
          :class="index === 0 ? 'bg-primary/12 ring-1 ring-primary/50' : 'bg-accented/25 hover:bg-accented/45'"
          :aria-label="t('draft.sugg.buildFor', { name: nameOf(pick.championId) })"
          @click="emit('preview', pick.championId)"
        >
          <span class="flex items-center gap-2.5">
            <ChampionPortrait :champion-id="pick.championId" size="sm" class="size-10! rounded-lg!" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold text-highlighted">{{ nameOf(pick.championId) }}</span>
              <span v-if="pick.confidence !== null" class="text-[10px] tabular-nums text-dimmed" :title="t('jev.read.confidenceHint')">{{ t('jev.card.confidence', { value: percent(pick.confidence) }) }}</span>
            </span>
            <span class="pr-7 text-xl font-bold tabular-nums" :class="index === 0 ? 'text-primary' : 'text-highlighted'" :title="t('jev.card.totalHint')">{{ Math.round(pick.total * 100) }}</span>
          </span>
          <span class="grid grid-cols-2 gap-x-3 gap-y-1">
            <template v-for="part in PARTS" :key="part">
              <span v-if="pick.parts[part] !== undefined" class="grid grid-cols-[4.2rem_minmax(0,1fr)_1.4rem] items-center gap-1 text-[10px] tabular-nums" :title="t(`jev.pick.part.${part}.hint`)">
                <span class="truncate text-muted">{{ t(`jev.pick.part.${part}`) }}</span>
                <span class="h-1 overflow-hidden rounded-full bg-accented/70"><span class="block h-full rounded-full" :class="barTone(pick.parts[part]!)" :style="{ width: percent(pick.parts[part]!) }" /></span>
                <span class="text-right text-default">{{ Math.round(pick.parts[part]! * 100) }}</span>
              </span>
            </template>
          </span>
        </button>
        <!-- The write is its own target, over the card's corner. -->
        <span class="absolute right-2 top-2">
          <DraftChampionAction :champion-id="pick.championId" compact />
        </span>
      </li>
    </ol>

    <div v-else-if="status === 'idle'" class="flex flex-1 flex-col items-center justify-center gap-2 text-center">
      <UIcon name="i-tabler-chess-knight" class="size-6 text-dimmed" />
      <p class="max-w-md text-sm text-muted">{{ subject ? t('jev.pick.idle') : t('jev.pick.waiting') }}</p>
    </div>
  </section>
</template>
