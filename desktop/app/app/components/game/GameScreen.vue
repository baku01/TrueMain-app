<script setup lang="ts">
import type { ClockSync } from '~/composables/useGameClock'
import { useGameClock } from '~/composables/useGameClock'
import { getPositionIconUrl } from '#shared/utils/ddragon'
import { isChampionPosition, positionLabel } from '#common/utils/positions'
import { formatDuration } from '#common/utils/relativeTime'
import type { GamePlayer, GameState, GameTeam } from '~/types/game'
import type { LoadingPlayer } from '~/types/loading'
import { laneRows, leftTeam } from '~/utils/item-value'
import { loadingLineOf } from '~/utils/player-intel'
import { premades } from '~/utils/premade'

/**
 * The running game, read through its own API (#1748): the ten players, lane
 * by lane, ours on the left and theirs mirrored on the right, each with their
 * level and summoner spells, and who they are — standing, role, form on the
 * champion, streak — from what the loading screen read through the client
 * (#1828), and between them the side the lane favours (#1863). Items and
 * K/D/A are the game's own scoreboard's. The strip over it
 * carries the map, the kills of each side and the game clock.
 *
 * This is the frame the in-game panels of #1747 land in: over the board, the
 * next item to complete (#1751) when we are a player rather than spectating.
 */
const props = defineProps<{
  game: GameState
  /** The latest game time and when it was read (`useLiveGame`). */
  sync: ClockSync
  /** The loading screen's players (`useLoadingPlayers`); empty until the roster is read. */
  lines?: LoadingPlayer[]
  /** The shard the game is played on (`LoadingView.platformId`), for the players' mastery. */
  platformId?: string
}>()

// ─── The clock ──────────────────────────────────────────────────────────────

// Set right on every reading (`useGameClock`). Handed to a player only while
// they are dead, for the respawn countdown: the others' rows do not redraw on
// every tick.
const clock = useGameClock(() => props.sync)

const { t } = useT()
const MAPS: Record<number, string> = { 11: t('game.map.rift'), 12: t('game.map.abyss'), 30: t('game.map.arena') }
const mapName = computed(() => MAPS[props.game.mapNumber] ?? t('game.map.live'))

// ─── The board ──────────────────────────────────────────────────────────────

/** Ours on the left. Spectating, blue side is. */
const left = computed<GameTeam>(() => leftTeam(props.game))
const right = computed<GameTeam>(() => (left.value === 'ORDER' ? 'CHAOS' : 'ORDER'))

const { champions } = useChampionStatics()
/** Data Dragon ids by alias, without case, as `GamePlayerSide` reads them. */
const idOfAlias = computed(() => new Map([...champions.value.values()].map(champion => [champion.alias.toLowerCase(), champion.id])))
const lineOf = (player: GamePlayer | null) =>
  player ? loadingLineOf(player, props.lines ?? [], alias => idOfAlias.value.get(alias.toLowerCase())) : null
const reading = computed(() => (props.lines?.length ?? 0) > 0)
/** Each lane's edge, by position (#1863). */
const edges = useLaneEdges(() => props.lines ?? [])
/** Who queued together, and each player's mastery on their champion — Blitz's game page's cards. */
const groups = computed(() => premades(props.lines ?? []))
const masteries = useGameMasteries(() => props.lines ?? [], () => props.platformId ?? '')
const premadeOf = (line: LoadingPlayer | null) => (line?.riotId ? groups.value.get(line.riotId) ?? null : null)
const masteryOf = (line: LoadingPlayer | null) => (line?.riotId ? masteries.value.get(line.riotId) ?? null : null)
/** Each side's picks, for the teams' damage split. */
const picksOf = (team: GameTeam) => props.game.players.filter(player => player.team === team).map(player => ({ championId: idOfAlias.value.get(player.champion.toLowerCase()) ?? 0, position: player.position || null })).filter(pick => pick.championId > 0)
const me = computed(() => props.game.players.find(player => player.isMe) ?? null)

/** Lane by lane, so each row is a lane's face-off (`utils/item-value.ts`, shared with the overlay). */
const rows = computed(() => {
  return laneRows(props.game).map(({ ally, enemy }) => {
    const lane = [ally?.position, enemy?.position].find(isChampionPosition) ?? null
    return {
      ally,
      enemy,
      allyLine: lineOf(ally),
      enemyLine: lineOf(enemy),
      lane,
      key: `${ally?.riotId}-${enemy?.riotId}`,
    }
  })
})

