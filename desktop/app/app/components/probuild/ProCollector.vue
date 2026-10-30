<script setup lang="ts">
import type { Plan, Tiers } from '~/utils/high-elo'
import { estimate, maxCalls } from '~/utils/high-elo'
import { PLATFORMS } from '~/utils/riot-key'

/**
 * Where the data comes from: the collection of the ladder's best players'
 * recent games, started with the player's saved key. It says what it will cost
 * before it starts — the most calls, and the time those take at the pace the
 * key allows — and how far it is while it runs.
 */
const { t } = useT()
const { platform: savedPlatform, rememberPlatform, status, load } = useRiotKey()
const platform = computed({ get: () => savedPlatform.value, set: (value: string) => rememberPlatform(value) })
const { progress, error, standIn, start, stop, clear } = useHighElo()

onMounted(load)

const tiers = ref<Tiers>('challenger-grandmaster')
const players = ref(300)
const gamesPerPlayer = ref(10)

const tierItems = computed(() => [
  { label: t('probuild.tiers.challenger'), value: 'challenger' },
  { label: t('probuild.tiers.both'), value: 'challenger-grandmaster' },
])
const playerItems = [100, 300, 1000].map(value => ({ label: String(value), value }))
const gameItems = [5, 10, 20].map(value => ({ label: String(value), value }))
const platformItems = PLATFORMS.map(entry => ({ label: entry.label, value: entry.value }))

const plan = computed<Plan>(() => ({ platform: platform.value, tiers: tiers.value, players: players.value, gamesPerPlayer: gamesPerPlayer.value }))
const calls = computed(() => maxCalls(plan.value))
const wait = computed(() => estimate(calls.value, progress.value.gapMs))
const waitLabel = computed(() => (wait.value.hours > 0 ? t('probuild.time.hours', { hours: wait.value.hours, minutes: wait.value.minutes }) : t('probuild.time.minutes', { minutes: wait.value.minutes })))

const percent = computed(() => (progress.value.playersTotal > 0 ? Math.round((progress.value.playersDone / progress.value.playersTotal) * 100) : 0))
const phaseText = computed(() => t(`probuild.phase.${progress.value.phase || 'idle'}`))
const confirmClear = ref(false)

async function wipe() {
  await clear()
  confirmClear.value = false
}
</script>

<template>
  <section class="space-y-4 rounded-xl border border-default bg-default/40 p-5">
    <header class="flex flex-wrap items-center gap-3">
      <UIcon name="i-ph-database-light" class="size-5 text-primary" />
      <h2 class="text-sm font-semibold text-highlighted">{{ t('probuild.collect.title') }}</h2>
      <span class="ml-auto text-xs text-muted tabular-nums">{{ t('probuild.collect.stored', { matches: progress.matchesStored, rows: progress.rowsStored }) }}</span>
    </header>

    <div v-if="!status.saved && !standIn" class="flex flex-wrap items-center gap-3 rounded-lg bg-muted px-3 py-2.5">
      <p class="text-sm text-muted">{{ t('probuild.collect.noKey') }}</p>
      <UButton :label="t('probuild.collect.addKey')" to="/settings" icon="i-ph-key-light" size="xs" class="ml-auto" />
    </div>

    <template v-else>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label class="space-y-1">
          <span class="stat-label">{{ t('probuild.collect.server') }}</span>
          <USelectMenu v-model="platform" :items="platformItems" value-key="value" class="w-full" :disabled="progress.running" />
        </label>
        <label class="space-y-1">
          <span class="stat-label">{{ t('probuild.collect.tiers') }}</span>
          <USelectMenu v-model="tiers" :items="tierItems" value-key="value" class="w-full" :disabled="progress.running" />
        </label>
        <label class="space-y-1">
          <span class="stat-label">{{ t('probuild.collect.players') }}</span>
          <USelectMenu v-model="players" :items="playerItems" value-key="value" class="w-full" :disabled="progress.running" />
        </label>
        <label class="space-y-1">
          <span class="stat-label">{{ t('probuild.collect.games') }}</span>
          <USelectMenu v-model="gamesPerPlayer" :items="gameItems" value-key="value" class="w-full" :disabled="progress.running" />
        </label>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <UButton v-if="!progress.running" :label="t('probuild.collect.start')" icon="i-lucide-play" @click="start(plan)" />
        <UButton v-else :label="t('probuild.collect.stop')" icon="i-lucide-square" color="neutral" variant="soft" @click="stop()" />
        <p class="text-xs text-muted">{{ t('probuild.collect.estimate', { calls, time: waitLabel }) }}</p>
        <UButton v-if="progress.matchesStored > 0 && !progress.running && !confirmClear" :label="t('probuild.collect.clear')" icon="i-lucide-trash-2" size="xs" color="neutral" variant="ghost" class="ml-auto" @click="confirmClear = true" />
        <div v-if="confirmClear" class="ml-auto flex gap-2">
          <UButton :label="t('probuild.collect.clearConfirm')" size="xs" color="error" variant="soft" @click="wipe()" />
          <UButton :label="t('riotkey.cancel')" size="xs" color="neutral" variant="ghost" @click="confirmClear = false" />
        </div>
      </div>

      <div v-if="progress.running || progress.phase" class="space-y-1.5" aria-live="polite">
        <div class="flex items-baseline justify-between gap-3 text-xs">
          <span class="text-default">{{ phaseText }}</span>
          <span v-if="progress.playersTotal > 0" class="text-muted tabular-nums">{{ t('probuild.collect.players.progress', { done: progress.playersDone, total: progress.playersTotal }) }}</span>
        </div>
        <div class="h-1.5 overflow-hidden rounded-full bg-accented" role="progressbar" :aria-valuenow="percent" aria-valuemin="0" aria-valuemax="100">
          <div class="h-full rounded-full bg-primary transition-all" :style="{ width: `${percent}%` }" />
        </div>
      </div>

      <p v-if="error || progress.error" class="rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">{{ error ?? progress.error }}</p>
      <p class="text-xs text-dimmed">{{ t('probuild.collect.note') }}</p>
    </template>
  </section>
</template>
