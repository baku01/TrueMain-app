/**
 * The hover card of the nerd page's charts: one per chart, placed at the
 * pointer within the chart's box (`NerdTip`), on the side with more room so it
 * never covers the mark it reads. A mark opens it on pointer and on keyboard
 * focus alike; what it shows is also in the page's tables, so it enhances and
 * never gates.
 */
export interface TipLine {
  label: string
  value: string
  /** A short key of the series' colour beside the line (a CSS colour). */
  swatch?: string
}

export interface ChartTip {
  x: number
  y: number
  /** Whether the card opens left of the pointer (pointer in the box's right half). */
  flip: boolean
  title: string
  lines: TipLine[]
}

export function useChartTip() {
  const box = ref<HTMLElement | null>(null)
  const tip = ref<ChartTip | null>(null)

  function show(event: MouseEvent | FocusEvent, title: string, lines: TipLine[]) {
    const frame = box.value?.getBoundingClientRect()
    if (!frame) return
    let x: number
    let y: number
    if ('clientX' in event && event.type !== 'focus') {
      x = event.clientX - frame.left
      y = event.clientY - frame.top
    }
    else {
      const mark = (event.target as Element).getBoundingClientRect()
      x = mark.left + mark.width / 2 - frame.left
      y = mark.top - frame.top
    }
    tip.value = { x, y, flip: x > frame.width / 2, title, lines }
  }

  const hide = () => {
    tip.value = null
  }

  return { box, tip, show, hide }
}
