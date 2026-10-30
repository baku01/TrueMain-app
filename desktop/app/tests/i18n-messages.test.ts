import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { allMessages } from '#common/utils/i18n'

// Vitest runs from `desktop/app`.
const roots = [join(process.cwd(), 'app'), join(process.cwd(), '../../web/layers/common/app')]

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === 'i18n' || name === 'fixtures' ? [] : sources(path)
    return /\.(vue|ts)$/.test(name) ? [path] : []
  })
}

const placeholders = (message: string) => [...message.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort().join(',')

describe('message dictionaries', () => {
  const { en, 'pt-BR': pt } = allMessages()

  it('give pt-BR exactly the keys English has', () => {
    expect(Object.keys(pt).filter(key => !(key in en))).toEqual([])
    expect(Object.keys(en).filter(key => !(key in pt))).toEqual([])
  })

  it('keep the same {params} in both languages', () => {
    const drifted = Object.keys(en).filter(key => key in pt && placeholders(en[key]!) !== placeholders(pt[key]!))
    expect(drifted).toEqual([])
  })

  it('have no empty translation', () => {
    expect(Object.keys(pt).filter(key => !pt[key]!.trim())).toEqual([])
  })

  it('cover every literal key the sources ask for', () => {
    const asked = new Set<string>()
    for (const file of roots.flatMap(sources)) {
      for (const match of readFileSync(file, 'utf8').matchAll(/(?<![\w.$])(?:t|tr)\(\s*'([a-zA-Z][\w-]*(?:\.[\w-]+)+)'/g)) asked.add(match[1]!)
    }
    expect([...asked].filter(key => !(key in en))).toEqual([])
  })
})
