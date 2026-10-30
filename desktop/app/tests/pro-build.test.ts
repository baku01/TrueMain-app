import { describe, expect, it } from 'vitest'
import { SAMPLE_PROS, searchPros } from '~/utils/pro-build'

describe('searchPros', () => {
  it('narrows by role, and by words of the name or team, ignoring case and accents', () => {
    expect(searchPros(SAMPLE_PROS, '', 'TOP').map(player => player.id)).toEqual(['sample-top'])
    expect(searchPros(SAMPLE_PROS, 'ATIRADOR', null).map(player => player.id)).toEqual(['sample-bottom'])
    expect(searchPros(SAMPLE_PROS, 'time exemplo', null)).toHaveLength(SAMPLE_PROS.length)
    expect(searchPros(SAMPLE_PROS, 'zzz', null)).toEqual([])
  })

  it('keeps the sample honest: placeholder names only', () => {
    expect(SAMPLE_PROS.every(player => player.name.startsWith('Exemplo'))).toBe(true)
  })
})