const kills = (team: GameTeam) => props.game.players.filter(player => player.team === team).reduce((sum, player: GamePlayer) => sum + player.kills, 0)

const sideLabel = (team: GameTeam, ours: boolean) => {
  if (props.game.myTeam) return ours ? t('game.side.yours') : t('game.side.enemy')
  return team === 'ORDER' ? t('game.side.blue') : t('game.side.red')
}
</script>

<template>
  <div class="flex h-full flex-col gap-3 overflow-y-auto px-4 pb-4 pt-3">
    <header class="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
      <div class="flex items-center gap-2.5">
        <span class="relative flex size-2.5 items-center justify-center">
          <span class="absolute inline-flex size-full animate-tm-pulse rounded-full bg-primary" />
          <span class="relative inline-flex size-1.5 rounded-full bg-primary" />
        </span>
        <span class="stat-label">{{ mapName }}</span>
      </div>

      <div class="flex items-baseline gap-3" :title="t('game.killsTitle', { left: sideLabel(left, true).toLowerCase(), leftKills: kills(left), right: sideLabel(right, false).toLowerCase(), rightKills: kills(right) })">
        <span class="stat-value text-2xl leading-none text-ally">{{ kills(left) }}</span>
        <UIcon name="i-lucide-swords" class="size-4 self-center text-dimmed" />
        <span class="stat-value text-2xl leading-none text-enemy">{{ kills(right) }}</span>
      </div>

      <div class="flex items-center gap-3 justify-self-end">
        <span class="stat-value text-xl leading-none tabular-nums" :title="t('game.gameTime')">{{ formatDuration(clock) }}</span>
        <slot name="actions" />
      </div>
    </header>

    <!-- Each team's damage split, as Blitz's game page leads with it. -->
    <DraftTeamDamageMeter :allies="picksOf(left)" :enemies="picksOf(right)" class="surface rounded-xl px-4 py-3" :aria-label="t('game.team.damage')" />

    <GameNextItem v-if="game.myTeam" :game="game" />
    <GameSkillOrder v-if="me" :player="me" :champion-id="idOfAlias.get(me.champion.toLowerCase()) ?? null" />

    <section class="surface overflow-hidden rounded-xl">
      <div class="grid grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)] items-center gap-3 border-b border-default px-4 py-2">
        <div class="flex items-center gap-2">
          <span class="h-3 w-0.5 rounded-full bg-ally/70" />
          <span class="stat-label">{{ sideLabel(left, true) }}</span>
        </div>
        <span />
        <div class="flex items-center justify-end gap-2">
          <span class="stat-label">{{ sideLabel(right, false) }}</span>
          <span class="h-3 w-0.5 rounded-full bg-enemy/70" />
        </div>
      </div>

      <ul class="divide-y divide-default">
        <li
          v-for="row in rows"
          :key="row.key"
          class="grid min-h-[5.75rem] grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)] items-center gap-3 px-4 py-2.5"
        >
          <GamePlayerSide
            :player="row.ally"
            :clock="row.ally?.dead ? clock : 0"
            :line="row.allyLine"
            :reading="reading"
            :premade="premadeOf(row.allyLine)"
            :mastery="masteryOf(row.allyLine)"
            class="-mx-2 rounded-lg px-2 py-1.5"
            :class="row.ally?.isMe && 'bg-primary/5 ring-1 ring-primary/15'"
          />
          <div class="flex flex-col items-center gap-1.5">
            <img v-if="row.lane" :src="getPositionIconUrl(row.lane)" :alt="positionLabel(row.lane, { short: true })" :title="positionLabel(row.lane, { short: true })" class="size-4 opacity-60">
            <GameLaneEdge v-if="row.lane" :edge="edges.get(row.lane)" />
          </div>
          <GamePlayerSide
            :player="row.enemy"
            :clock="row.enemy?.dead ? clock : 0"
            :line="row.enemyLine"
            :reading="reading"
            :premade="premadeOf(row.enemyLine)"
            :mastery="masteryOf(row.enemyLine)"
            mirrored
            class="-mx-2 rounded-lg px-2 py-1.5"
          />
        </li>
      </ul>
    </section>
  </div>
</template>
