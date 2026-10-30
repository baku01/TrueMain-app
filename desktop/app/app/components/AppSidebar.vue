<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

/**
 * The app's navigation, down the left edge: every section the site has, then
 * the ones that exist only here — champion select and the running game — and
 * the player at the foot. The gameflow phase still opens those two on its own
 * (`app.vue`); this is how the player gets everywhere else.
 *
 * In a narrow window (`useNarrowWindow`), or when the player folds it from the
 * top bar (`useSidebar`), it becomes a rail of icons: each
 * entry's name in a tooltip, and the "Live" / "Rec" badges as dots on their
 * icons, their words in the tooltip.
 */
const route = useRoute()
const { t } = useLocale()
const { collapsed: narrow } = useSidebar()
const { screen } = useLcuState()
const { status: recording } = useRecordings()
// A downloaded update stays one click away after its toast is gone.
const { readyVersion: updateVersion, installing: updating, stalled: updateStalled, restart: restartToUpdate } = useAppUpdate()

const isActive = (prefix: string) => route.path === prefix || route.path.startsWith(`${prefix}/`)

const LIVE = computed(() => ({ label: t('badge.live'), color: 'primary', variant: 'subtle', size: 'sm' }) as const)
const REC = computed(() => ({ label: t('badge.rec'), color: 'error', variant: 'subtle', size: 'sm' }) as const)

/** An entry lit by `badge`: the badge itself in full, a dot on the icon in the rail. */
function lit(label: string, badge: typeof LIVE.value | typeof REC.value, on: boolean): Partial<NavigationMenuItem> {
  if (!on) return {}
  if (!narrow.value) return { badge }
  return { chip: { color: badge.color }, tooltip: { text: `${label} · ${badge.label}` } }
}

const items = computed<NavigationMenuItem[][]>(() => [
  [
    { label: t('nav.truemain'), type: 'label' },
    { label: t('nav.dashboard'), icon: 'i-ph-castle-turret-light', to: '/', active: route.path === '/' },
    { label: t('nav.champions'), icon: 'i-ph-sword-light', to: '/champions', active: isActive('/champions') },
    { label: t('nav.classes'), icon: 'i-ph-tree-structure-light', to: '/classes', active: isActive('/classes') },
    { label: t('nav.tierlist'), icon: 'i-ph-ranking-light', to: '/tierlist', active: isActive('/tierlist') },
    { label: t('nav.matchup'), icon: 'i-ph-scales-light', to: '/matchup', active: isActive('/matchup') },
    { label: t('nav.probuild'), icon: 'i-ph-trophy-light', to: '/probuild', active: isActive('/probuild') },
    { label: t('nav.kits'), icon: 'i-ph-backpack-light', to: '/kits', active: isActive('/kits') },
    { label: t('nav.items'), icon: 'i-ph-flask-light', to: '/items', active: isActive('/items') },
    { label: t('nav.patchnotes'), icon: 'i-ph-scroll-light', to: '/patchnotes', active: isActive('/patchnotes') },
    { label: t('nav.favorites'), icon: 'i-ph-star-four-light', to: '/favorites', active: isActive('/favorites') },
  ],
  [
    { label: t('nav.inGame'), type: 'label' },
    {
      label: t('nav.champSelect'),
      icon: 'i-ph-users-three-light',
      to: '/draft',
      active: isActive('/draft'),
      // Lit while the client is in champion select, wherever the player is;
      // the rest of the time the page is a draft to play by hand.
      ...lit(t('nav.champSelect'), LIVE.value, screen.value === 'draft'),
    },
    {
      label: t('nav.game'),
      icon: 'i-ph-crosshair-simple-light',
      to: '/game',
      active: isActive('/game'),
      // Lit while a game runs, wherever the player is.
      ...lit(t('nav.game'), LIVE.value, screen.value === 'in-game'),
    },
    { label: t('nav.overlay'), icon: 'i-ph-eye-light', to: '/overlay', active: route.path === '/overlay' },
    // Only once the shell has answered for recording: a build without it has no page to open.
    ...(recording.value
      ? [{
          label: t('nav.recordings'),
          icon: 'i-ph-film-reel-light',
          to: '/recordings',
          active: isActive('/recordings'),
          // Lit while a game is being recorded, wherever the player is.
          ...lit(t('nav.recordings'), REC.value, recording.value.recordingGameId !== null),
        }]
      : []),
  ],
])

const version = ref<string | null>(null)
onMounted(async () => {
  if (!insideTauri()) return
  const { getVersion } = await import('@tauri-apps/api/app')
  version.value = await getVersion()
})
</script>

<template>
  <aside class="flex h-full flex-col">
    <div v-if="narrow" class="flex flex-col items-center gap-3 pb-4 pt-5">
      <NuxtLink to="/" :aria-label="t('nav.dashboard')">
        <AppMark class="size-7" />
      </NuxtLink>
      <UTooltip v-if="updateVersion" :text="t('sidebar.update', { version: updateVersion })">
        <UButton
          icon="i-lucide-download"
          size="xs"
          variant="soft"
          :aria-label="t('sidebar.update', { version: updateVersion })"
          :loading="updating && !updateStalled"
          @click="restartToUpdate"
        />
      </UTooltip>
    </div>
    <div v-else class="flex flex-col items-start px-5 pb-6 pt-5">
      <NuxtLink to="/" :aria-label="t('nav.dashboard')">
        <AppWordmark class="text-xl" />
      </NuxtLink>
      <span class="ml-7 stat-label">{{ version ? t('sidebar.appVersion', { version }) : t('sidebar.companion') }}</span>
      <UButton
        v-if="updateVersion"
        :label="t('sidebar.update', { version: updateVersion })"
        icon="i-lucide-download"
        size="xs"
        variant="soft"
        class="ml-6 mt-2"
        :loading="updating && !updateStalled"
        @click="restartToUpdate"
      />
    </div>

    <UNavigationMenu
      :items="items"
      orientation="vertical"
      :collapsed="narrow"
      tooltip
      highlight
      class="min-h-0 flex-1 overflow-y-auto"
      :class="narrow ? 'px-2' : 'px-3'"
      :ui="{
        label: 'mt-3 px-2.5 pb-1.5 stat-label text-[10px]!',
        link: ['rounded-lg py-2 text-[13px] text-muted transition-colors hover:bg-elevated/60 hover:text-highlighted data-active:bg-primary/10 data-active:text-highlighted', narrow ? 'justify-center px-0' : 'px-2.5'],
        linkLeadingIcon: 'size-5 transition-colors group-data-[active]:text-primary',
        separator: narrow ? 'my-2' : 'hidden',
      }"
    />

    <AppPlayerCard :compact="narrow" :class="narrow ? 'mx-auto mb-3' : 'm-3'" />
  </aside>
</template>
