<script setup lang="ts">
/**
 * The app's navigation, a rail down the left as the genre's apps have it
 * (OP.GG Desktop, Blitz, Mobalytics): the sections grouped — champions
 * and builds — then, after a divider, the ones that exist only here,
 * champion select and the running game, and at the foot favorites and
 * settings. The gameflow phase still opens the live pages on its own
 * (`app.vue`); the rail is how the player gets everywhere else.
 *
 * The rail shows each section's icon and name; folded (the button at its
 * foot, kept across launches, or a window under 1280px) it keeps the icons,
 * each naming itself in a tooltip. The active section is lit by a bar on its
 * left edge. A live state is a dot on the icon, its word in the accessible name.
 */
const route = useRoute()
const { t } = useLocale()
const { screen } = useLcuState()

const isActive = (prefix: string) => route.path === prefix || route.path.startsWith(`${prefix}/`)

interface Tab {
  label: string
  icon: string
  to: string
  active: boolean
  /** The dot on the icon while the section's state is live, and the word it stands for. */
  lit?: { dot: string, label: string }
}

const live = computed(() => ({ dot: 'bg-primary', label: t('badge.live') }))

const groups = computed<{ label: string | null, tabs: Tab[] }[]>(() => [
  { label: null, tabs: [
    { label: t('nav.dashboard'), icon: 'i-game-icons-castle', to: '/', active: route.path === '/' },
  ] },
  { label: t('nav.group.champions'), tabs: [
    { label: t('nav.champions'), icon: 'i-game-icons-crossed-swords', to: '/champions', active: isActive('/champions') },
    { label: t('nav.tierlist'), icon: 'i-game-icons-podium', to: '/tierlist', active: isActive('/tierlist') },
    { label: t('nav.analytics'), icon: 'i-game-icons-histogram', to: '/analytics', active: isActive('/analytics') },
    { label: t('nav.classes'), icon: 'i-game-icons-visored-helm', to: '/classes', active: isActive('/classes') },
    { label: t('nav.matchup'), icon: 'i-game-icons-sword-clash', to: '/matchup', active: isActive('/matchup') },
  ] },
  { label: t('nav.group.builds'), tabs: [
    { label: t('nav.probuild'), icon: 'i-game-icons-laurels-trophy', to: '/probuild', active: isActive('/probuild') },
    { label: t('nav.kits'), icon: 'i-game-icons-knapsack', to: '/kits', active: isActive('/kits') },
    { label: t('nav.items'), icon: 'i-game-icons-potion-ball', to: '/items', active: isActive('/items') },
    { label: t('nav.patchnotes'), icon: 'i-game-icons-scroll-unfurled', to: '/patchnotes', active: isActive('/patchnotes') },
  ] },
  { label: t('nav.inGame'), tabs: [
    // Lit while the client is in champion select, wherever the player is; the
    // rest of the time the page is a draft to play by hand.
    { label: t('nav.champSelect'), icon: 'i-game-icons-rally-the-troops', to: '/draft', active: isActive('/draft'), lit: screen.value === 'draft' ? live.value : undefined },
    // Lit while a game runs, wherever the player is.
    { label: t('nav.game'), icon: 'i-game-icons-targeted', to: '/game', active: isActive('/game'), lit: screen.value === 'in-game' ? live.value : undefined },
    { label: t('nav.overlay'), icon: 'i-game-icons-eye-target', to: '/overlay', active: route.path === '/overlay' },
  ] },
])

const foot = computed<Tab[]>(() => [
  { label: t('nav.favorites'), icon: 'i-game-icons-star-formation', to: '/favorites', active: isActive('/favorites') },
  { label: t('nav.settings'), icon: 'i-game-icons-cog', to: '/settings', active: isActive('/settings') },
])

// Folded by the player (kept), or by a window too narrow for the names.
const FOLDED_KEY = 'truemain-rail-folded'
const folded = ref(localStorage.getItem(FOLDED_KEY) === '1')
watch(folded, value => localStorage.setItem(FOLDED_KEY, value ? '1' : '0'))
const narrowQuery = window.matchMedia('(max-width: 1279px)')
const narrow = ref(narrowQuery.matches)
const onWidth = (event: MediaQueryListEvent) => (narrow.value = event.matches)
narrowQuery.addEventListener('change', onWidth)
onScopeDispose(() => narrowQuery.removeEventListener('change', onWidth))
const compact = computed(() => folded.value || narrow.value)
</script>

<template>
  <nav class="flex flex-col border-r border-default bg-elevated transition-[width] duration-200" :class="compact ? 'w-14' : 'w-52'" :aria-label="t('nav.truemain')">
    <div class="min-h-0 flex-1 space-y-3 overflow-y-auto px-2 py-3 [scrollbar-width:none] [@media(max-height:800px)]:space-y-1.5 [@media(max-height:800px)]:py-2">
      <section v-for="(group, index) in groups" :key="index" :aria-label="group.label ?? undefined">
        <h2 v-if="group.label && !compact" class="truncate px-2.5 pb-1 stat-label">{{ group.label }}</h2>
        <hr v-else-if="group.label" class="mx-2 mb-2 border-default">
        <ul class="space-y-0.5">
          <li v-for="tab in group.tabs" :key="tab.to">
            <AppNavItem :tab="tab" :compact="compact" />
          </li>
        </ul>
      </section>
    </div>
    <div class="space-y-0.5 border-t border-default px-2 py-2">
      <AppNavItem v-for="tab in foot" :key="tab.to" :tab="tab" :compact="compact" />
      <button
        v-if="!narrow"
        type="button"
        class="rail-item w-full"
        :aria-label="compact ? t('nav.expand') : t('nav.collapse')"
        :title="compact ? t('nav.expand') : t('nav.collapse')"
        @click="folded = !folded"
      >
        <UIcon :name="compact ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'" class="size-[18px] shrink-0" />
        <span v-if="!compact" class="truncate">{{ t('nav.collapse') }}</span>
      </button>
    </div>
  </nav>
</template>
