import type { DataSource } from '~/utils/data-source'

/**
 * Which source answers a read only some sources measure (the counters'
 * scores, the synergies, the duos, win rate by mastery, the patch's change):
 * the picked source when it measures it; else the ones that do, Blitz first,
 * then the others in the order the reader lists them — each asked in turn
 * when the one before fails or answers nothing. TrueMain is asked only when
 * it is the pick: with another source picked, the app asks TrueMain nothing
 * (Settings' promise, which `apiGet` and the shell keep).
 */
export function standInOrder(picked: DataSource, carriers: readonly DataSource[]): DataSource[] {
  const asked = carriers.filter(source => source !== 'truemain' || picked === 'truemain')
  const order: DataSource[] = asked.includes(picked) ? [picked] : []
  for (const source of ['blitz' as const, ...asked]) {
    if (asked.includes(source) && !order.includes(source)) order.push(source)
  }
  return order
}

/**
 * Each source of `order` read in turn; the first answer that is not `empty`
 * kept, with the source it came from. When every one answered nothing, the
 * first's empty answer; when every one failed, the last failure.
 */
export async function readFirst<T>(order: DataSource[], read: (source: DataSource) => Promise<T>, empty: (answer: T) => boolean): Promise<{ source: DataSource, answer: T }> {
  let blank: { source: DataSource, answer: T } | null = null
  let failure: unknown = new Error('No source measures this')
  for (const source of order) {
    try {
      const answer = await read(source)
      if (!empty(answer)) return { source, answer }
      blank ??= { source, answer }
    }
    catch (error) {
      failure = error
    }
  }
  if (blank) return blank
  throw failure
}
