import { mount } from '@vue/test-utils'
import { tr } from '#common/utils/i18n'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { DraftOptional } from '../app/utils/jev-optionals'
import JevDraftOptionals from '../app/components/jev/JevDraftOptionals.vue'

const global = {
  stubs: {
    GameTooltipItemIcon: { props: ['item'], template: '<i class="icon" :data-item="item?.id" />' },
    UIcon: { template: '<i class="knight" />' },
    UBadge: { props: ['label'], template: '<b class="badge">{{ label }}</b>' },
  },
}

beforeEach(() => {
  vi.stubGlobal('useT', () => ({ t: tr }))
  vi.stubGlobal('useChampionStatics', () => ({ nameOf: (id: number) => ({ 245: 'Ekko', 34: 'Anivia' })[id] ?? String(id), portraitOf: (id: number) => `/portrait/${id}.png` }))
  vi.stubGlobal('useStaticData', () => ({ items: ref({ 3111: { id: 3111 }, 3156: { id: 3156 } }) }))
})
afterEach(() => vi.unstubAllGlobals())

const optionals: DraftOptional[] = [
  { need: 'magic', call: 1, dueBy: 3, enemies: [245, 34], items: [{ id: 3111, value: 1, games: 18455, winRate: 0.502, inBuild: false }, { id: 3156, value: 1, games: 11181, winRate: 0.517, inBuild: true }] },
  { need: 'cc', call: 0.52, dueBy: null, enemies: [34], items: [{ id: 3111, value: 0.5, games: 18455, winRate: 0.502, inBuild: false }] },
]

describe('JevDraftOptionals', () => {
  it('shows each need with how much the draft calls for it, when it is due, the enemies behind it and the items that answer it', () => {
    const wrapper = mount(JevDraftOptionals, { props: { optionals }, global })
    const rows = wrapper.findAll('[data-need]')
    expect(rows.map(row => row.attributes('data-need'))).toEqual(['magic', 'cc'])
    expect(rows[0]!.text()).toContain('100%')
    expect(rows[0]!.find('.badge').exists()).toBe(true)
    expect(rows[1]!.find('.badge').exists()).toBe(false)
    expect(rows[0]!.findAll('img').map(img => img.attributes('alt'))).toEqual(['Ekko', 'Anivia'])
    expect(rows[0]!.findAll('.icon').map(icon => icon.attributes('data-item'))).toEqual(['3111', '3156'])
    // The item the build holds is marked.
    expect(rows[0]!.findAll('.knight')).toHaveLength(1)
  })
})
