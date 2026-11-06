<script setup lang="ts">
import type { JevBase } from '~/utils/jev-bases'

/**
 * The family of builds Jev ranks within (`useJevBases`): the lane by default,
 * the matchup, each of Blitz's playstyles, the one-tricks — only the ones the
 * sources measured. A choice never asks Jev on its own: its calls are paid,
 * so the answer on screen stays the base it was asked for until the next
 * click, and the line under the pills says so.
 */
const props = defineProps<{
  offered: JevBase[]
  pending: boolean
  /** The base of the answer on screen, if any. */
  answered?: JevBase | null
}>()
const selected = defineModel<string>({ required: true })
const { t } = useT()
const { label } = useJevBaseLabels()

const stale = computed(() => props.answered && props.answered.key !== selected.value ? props.offered.find(base => base.key === selected.value) ?? null : null)
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="flex flex-wrap items-center gap-1.5" role="group" :aria-label="t('jevbase.title')">
      <span class="stat-label mr-1 flex items-center gap-1"><UIcon name="i-tabler-chess-knight" class="size-3.5 text-primary" />{{ t('jevbase.title') }}</span>
      <button
        v-for="base in offered"
        :key="base.key"
        type="button"
        class="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset transition-colors"
        :class="selected === base.key ? 'bg-primary/15 text-primary ring-primary/50' : 'text-muted ring-default hover:text-highlighted'"
        :aria-pressed="selected === base.key"
        @click="selected = base.key"
      >
        <UIcon v-if="base.kind === 'otp'" name="i-lucide-crosshair" class="size-3" />
        {{ label(base) }}
      </button>
      <UIcon v-if="pending" name="i-lucide-loader-circle" class="size-3.5 animate-spin text-dimmed" :aria-label="t('jevbase.reading')" />
    </div>
    <p v-if="stale" class="text-[11px] text-dimmed">{{ t('jevbase.askAgain', { base: label(stale) }) }}</p>
  </div>
</template>
