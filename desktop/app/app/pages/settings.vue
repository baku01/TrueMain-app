<script setup lang="ts">
import type { KeyCheckState } from '~/utils/riot-key'
import { PLATFORMS, keyKind, perMinute, sustainedPerMinute, windowLabel } from '~/utils/riot-key'

/**
 * Settings — the player's Riot API key: typed here, kept by the shell in the
 * system's credential store, checked against Riot, and the limits Riot answers
 * with shown as what the key may do. Then hardware acceleration
 * (`SettingsGraphics`).
 */
const { t } = useT()
const { status, check, busy, error, platform, standIn, rememberPlatform, load, save, verify, clear } = useRiotKey()

const typed = ref('')
const show = ref(false)
const confirmClear = ref(false)

onMounted(load)

const STATE_TEXT: Record<KeyCheckState, { label: string, hint: string, color: 'success' | 'error' | 'warning' | 'neutral' }> = {
  'valid': { label: 'riotkey.state.valid', hint: 'riotkey.hint.valid', color: 'success' },
  'invalid': { label: 'riotkey.state.invalid', hint: 'riotkey.hint.invalid', color: 'error' },
  'forbidden': { label: 'riotkey.state.forbidden', hint: 'riotkey.hint.forbidden', color: 'error' },
  'rate-limited': { label: 'riotkey.state.rateLimited', hint: 'riotkey.hint.rateLimited', color: 'warning' },
  'offline': { label: 'riotkey.state.offline', hint: 'riotkey.hint.offline', color: 'neutral' },
  'error': { label: 'riotkey.state.error', hint: 'riotkey.hint.error', color: 'warning' },
}

const platformItems = PLATFORMS.map(entry => ({ label: entry.label, value: entry.value }))
const platformModel = computed({ get: () => platform.value, set: (value: string) => rememberPlatform(value) })

const kind = computed(() => (check.value ? keyKind(check.value.appLimits) : null))
const sustained = computed(() => (check.value ? sustainedPerMinute(check.value.appLimits) : null))
const looksLikeKey = computed(() => /^RGAPI-[A-Za-z0-9-]{14,}$/.test(typed.value.trim()))

async function submit() {
  if (!looksLikeKey.value || busy.value) return
  await save(typed.value.trim())
  if (check.value && ['valid', 'rate-limited', 'offline'].includes(check.value.state)) typed.value = ''
}

async function remove() {
  await clear()
  confirmClear.value = false
}

const usedPercent = (used: number | null, limit: number) => (used === null ? 0 : Math.min(100, Math.round((used / limit) * 100)))
</script>

