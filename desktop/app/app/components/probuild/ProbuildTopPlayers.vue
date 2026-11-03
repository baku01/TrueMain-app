<script setup lang="ts">
import type { TopPlayer } from '~/utils/sources/analytics'
import type { BuildOption } from '~/types/build'
import { readTopPlayers } from '~/utils/sources/players'
import { lastGameOn } from '~/utils/blitz/player'
import { proBuildOption } from '~/utils/blitz/pro'

/**
 * The best players on the champion, as the picked source ranks them
 * (`utils/sources/players.ts`) — op.gg's master+ leaderboard, lolalytics' top
 * of the ladder, TrueMain's true mains. Blitz's pros come with their games
 * (`ProbuildProMatches`). `compact` is the champion page's side list.
 */
const props = defineProps<{ championId: number, position: string | null, compact?: boolean, selectable?: boolean }>()
/** A player picked: their last game on the champion, read from Blitz by Riot ID, as a build. */
const emit = defineEmits<{ select: [option: BuildOption, player: string] }>()
const { t } = useT()

const SOURCE_NAME: Record<string, string> = { truemain: 'TrueMain', blitz: 'Blitz', opgg: 'op.gg', lolalytics: 'lolalytics', tencent: 'Tencent' }
const source = computed(() => SOURCE_NAME[dataSource.value] ?? dataSource.value)
const players = ref<TopPlayer[] | null>(null)

let latest = 0
watch(() => [props.championId, props.position] as const, async ([championId, position]) => {
  const read = ++latest
  players.value = null
  try {
    const answer = await readTopPlayers(championId, position ?? 'MIDDLE')
    if (read === latest) players.value = answer ?? []
  }
  catch {
    if (read === latest) players.value = []
  }
}, { immediate: true })

const pending = ref<string | null>(null)
const missing = ref(new Set<string>())
async function pick(player: TopPlayer) {
  if (!player.region || pending.value) return
  pending.value = player.name
  try {
    const game = await trackLoad(lastGameOn({ name: player.name, region: player.region, portraitUrl: player.portraitUrl }, props.championId))
    if (game) emit('select', proBuildOption(game), player.name.split('#')[0] ?? player.name)
    else missing.value = new Set([...missing.value, player.name])
  }
  catch {
    missing.value = new Set([...missing.value, player.name])
  }
  finally {
    pending.value = null
  }
}
</script>

<template>
  <section :class="compact ? 'flex flex-col gap-1' : 'surface space-y-3 rounded-2xl p-4'">
    <header class="flex items-center gap-2" :class="compact ? 'px-2 pb-1' : ''">
      <h3 :class="compact ? 'stat-label' : 'text-base font-semibold text-highlighted'">{{ t('analytics.section.players') }}</h3>
      <UBadge :label="source" color="primary" variant="subtle" size="sm" class="ml-auto normal-case tracking-normal" />
    </header>
    <div v-if="players === null" class="space-y-1.5" :class="compact ? 'px-2' : ''">
      <USkeleton v-for="row in 4" :key="row" class="h-11 w-full" />
    </div>
    <p v-else-if="!players.length" class="text-sm text-dimmed" :class="compact ? 'px-2' : ''">{{ t('analytics.notFromSource', { source }) }}</p>
    <div v-else :class="compact ? '' : '@container'"><AnalyticsPlayers :players="compact ? players.slice(0, 10) : players" :selectable="selectable" :pending="pending" :missing="missing" @select="pick" /></div>
  </section>
</template>
