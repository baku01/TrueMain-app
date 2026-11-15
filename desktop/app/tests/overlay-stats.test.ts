import { mount } from '@vue/test-utils'
import { tr } from '#common/utils/i18n'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { GameState } from '../app/types/game'
import OverlayStats from '../app/components/overlay/OverlayStats.vue'
import { sampleGame } from '../app/utils/overlay-sample'

// The panel outside Nuxt: its auto-imports stubbed as globals.
const global = { stubs: { UIcon: true } }
const NOW = 1_000_000

/** Ten minutes in, `creepScore` now, a sample at each whole minute at 7 CS a minute (63 at the ninth). */
function game(creepScore: number, gameTime = 600): GameState {
  const base = sampleGame()
  return {
    ...base,
    gameTime,
    players: base.players.map(player => (player.isMe ? { ...player, creepScore } : player)),
    pace: { samples: Array.from({ length: 10 }, (_, index) => ({ minute: index + 1, cs: (index + 1) * 7, gold: (index + 1) * 400 })) },
  }
}

const figure = (wrapper: ReturnType<typeof mount>) => wrapper.get('.stat-value').text()

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  for (const [name, value] of Object.entries({ ref, computed, shallowRef, watch, onMounted, onBeforeUnmount })) vi.stubGlobal(name, value)
  vi.stubGlobal('useT', () => ({ t: tr }))
  vi.stubGlobal('useId', () => 'test')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('OverlayStats', () => {
  it('reads CS a minute live: our creep score over the clock, rising at a last hit with a "+1"', async () => {
    const wrapper = mount(OverlayStats, { props: { game: game(80), sync: { gameTime: 600, at: NOW } }, global })
    expect(figure(wrapper)).toBe('8.0')
    expect(wrapper.find('.pace-gain').exists()).toBe(false)
    await wrapper.setProps({ game: game(83), sync: { gameTime: 600, at: NOW } })
    expect(figure(wrapper)).toBe('8.3')
    expect(wrapper.get('.pace-gain').text()).toBe('+3')
    vi.advanceTimersByTime(1000)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.pace-gain').exists()).toBe(false)
  })

  it('sinks while the farm waits, the clock running on between readings', async () => {
    const wrapper = mount(OverlayStats, { props: { game: game(80), sync: { gameTime: 600, at: NOW - 2000 } }, global })
    // 2 s past the reading: 80 CS over 10:02.
    vi.advanceTimersByTime(250)
    await wrapper.vm.$nextTick()
    expect(Number(figure(wrapper))).toBeCloseTo(80 / (602.25 / 60), 1)
  })

  it('says the last minute\'s pace against the whole game\'s', () => {
    // At 10:00, the ninth minute's sample (63 CS): 17 CS over the last minute.
    const wrapper = mount(OverlayStats, { props: { game: game(80), sync: { gameTime: 600, at: NOW } }, global })
    expect(wrapper.text()).toContain('17.0')
  })
})
