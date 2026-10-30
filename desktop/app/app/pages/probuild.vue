<script setup lang="ts">
import { formatCount } from '#shared/utils/counts'
import type { ProPlayer, ProRole } from '~/utils/pro-build'
import { PRO_ROLES, searchPros } from '~/utils/pro-build'
import { getActiveLocale } from '#common/utils/i18n'

/**
 * ProBuild: the builds professional players ran, a player at a time. The list
 * of players on the left, the picked player's games on the right, each with
 * its runes keystone, spells and items in the order they were completed. The
 * source is not connected yet — the page says so while it shows the sample.
 */
const { t } = useT()
const { data } = useProBuilds()
const { nameOf, portraitOf } = useChampionStatics()
const { items, summoners, runeTree } = useStaticData()

const query = ref('')
const role = ref<ProRole | null>(null)
const selectedId = ref<string | null>(null)

const shown = computed(() => searchPros(data.value.players, query.value, role.value))
const selected = computed<ProPlayer | null>(() => shown.value.find(player => player.id === selectedId.value) ?? shown.value[0] ?? null)

const ROLE_LABELS: Record<ProRole, string> = {
  TOP: 'probuild.role.top',
  JUNGLE: 'probuild.role.jungle',
  MIDDLE: 'probuild.role.middle',
  BOTTOM: 'probuild.role.bottom',
  UTILITY: 'probuild.role.utility',
}
const ROLE_ICONS: Record<ProRole, string> = {
  TOP: 'i-ph-shield-light',
  JUNGLE: 'i-ph-tree-light',
  MIDDLE: 'i-ph-magic-wand-light',
  BOTTOM: 'i-ph-crosshair-simple-light',
  UTILITY: 'i-ph-handshake-light',
}

