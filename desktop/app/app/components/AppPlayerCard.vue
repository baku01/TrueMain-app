<script setup lang="ts">
import type { GameflowPhase } from '~/types/lcu'
import type { AccountIdentity } from '#common/components/Account.vue'
import { riotIdLabel } from '#shared/utils/truemain-path'

/**
 * The player, at the right of the top bar: who the client is logged in as, and
 * where it is in the gameflow. With no client it says it is waiting for one —
 * the rest of the app works without it. Drawn by the site's `Account` (#2027),
 * the status dot on the picture's corner and the client's status under the
 * name; in a bar too narrow for the words, the picture alone, the words in a
 * tooltip.
 */
const { state } = useLcuState()
const { patch } = useChampionStatics()
const { t } = useT()

const identity = computed<AccountIdentity>(() => {
  if (!state.value.connected) return { gameName: t('app.leagueClient'), tagLine: null }
  const [gameName, tagLine] = state.value.riotId?.split('#') ?? []
  return { gameName: gameName ?? t('app.loggingIn'), tagLine: tagLine ?? null, profileIconId: state.value.profileIconId }
})

/** The client's phase in the player's words. `live` phases pulse. */
const STATUS: Partial<Record<GameflowPhase, { label: string, live?: boolean }>> = {
  Lobby: { label: 'app.status.lobby' },
  Matchmaking: { label: 'app.status.queue', live: true },
  ReadyCheck: { label: 'app.status.matchFound', live: true },
  ChampSelect: { label: 'app.status.champSelect', live: true },
  InProgress: { label: 'app.status.inGame', live: true },
  Reconnect: { label: 'app.status.reconnecting', live: true },
  WaitingForStats: { label: 'app.status.postGame' },
  PreEndOfGame: { label: 'app.status.postGame' },
  EndOfGame: { label: 'app.status.postGame' },
}
const status = computed(() => {
  if (!state.value.connected) return { label: t('app.status.clientOff'), live: false }
  const known = STATUS[state.value.phase]
  return known ? { ...known, label: t(known.label) } : { label: t('app.status.online') }
})
const dot = computed(() => (!state.value.connected ? 'bg-ink-400' : status.value.live ? 'bg-primary' : 'bg-success'))
const title = computed(() => riotIdLabel(identity.value.gameName, identity.value.tagLine))
</script>

<template>
  <UTooltip :text="`${title} · ${status.label}`" :content="{ side: 'bottom' }">
    <div class="flex h-9 min-w-0 items-center rounded-lg px-1.5 transition-colors hover:bg-accented/60">
      <Account :identity="identity" :patch="patch || null" size="sm" :to="false" class="min-w-0" :ui="{ body: 'min-w-0 @max-4xl:sr-only', tag: 'hidden' }">
        <template #avatar-badge>
          <span class="absolute -bottom-0.5 -right-0.5 flex size-2.5">
            <span v-if="status.live" class="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
            <span class="relative inline-flex size-2.5 rounded-full border-2 border-(--ui-bg-elevated)" :class="dot" />
          </span>
        </template>
        <template #subline>
          <span class="block truncate text-[11px] leading-tight text-muted">{{ status.label }}</span>
        </template>
      </Account>
    </div>
  </UTooltip>
</template>
