import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, provide, ref, shallowRef, toRef, watch } from 'vue'
import { PREVIOUS_BUILDS_KEY, storePreviousBuild } from '../app/utils/previous-build'
import BuildView from '../app/components/build/BuildView.vue'
import { kit } from './kit-fixtures'

/**
 * The build pane's kits (#2205): the player's kits on the champion and lane are
 * rows beside the builds, the draft's build stays the default, a kit picked
 * takes the pane, and a build picked goes back to the builds.
 */
const global = {
  stubs: {
    BuildList: { props: ['modelValue', 'options'], emits: ['update:modelValue'], template: '<div class="builds" :data-selected="modelValue"><button v-for="o in options" :key="o.key" class="build" @click="$emit(\'update:modelValue\', o.key)">{{ o.key }}</button></div>' },
    KitList: { props: ['kits', 'modelValue'], emits: ['update:modelValue'], template: '<div class="kits" :data-selected="modelValue"><button v-for="k in kits" :key="k.id" class="kit" @click="$emit(\'update:modelValue\', k.id)">{{ k.name }}</button></div>' },
    KitBuild: { props: ['kit'], template: '<div class="kit-build">{{ kit.name }}</div>' },
    BuildCore: { template: '<div class="core" />' },
    BuildTreeBlock: { template: '<div class="tree" />' },
    UIcon: true,
  },
}

const lane = { builds: [{ firstItemId: 6655, primaryKeystoneId: 8112, core: { runePage: null }, buildTree: [], games: 10, winRate: 0.5 }] }

beforeEach(() => {
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('shallowRef', shallowRef)
  vi.stubGlobal('provide', provide)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('toRef', toRef)
  vi.stubGlobal('useChampionBuilds', () => ({ response: ref(lane), pending: ref(false) }))
  vi.stubGlobal('useTierList', () => ({ mainEntryOf: () => null }))
  vi.stubGlobal('useStaticData', () => ({ items: ref({}), summoners: ref({}), runeTree: ref(null), pending: ref(false), loadChampion: () => {}, championStatic: () => null }))
  vi.stubGlobal('useChampionStatics', () => ({ patch: ref('16.21.1'), nameOf: (id: number) => String(id) }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.removeItem(PREVIOUS_BUILDS_KEY)
})

describe('BuildView with kits', () => {
  it('lists the kits beside the builds, the build first, and swaps the pane on a pick', async () => {
    const kits = [kit(), kit({ id: 'k2', name: 'Into mages' })]
    const wrapper = mount(BuildView, { props: { championId: 103, position: 'MIDDLE', kits, kitId: null, 'onUpdate:kitId': (id: string | null) => wrapper.setProps({ kitId: id }) }, global })
    expect(wrapper.text()).toContain('Your kits')
    expect(wrapper.findAll('.kit').map(button => button.text())).toEqual(['Into tanks', 'Into mages'])
    expect(wrapper.find('.core').exists()).toBe(true)
    expect(wrapper.find('.kit-build').exists()).toBe(false)

    await wrapper.findAll('.kit')[1]!.trigger('click')
    expect(wrapper.emitted('update:kitId')).toEqual([['k2']])
    expect(wrapper.get('.kit-build').text()).toBe('Into mages')
    expect(wrapper.get('.builds').attributes('data-selected')).toBeUndefined()

    await wrapper.get('.build').trigger('click')
    expect(wrapper.emitted('update:kitId')!.at(-1)).toEqual([null])
    expect(wrapper.find('.kit-build').exists()).toBe(false)
  })

  it('has no kits section without kits', () => {
    const wrapper = mount(BuildView, { props: { championId: 103, position: 'MIDDLE' }, global })
    expect(wrapper.text()).not.toContain('Your kits')
  })

  it('offers the previous build first, keeps the lane build the default, and remembers a row picked by hand', async () => {
    const previous = { key: 'lane-3071', core: { runePage: null }, firstItemId: 3071, keystoneId: 8010, buildTree: [], games: 5, winRate: 0.6 }
    storePreviousBuild(localStorage, 103, 'MIDDLE', previous as never)
    const wrapper = mount(BuildView, { props: { championId: 103, position: 'MIDDLE' }, global })
    expect(wrapper.findAll('.build').map(button => button.text())).toEqual(['previous', 'lane-6655-8112--'])
    expect(wrapper.get('.builds').attributes('data-selected')).toBe('lane-6655-8112--')

    await wrapper.findAll('.build')[1]!.trigger('click')
    const stored = JSON.parse(localStorage.getItem(PREVIOUS_BUILDS_KEY)!)
    expect(stored['103:MIDDLE'].option).toMatchObject({ key: 'previous', firstItemId: 6655 })
    // The list still offers the earlier visit's build: the click is next time's.
    expect(wrapper.findAll('.build')[0]!.text()).toBe('previous')
  })
})