<template>
  <SharedPage :eyebrow="t('riotkey.eyebrow')" :title="t('riotkey.title')">
    <div class="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <PageHeader :eyebrow="t('riotkey.eyebrow')" :title="t('riotkey.title')" :description="t('riotkey.description')" />

      <p v-if="standIn" class="flex items-start gap-2 rounded-lg border border-default bg-elevated/60 px-3 py-2 text-xs text-muted">
        <UIcon name="i-lucide-info" class="mt-0.5 size-4 shrink-0" />{{ t('riotkey.standIn') }}
      </p>

      <section class="space-y-4 rounded-xl border border-default bg-default/40 p-5">
        <header class="flex items-center gap-2">
          <UIcon name="i-ph-key-light" class="size-5 text-primary" />
          <h2 class="text-sm font-semibold text-highlighted">{{ t('riotkey.key') }}</h2>
          <UBadge v-if="status.saved" :label="t('riotkey.saved')" color="success" variant="subtle" size="sm" />
        </header>

        <div v-if="status.saved" class="flex flex-wrap items-center gap-3 rounded-lg bg-muted px-3 py-2.5">
          <code class="font-mono text-sm text-default">{{ status.masked }}</code>
          <div class="ml-auto flex gap-2">
            <UButton :label="t('riotkey.verify')" icon="i-lucide-refresh-cw" size="xs" color="neutral" variant="soft" :loading="busy" @click="verify()" />
            <UButton v-if="!confirmClear" :label="t('riotkey.remove')" icon="i-lucide-trash-2" size="xs" color="neutral" variant="ghost" @click="confirmClear = true" />
            <template v-else>
              <UButton :label="t('riotkey.removeConfirm')" size="xs" color="error" variant="soft" :loading="busy" @click="remove()" />
              <UButton :label="t('riotkey.cancel')" size="xs" color="neutral" variant="ghost" @click="confirmClear = false" />
            </template>
          </div>
        </div>

        <form class="space-y-3" @submit.prevent="submit">
          <label class="block text-xs font-medium text-muted" for="riot-key-input">{{ status.saved ? t('riotkey.replace') : t('riotkey.paste') }}</label>
          <div class="flex gap-2">
            <UInput
              id="riot-key-input"
              v-model="typed"
              :type="show ? 'text' : 'password'"
              placeholder="RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              autocomplete="off"
              spellcheck="false"
              class="flex-1"
              :ui="{ base: 'font-mono' }"
            />
            <UButton :icon="show ? 'i-lucide-eye-off' : 'i-lucide-eye'" color="neutral" variant="ghost" :aria-label="show ? t('riotkey.hide') : t('riotkey.show')" @click="show = !show" />
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <USelectMenu v-model="platformModel" :items="platformItems" value-key="value" class="w-60" :aria-label="t('riotkey.platform')" />
            <UButton type="submit" :label="t('riotkey.save')" icon="i-lucide-shield-check" :loading="busy" :disabled="!looksLikeKey" />
          </div>
          <p class="text-xs text-dimmed">{{ t('riotkey.where') }}</p>
        </form>

        <p v-if="error" class="rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">{{ error }}</p>
      </section>

      <section v-if="check" class="space-y-5 rounded-xl border border-default bg-default/40 p-5" aria-live="polite">
        <header class="flex flex-wrap items-center gap-3">
          <UBadge :label="t(STATE_TEXT[check.state].label)" :color="STATE_TEXT[check.state].color" variant="subtle" />
          <span class="text-sm text-muted">{{ t(STATE_TEXT[check.state].hint) }}</span>
          <span v-if="check.retryAfter" class="text-xs text-dimmed">{{ t('riotkey.retry', { seconds: check.retryAfter }) }}</span>
        </header>

        <template v-if="check.appLimits.length">
          <div class="grid gap-3 sm:grid-cols-3">
            <div class="rounded-lg bg-muted px-3 py-2.5">
              <p class="stat-label">{{ t('riotkey.sustained') }}</p>
              <p class="mt-1 text-xl font-semibold tabular-nums text-highlighted">{{ sustained }}<span class="ml-1 text-xs font-normal text-muted">{{ t('riotkey.perMinute') }}</span></p>
            </div>
            <div class="rounded-lg bg-muted px-3 py-2.5 sm:col-span-2">
              <p class="stat-label">{{ t('riotkey.kind') }}</p>
              <p class="mt-1 text-sm text-default">{{ kind === 'production' ? t('riotkey.kind.production') : t('riotkey.kind.personal') }}</p>
            </div>
          </div>

          <div>
            <h3 class="stat-label mb-2">{{ t('riotkey.appLimits') }} · <span class="normal-case tracking-normal">{{ check.platform }}</span></h3>
            <ul class="space-y-2">
              <li v-for="window in check.appLimits" :key="window.seconds" class="rounded-lg border border-default px-3 py-2.5">
                <div class="flex items-baseline justify-between gap-3 text-sm">
                  <span class="text-default"><span class="font-semibold tabular-nums text-highlighted">{{ window.limit }}</span> {{ t('riotkey.requestsEvery') }} {{ windowLabel(window.seconds) }}</span>
                  <span class="text-xs text-muted tabular-nums">≈ {{ perMinute(window) }} {{ t('riotkey.perMinute') }}</span>
                </div>
                <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-accented" role="progressbar" :aria-valuenow="window.used ?? 0" :aria-valuemax="window.limit">
                  <div class="h-full rounded-full bg-primary transition-all" :style="{ width: `${usedPercent(window.used, window.limit)}%` }" />
                </div>
                <p class="mt-1 text-[11px] text-dimmed">{{ t('riotkey.used', { used: window.used ?? 0, limit: window.limit }) }}</p>
              </li>
            </ul>
            <p class="mt-2 text-xs text-dimmed">{{ t('riotkey.perRegion') }}</p>
          </div>

          <div v-if="check.methodLimits.length">
            <h3 class="stat-label mb-2">{{ t('riotkey.methodLimits') }}</h3>
            <ul class="space-y-1 text-sm text-muted">
              <li v-for="window in check.methodLimits" :key="window.seconds">
                <span class="font-semibold tabular-nums text-default">{{ window.limit }}</span> {{ t('riotkey.requestsEvery') }} {{ windowLabel(window.seconds) }}
              </li>
            </ul>
          </div>
        </template>
      </section>

      <SettingsGraphics />
    </div>
  </SharedPage>
</template>
