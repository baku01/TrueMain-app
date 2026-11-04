<script setup lang="ts">
import type { ChampionInsights, InsightToken } from '~/utils/blitz/insights'
import { insightTokens, readChampionInsights } from '~/utils/blitz/insights'
import translations from '~/assets/data/champion-insights.pt-BR.json'
import { getActiveLocale } from '#common/utils/i18n'

/**
 * A champion's insights, as Blitz publishes them: the key insights, the
 * strengths and the weaknesses, each line with the abilities it names drawn
 * as their icon and key (`@spell_Q@`). Blitz writes them in English only; in
 * Portuguese each line is read from the app's translation of them
 * (`assets/data/champion-insights.pt-BR.json`), a line it does not have yet
 * staying in English.
 */
const props = defineProps<{
  championId: number
  /** Drawn inside another pane (the abilities'): no card of its own, no scroll of its own, one section at a time. */
  embedded?: boolean
}>()
const { t } = useT()
const { championStatic, loadChampion, items } = useStaticData()

const insights = shallowRef<ChampionInsights | null>(null)
const status = ref<'pending' | 'ready' | 'error'>('pending')
watch(() => props.championId, async (id) => {
  status.value = 'pending'
  loadChampion(id)
  try {
    insights.value = await readChampionInsights(id)
    status.value = 'ready'
  }
  catch {
    status.value = 'error'
  }
}, { immediate: true })

const dictionary = translations as Record<string, string>
const localized = (line: string) => (getActiveLocale() === 'pt-BR' ? dictionary[line] ?? line : line)
const tokens = (line: string): InsightToken[] => insightTokens(localized(line))
const spell = (key: string) => championStatic(props.championId)?.championSpells[key] ?? null

const SECTIONS = [
  { key: 'insights', tone: 'text-primary', icon: 'i-lucide-lightbulb' },
  { key: 'strengths', tone: 'text-success', icon: 'i-lucide-trending-up' },
  { key: 'weaknesses', tone: 'text-error', icon: 'i-lucide-trending-down' },
] as const
/** The section on screen when embedded: one at a time, picked by its tab. */
const shownSection = ref<typeof SECTIONS[number]['key']>('insights')
const sections = computed(() => (props.embedded ? SECTIONS.filter(section => section.key === shownSection.value) : SECTIONS))
const KEY_TONE: Record<string, string> = { P: 'text-dimmed', Q: 'text-toned', W: 'text-toned', E: 'text-toned', R: 'text-primary' }
</script>

<template>
  <div :class="embedded ? '' : 'min-h-0 overflow-y-auto'">
    <div :class="embedded ? 'space-y-5' : 'surface mx-auto max-w-5xl space-y-6 rounded-2xl p-5'">
      <div v-if="status === 'pending'" class="space-y-3" aria-busy="true">
        <USkeleton v-for="i in 8" :key="i" class="h-5 w-full" />
      </div>
      <p v-else-if="!insights || status === 'error'" class="py-6 text-center text-sm text-muted">{{ t('insights.none') }}</p>
      <template v-else>
        <div v-if="embedded" class="flex flex-wrap gap-1" role="tablist">
          <UButton
            v-for="section in SECTIONS"
            :key="section.key"
            :label="t(`insights.${section.key}`)"
            :icon="section.icon"
            size="xs"
            :color="shownSection === section.key ? 'primary' : 'neutral'"
            :variant="shownSection === section.key ? 'soft' : 'ghost'"
            role="tab"
            :aria-selected="shownSection === section.key"
            @click="shownSection = section.key"
          />
        </div>
        <section v-for="section in sections" :key="section.key" class="space-y-2">
          <h3 v-if="!embedded" class="flex items-center gap-2 text-sm font-semibold" :class="section.tone">
            <UIcon :name="section.icon" class="size-4" />{{ t(`insights.${section.key}`) }}
          </h3>
          <ul class="space-y-2">
            <li v-for="(line, index) in insights[section.key]" :key="index" class="flex gap-2 leading-relaxed text-default" :class="embedded ? 'text-[13px]' : 'text-sm'">
              <span class="mt-2 size-1.5 shrink-0 rounded-full" :class="section.tone.replace('text-', 'bg-')" />
              <span class="selectable">
                <template v-for="(token, at) in tokens(line)" :key="at">
                  <span v-if="'spell' in token" class="relative mx-0.5 inline-flex translate-y-1 align-baseline">
                    <GameTooltipChampionSpellIcon :spell="spell(token.spell)" :width="22" :height="22" class="size-[22px] rounded" />
                    <span class="absolute -right-1.5 -top-1.5 text-[9px] font-bold" :class="KEY_TONE[token.spell]">{{ token.spell }}</span>
                  </span>
                  <span v-else-if="'item' in token" class="mx-0.5 inline-flex translate-y-1 align-baseline">
                    <GameTooltipItemIcon :item="items[token.item] ?? null" :width="22" :height="22" class="size-[22px] rounded" />
                  </span>
                  <template v-else>{{ token.text }}</template>
                </template>
              </span>
            </li>
          </ul>
        </section>
        <p class="text-right text-[10px] text-dimmed">{{ t('insights.source') }}</p>
      </template>
    </div>
  </div>
</template>