const date = (iso: string) => new Intl.DateTimeFormat(getActiveLocale(), { day: 'numeric', month: 'short' }).format(new Date(iso))
const kda = (build: { kills: number, deaths: number, assists: number }) => `${build.kills} / ${build.deaths} / ${build.assists}`
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-4 p-5">
    <div class="flex shrink-0 items-center gap-3">
      <UIcon name="i-ph-trophy-light" class="size-6 text-primary" />
      <h1 class="text-2xl font-semibold tracking-tight text-highlighted">{{ t('probuild.title') }}</h1>
      <UBadge v-if="data.source === 'sample'" :label="t('probuild.sample')" color="warning" variant="subtle" size="sm" />
    </div>

    <p v-if="data.source === 'sample'" class="flex shrink-0 items-start gap-2 rounded-lg border border-default bg-elevated/60 px-3 py-2 text-xs text-muted">
      <UIcon name="i-lucide-info" class="mt-0.5 size-4 shrink-0" />{{ t('probuild.sampleNote') }}
    </p>

    <div class="surface grid min-h-0 flex-1 grid-cols-[17rem_minmax(0,1fr)] overflow-hidden rounded-xl">
      <aside class="flex min-h-0 flex-col border-r border-default bg-muted/50" :aria-label="t('probuild.players')">
        <div class="space-y-2 p-2.5">
          <UInput v-model="query" icon="i-lucide-search" size="sm" :placeholder="t('probuild.search')" class="w-full" :aria-label="t('probuild.search')" />
          <div class="flex flex-wrap gap-1" role="group" :aria-label="t('probuild.roles')">
            <UButton :label="t('probuild.allRoles')" size="xs" :color="role === null ? 'primary' : 'neutral'" :variant="role === null ? 'soft' : 'ghost'" @click="role = null" />
            <UButton
              v-for="entry in PRO_ROLES"
              :key="entry"
              :icon="ROLE_ICONS[entry]"
              size="xs"
              :color="role === entry ? 'primary' : 'neutral'"
              :variant="role === entry ? 'soft' : 'ghost'"
              :aria-label="t(ROLE_LABELS[entry])"
              :aria-pressed="role === entry"
              @click="role = entry"
            />
          </div>
        </div>
        <ul class="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
          <li v-for="player in shown" :key="player.id">
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 text-left transition hover:bg-elevated focus-visible:outline-2 focus-visible:outline-primary"
              :class="player.id === selected?.id ? '!border-primary/50 bg-elevated' : ''"
              :aria-current="player.id === selected?.id"
              @click="selectedId = player.id"
            >
              <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-accented text-muted"><UIcon :name="ROLE_ICONS[player.role]" class="size-5" /></span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium text-highlighted">{{ player.name }}</span>
                <span class="block truncate text-xs text-muted">{{ player.team }} · {{ player.region }}</span>
              </span>
              <span class="rounded-full bg-accented px-1.5 text-[11px] text-muted">{{ player.builds.length }}</span>
            </button>
          </li>
          <li v-if="shown.length === 0" class="px-2 py-6 text-center text-xs text-muted">{{ t('probuild.noPlayer') }}</li>
        </ul>
      </aside>

      <div class="min-h-0 space-y-4 overflow-y-auto p-5">
        <template v-if="selected">
          <header class="flex items-center gap-4 rounded-xl border border-default bg-gradient-to-br from-primary/10 via-elevated to-elevated p-4">
            <span class="grid size-14 shrink-0 place-items-center rounded-xl border border-default bg-muted text-primary"><UIcon :name="ROLE_ICONS[selected.role]" class="size-7" /></span>
            <div class="min-w-0">
              <h2 class="text-xl font-semibold tracking-tight text-highlighted">{{ selected.name }}</h2>
              <p class="mt-0.5 text-sm text-muted">{{ selected.team }} · {{ selected.region }} · {{ t(ROLE_LABELS[selected.role]) }}</p>
            </div>
          </header>

          <article v-for="build in selected.builds" :key="build.id" class="rounded-xl border border-default bg-default/40 p-4">
            <header class="flex flex-wrap items-center gap-3">
              <img v-if="portraitOf(build.championId)" :src="portraitOf(build.championId)!" alt="" width="48" height="48" class="img-skeleton size-12 rounded-lg ring-1 ring-default">
              <div class="min-w-0">
                <h3 class="text-base font-semibold text-highlighted">{{ nameOf(build.championId) }}</h3>
                <p class="text-xs text-muted">{{ t('probuild.patch', { version: build.patch }) }} · {{ date(build.playedAt) }}</p>
              </div>
              <UBadge class="ml-auto" :label="build.win ? t('probuild.win') : t('probuild.loss')" :color="build.win ? 'primary' : 'neutral'" variant="subtle" size="sm" />
              <span class="text-sm font-semibold tabular-nums text-default">{{ kda(build) }}</span>
            </header>

            <div class="mt-4 flex flex-wrap items-start gap-x-10 gap-y-4">
              <div>
                <h4 class="stat-label mb-1.5">{{ t('probuild.keystone') }}</h4>
                <GameTooltipPerkIcon :perk="runeTree?.perks[build.keystoneId] ?? null" :width="40" :height="40" class="size-10 rounded-full" />
              </div>
              <div>
                <h4 class="stat-label mb-1.5">{{ t('probuild.spells') }}</h4>
                <div class="flex gap-1.5">
                  <GameTooltipSummonerSpellIcon v-for="id in build.spellIds" :key="id" :spell="summoners[id] ?? null" :width="36" :height="36" class="size-9 rounded" />
                </div>
              </div>
              <div class="min-w-0">
                <h4 class="stat-label mb-1.5">{{ t('probuild.items') }}</h4>
                <ol class="flex flex-wrap items-center gap-1.5">
                  <li v-for="(id, index) in build.itemIds" :key="id" class="flex items-center gap-1.5">
                    <GameTooltipItemIcon :item="items[id] ?? null" :width="36" :height="36" class="size-9 rounded" />
                    <UIcon v-if="index < build.itemIds.length - 1" name="i-lucide-chevron-right" class="size-3.5 text-dimmed" />
                  </li>
                </ol>
                <p class="mt-1.5 text-[11px] text-dimmed">{{ t('probuild.itemsGold', { amount: formatCount(build.itemIds.reduce((sum, id) => sum + (items[id]?.totalGold ?? 0), 0)) }) }}</p>
              </div>
            </div>
          </article>
        </template>
        <p v-else class="py-10 text-center text-sm text-muted">{{ t('probuild.noPlayer') }}</p>
      </div>
    </div>
  </div>
</template>
