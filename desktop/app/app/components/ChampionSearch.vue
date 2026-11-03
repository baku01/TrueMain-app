<script setup lang="ts">
import type { CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui'
import type { PlayerAccount } from '~/utils/blitz/player'
import { homeRegionOf, readPlayerAccount, splitRiotId } from '~/utils/blitz/player'

/**
 * The search behind ⌘K: every champion Data Dragon lists, opening its builds
 * — local, the list is already in memory for the draft — and, once the term
 * reads as a Riot ID (`Name#TAG`), the player Blitz knows by it, on the
 * region their games are played on. A player opens on the dashboard.
 */
const open = defineModel<boolean>('open', { default: false })

const { champions, portraitOf } = useChampionStatics()
const { t } = useT()
const router = useRouter()
const lastRegion = useState('player-region', () => 'br')

const term = ref('')
const players = shallowRef<{ region: string, account: PlayerAccount }[]>([])
const looking = ref(false)

let timer: ReturnType<typeof setTimeout> | undefined
let latest = 0
watch(term, (value) => {
  clearTimeout(timer)
  players.value = []
  const id = splitRiotId(value.trim())
  looking.value = Boolean(id)
  if (!id) return
  const asked = ++latest
  timer = setTimeout(async () => {
    const [account, home] = await Promise.all([
      readPlayerAccount(lastRegion.value, id.gameName, id.tagLine).catch(() => null),
      homeRegionOf(id.gameName, id.tagLine).catch(() => null),
    ])
    if (asked !== latest) return
    players.value = account ? [{ region: home ?? lastRegion.value, account }] : []
    looking.value = false
  }, 400)
})
watch(open, (value) => {
  if (!value) term.value = ''
})

const rankOf = (account: PlayerAccount) => {
  const solo = account.leagues.find(league => league.queue === 'RANKED_SOLO_5x5') ?? account.leagues[0]
  return solo ? `${solo.tier} ${solo.rank} · ${solo.leaguePoints} LP` : t('app.search.unranked')
}

function openPlayer(region: string, account: PlayerAccount) {
  open.value = false
  lastRegion.value = region
  void router.push({ path: '/', query: { riotId: `${account.gameName}#${account.tagLine}`, region } })
}

const groups = computed<CommandPaletteGroup<CommandPaletteItem>[]>(() => {
  const playerItems: CommandPaletteItem[] = players.value.map(({ region, account }) => ({
    id: `${region}:${account.puuid}`,
    label: `${account.gameName}#${account.tagLine}`,
    suffix: `${region.toUpperCase()} · ${rankOf(account)}`,
    icon: 'i-ph-user-circle-light',
    onSelect: () => openPlayer(region, account),
  }))
  if (!playerItems.length && term.value.trim()) {
    playerItems.push({
      id: 'player-hint',
      label: looking.value
        ? t('app.search.looking')
        : splitRiotId(term.value.trim()) ? t('app.search.noPlayer') : t('app.search.playerHint'),
      icon: looking.value ? 'i-lucide-loader-circle' : 'i-ph-user-circle-light',
      disabled: true,
    })
  }
  return [
    {
      id: 'champions',
      label: t('app.search.group'),
      items: [...champions.value.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(champion => ({
          id: champion.id,
          label: champion.name,
          avatar: { src: portraitOf(champion.id) ?? undefined, alt: champion.name },
          to: `/champions/${champion.id}`,
          onSelect: () => (open.value = false),
        })),
    },
    // Not filtered by the palette: the lookup already answered for the term.
    { id: 'players', label: t('app.search.players'), items: playerItems, ignoreFilter: true },
  ]
})
</script>

<template>
  <UModal v-model:open="open" :ui="{ content: 'max-w-lg' }">
    <template #content>
      <UCommandPalette
        v-model:search-term="term"
        :groups="groups"
        :placeholder="t('app.search.placeholder')"
        class="h-96"
        close
        @update:open="open = $event"
      />
    </template>
  </UModal>
</template>
