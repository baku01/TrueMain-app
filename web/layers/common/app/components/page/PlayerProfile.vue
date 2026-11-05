<script setup lang="ts">
import type { MatchSummaryResponse } from '#shared/types/matches'
import type { ProfileRanked } from '#shared/types/profile'
import type { PersonaTag } from '#shared/types/players'
import { playerPath } from '#shared/utils/player-path'
import type { FormReference } from '#common/utils/match-form'
import { formTiles, RECENT_GAMES } from '#common/utils/match-form'
import { formatRank } from '#common/utils/tiers'
import type { AccountIdentity } from '#common/components/Account.vue'

const { t } = useT()

/**
 * A player's profile, one page on both apps: the site's `/truemains/{nameTag}`
 * and, in the desktop app, the dashboard (the player in the client) and any
 * other player's profile. Laid out on Blitz's profile: the art blurred and faint
 * behind the head of the page, the player's portrait with the level over its
 * edge, their name and standing beside it, the page's tabs under them (`#tabs`),
 * four form tiles read from the games on screen, then the match history with
 * a 308 px column of cards on its right.
 *
 * What differs between the hosts goes in slots — the header row (a breadcrumb
 * and filters on a profile, the dashboard's title and queue switch), the
 * history (TrueMain's paged list, or the client's), the column's cards (the
 * truemain score on the site, the Today card in the app) — and the banner's art is
 * resolved by the host: the champion a true main mains on a profile, the skin
 * the player chose in the client on the dashboard (TrueMain cannot read it).
 * The player is drawn by `Account`, at its profile-header size (#2027).
 */
const props = withDefaults(defineProps<{
  identity: AccountIdentity
  /** Data Dragon patch for the profile icon; null until the version list has loaded. */
  patch: string | null
  level?: number | null
  ranked?: ProfileRanked | null
  /** The champion the player truemains, named on the banner. */
  truemain?: { name: string, iconUrl: string | null } | null
  /** The known player this account belongs to (#2016), linking to all their accounts. */
  persona?: PersonaTag | null
  splashUrl?: string | null
  splashPosition?: string
  /** The games the form tiles read, newest first. */
  matches: MatchSummaryResponse[]
  /** The tier the tiles are set against (#2076), where the host knows it: the app's dashboard. */
  formReference?: FormReference | null
  loading?: boolean
  /** The cards column's width: wider where a card has a table to fit (a champion's matchups). */
  asideWidth?: string
}>(), {
  level: null,
  ranked: null,
  truemain: null,
  persona: null,
  splashUrl: null,
  splashPosition: '68% 22%',
  loading: false,
  asideWidth: '308px',
  formReference: null,
})

const tiles = computed(() => formTiles(props.matches, props.formReference))
const hint = computed(() => t('pages.profile.hint', { recent: RECENT_GAMES, count: props.matches.length }))

const rankLabel = computed(() => {
  const ranked = props.ranked
  return ranked ? formatRank(ranked.tier, ranked.division, { lp: ranked.leaguePoints }) : null
})
</script>

<template>
  <div class="relative isolate flex flex-col gap-5">
    <!-- Blitz's page backdrop: the art, blurred and faint, behind the head of
         the page, fading out from its top centre. -->
    <div
      v-if="splashUrl"
      class="pointer-events-none absolute inset-x-0 -top-5 -z-10 h-[35rem] overflow-hidden [mask-image:radial-gradient(80%_100%_at_50%_0%,black,transparent)]"
      aria-hidden="true"
    >
      <img
        :src="splashUrl"
        alt=""
        decoding="async"
        class="size-full scale-110 object-cover opacity-30 blur-[28px]"
        :style="{ objectPosition: splashPosition }"
      >
    </div>

    <slot name="header" />

    <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
      <Account
        :identity="identity"
        :patch="patch"
        size="xl"
        :to="false"
        class="min-w-0 flex-1"
        :ui="{
          avatar: 'size-16 rounded-xl shadow-lg ring-2 ring-default',
          subline: 'mt-1.5 flex-wrap gap-2 text-sm text-muted',
        }"
      >
        <template v-if="level !== null" #avatar-badge>
          <span class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[35%] rounded-full bg-default px-2 py-px text-[11px] font-semibold tabular-nums text-highlighted ring-1 ring-default">
            {{ level }}
          </span>
        </template>

        <template #name>
          <div class="flex min-w-0 items-center gap-2">
            <h1 class="truncate text-[22px] font-semibold leading-tight text-highlighted">
              {{ identity.gameName }}<span
                v-if="identity.tagLine"
                class="ml-1 font-medium text-muted"
              >#{{ identity.tagLine }}</span>
            </h1>
            <slot name="title-actions" />
          </div>
        </template>

        <template #subline>
          <template v-if="ranked && rankLabel">
            <RankIcon
              :tier="ranked.tier"
              :size="20"
            />
            <span class="font-semibold text-highlighted">{{ rankLabel }}</span>
          </template>
          <span v-else-if="level !== null">{{ t('pages.profile.level', { level }) }}</span>
          <template v-if="truemain">
            <span class="text-dimmed">·</span>
            <span class="flex items-center gap-1.5">
              {{ t('pages.profile.truemain') }}
              <SkeletonImage
                :src="truemain.iconUrl"
                :alt="truemain.name"
                width="20"
                height="20"
                class="size-5 rounded"
              />
              {{ truemain.name }}
            </span>
          </template>
          <template v-if="persona">
            <span class="text-dimmed">·</span>
            <ULink
              :to="playerPath(persona.slug)"
              class="flex items-center gap-1.5 font-semibold text-highlighted hover:text-primary"
            >
              <UIcon
                name="i-lucide-user-round"
                class="size-4"
              />
              {{ persona.displayName }}
              <span class="font-normal text-muted">· {{ t('pages.profile.allAccounts') }}</span>
            </ULink>
          </template>
        </template>
      </Account>

      <div
        v-if="$slots.actions"
        class="flex shrink-0 flex-wrap items-center gap-2"
      >
        <slot name="actions" />
      </div>
    </div>

    <nav
      v-if="$slots.tabs"
      class="-mt-1 flex gap-6 overflow-x-auto border-b border-default"
    >
      <slot name="tabs" />
    </nav>

    <!-- `on-art`: the tiles keep their dark glass in the light theme too. -->
    <div class="on-art grid grid-cols-2 gap-2 sm:grid-cols-4">
      <template v-if="loading && !matches.length">
        <USkeleton
          v-for="index in 4"
          :key="index"
          class="h-[86px] rounded-lg bg-ink-950/55"
        />
      </template>
      <KpiTile
        v-for="tile in tiles"
        v-else
        :key="tile.key"
        :label="tile.label"
        :value="tile.value"
        :delta="tile.delta"
        :hint="hint"
        :series="tile.series"
        :reference="tile.reference"
      />
    </div>

    <!-- The history, and the column of cards on its right; one column when
         narrow, the history first. -->
    <div
      class="grid grid-cols-1 items-start gap-x-4 gap-y-5 lg:grid-cols-[minmax(0,1fr)_var(--aside-width)]"
      :style="{ '--aside-width': asideWidth }"
    >
      <section class="flex min-w-0 flex-col gap-2">
        <slot name="history" />
      </section>
      <aside class="flex min-w-0 flex-col gap-4">
        <slot name="aside" />
      </aside>
    </div>
  </div>
</template>
