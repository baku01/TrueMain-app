<script setup lang="ts">
import type { Confidence } from '~/utils/nerd-stats/insights'

/**
 * A block's takeaway, said first and plainly — "you win 61% when you are
 * ahead in gold at 15 minutes, 38% when you are behind" — with how far it can
 * be trusted beside it, and a word when it rests on few games.
 */
defineProps<{
  /** The sentence, its figures marked `**…**` (`NerdRich`). */
  text: string
  confidence?: Confidence
  /** The technical figure behind the confidence (`q = 0,003`). */
  detail?: string
  few?: boolean
  icon?: string
  /** The accent of the sentence's edge: the side it leans to. */
  tone?: 'win' | 'loss' | 'neutral'
}>()

const { t } = useT()
</script>

<template>
  <div class="nerd-lead" :data-tone="tone ?? 'neutral'">
    <UIcon :name="icon ?? 'i-tabler-bulb'" class="nerd-lead-icon mt-0.5 size-4 shrink-0" />
    <div class="min-w-0 flex-1">
      <p class="text-[13.5px] leading-relaxed text-toned"><NerdRich :text="text" /></p>
      <p v-if="few" class="mt-1 flex items-center gap-1 text-[11px] font-medium text-warning">
        <UIcon name="i-lucide-triangle-alert" class="size-3.5 shrink-0" />{{ t('nerd.few') }}
      </p>
    </div>
    <NerdConfidence v-if="confidence" :level="confidence" :detail="detail" class="shrink-0" />
  </div>
</template>

<style scoped>
.nerd-lead {
  --tone: var(--ui-primary);
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  padding: 0.625rem 0.75rem;
  border-radius: 0.5rem;
  background:
    linear-gradient(90deg, color-mix(in oklch, var(--tone) 10%, transparent), transparent 70%),
    color-mix(in oklch, var(--ui-bg-elevated) 45%, transparent);
  box-shadow: inset 3px 0 0 var(--tone), inset 0 0 0 1px var(--ui-border);
  animation: tm-rise 320ms var(--tm-ease) backwards;
}

.nerd-lead[data-tone='win'] {
  --tone: var(--nerd-win);
}

.nerd-lead[data-tone='loss'] {
  --tone: var(--nerd-loss);
}

.nerd-lead-icon {
  color: var(--tone);
}

@media (prefers-reduced-motion: reduce) {
  .nerd-lead {
    animation: none;
  }
}
</style>
