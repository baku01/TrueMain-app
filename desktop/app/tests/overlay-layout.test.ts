import { describe, expect, it } from 'vitest'
import { DEV_OVERLAY_VIEW, stackedOn } from '~/types/overlay'
import { customAt, panelBox, panelSize, stackedBox } from '~/utils/overlay-layout'

const screen = { width: 2560, height: 1440 }
const at = (custom: { x: number, y: number }) => ({ enabled: true, anchor: 'top-left' as const, custom })

describe('overlay layout', () => {
  it('keeps a panel dropped against an edge against it, whatever its size', () => {
    const custom = customAt({ x: 2560 - 232, y: 0 }, { width: 232, height: 60 }, screen)
    expect(custom).toEqual({ x: 1, y: 0 })
    const box = panelBox(at(custom), { width: 300, height: 200 }, screen)
    expect(box.x + box.width).toBe(screen.width)
    expect(box.y).toBe(0)
  })

  it('places a panel back where it was dropped', () => {
    const size = { width: 176, height: 84 }
    const box = panelBox(at(customAt({ x: 1000, y: 400 }, size, screen)), size, screen)
    expect(box.x).toBeCloseTo(1000, 0)
    expect(box.y).toBeCloseTo(400, 0)
  })

  it('never puts a panel off the screen', () => {
    const custom = customAt({ x: 9999, y: -50 }, { width: 160, height: 48 }, screen)
    expect(custom).toEqual({ x: 1, y: 0 })
  })

  it('stacks the tips under the objectives, centred, whatever size the objectives take, until they are dragged', () => {
    const settings = DEV_OVERLAY_VIEW.settings
    expect(stackedOn(settings, 'tips')).toBe('objectives')
    expect(stackedOn(settings, 'stats')).toBeNull()
    for (const scale of [1, 1.4]) {
      const strip = panelBox(settings.objectives, panelSize('objectives', scale), screen)
      const tip = stackedBox(strip, panelSize('tips', 1), screen)
      expect(tip.x + tip.width / 2).toBeCloseTo(strip.x + strip.width / 2, 0)
      // Whole points, as the shell places windows.
      expect(tip.y).toBe(Math.round(strip.y + strip.height + 8))
    }
    // Dragged, or with the objectives off, the tips stand on their own.
    expect(stackedOn({ ...settings, tips: { ...settings.tips, custom: { x: 0.1, y: 0.8 } } }, 'tips')).toBeNull()
    expect(stackedOn({ ...settings, objectives: { ...settings.objectives, enabled: false } }, 'tips')).toBeNull()
  })
})
