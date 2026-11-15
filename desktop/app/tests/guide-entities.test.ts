import { describe, expect, it } from 'vitest'
import type { GuideIndex } from '~/utils/guide-entities'
import { buildGuideIndex, idOf, nameKey, runePageOf } from '~/utils/guide-entities'
import { htmlPieces } from '~/utils/guide-translate'
import { sanitizeGuideHtml } from '~/utils/mobafire'
import { batches, translationTarget } from '~/utils/translate'

const index: GuideIndex = {
  items: new Map([['platedsteelcaps', 3047], ['titanichydra', 3748]]),
  spells: new Map([['flash', 4], ['smite', 11]]),
  runes: new Map([['presstheattack', 8005], ['triumph', 9111], ['legendhaste', 9105], ['coupdegrace', 8014], ['suddenimpact', 8143], ['treasurehunter', 8135], ['adaptiveforce', 5008], ['healthscaling', 5001]]),
  styles: new Map([['precision', 8000], ['domination', 8100]]),
  champions: new Map([['khazix', 121], ['nunuwillump', 20]]),
}

const icon = (name: string, slug = '') => ({ name, image: slug ? `https://www.mobafire.com/images/reforged-rune/${slug}.png` : null })

describe('a guide\'s names as the game\'s ids', () => {
  it('keys names as the index does, apostrophes and ampersands aside', () => {
    expect(nameKey('Kha\'Zix')).toBe('khazix')
    expect(nameKey('Nunu & Willump')).toBe('nunuwillump')
    expect(nameKey('Legend: Haste')).toBe('legendhaste')
  })

  it('finds an id by name, else by the word of the site\'s picture', () => {
    expect(idOf(index.items, 'Plated Steelcaps')).toBe(3047)
    expect(idOf(index.items, 'Steelcaps', 'https://www.mobafire.com/images/item/plated-steelcaps-46x.png')).toBe(3047)
    expect(idOf(index.items, 'Unknown')).toBeNull()
  })

  it('makes the app\'s rune page of a guide\'s whole page, and none of a partial one', () => {
    const page = {
      title: 'PTA',
      notes: null,
      primary: { tree: 'Precision', runes: [icon('Press the Attack'), icon('Triumph'), icon('Legend: Haste'), icon('Coup de Grace')] },
      secondary: { tree: 'Domination', runes: [icon('Sudden Impact'), icon('Treasure Hunter')] },
      shards: [icon('adaptive force', 'adaptive-force'), icon('adaptive force'), icon('health scaling')],
      bonuses: [],
    }
    expect(runePageOf(page, index)).toMatchObject({
      primaryStyleId: 8000, primaryKeystoneId: 8005, primaryPerk1Id: 9111, primaryPerk2Id: 9105, primaryPerk3Id: 8014,
      secondaryStyleId: 8100, secondaryPerk1Id: 8143, secondaryPerk2Id: 8135, statOffense: 5008, statFlex: 5008, statDefense: 5001,
    })
    expect(runePageOf({ ...page, secondary: { tree: 'Domination', runes: [icon('Sudden Impact')] } }, index)).toBeNull()
  })

  it('keeps the Rift\'s own summoner spells and champions where Data Dragon lists a name twice', () => {
    const summoners = {
      data: {
        SummonerCherryFlash: { key: '2202', name: 'Flash', modes: ['CHERRY'] },
        SummonerFlash: { key: '4', name: 'Flash', modes: ['ARAM', 'CLASSIC'] },
        SummonerFlash_Jade: { key: '74', name: 'Flash', modes: ['JADE'] },
        SummonerSmite: { key: '11', name: 'Smite', modes: ['CLASSIC'] },
        SummonerSmite_Jade: { key: '711', name: 'Smite', modes: ['JADE'] },
      },
    }
    const champions = { data: { Ahri: { key: '103', name: 'Ahri' }, Jade_Ahri: { key: '60103', name: 'Ahri' } } }
    const built = buildGuideIndex({ data: {} }, summoners, [], champions)
    expect(built.spells.get('flash')).toBe(4)
    expect(built.spells.get('smite')).toBe(11)
    expect(built.champions.get('ahri')).toBe(103)
  })
})

describe('translating what authors wrote', () => {
  it('translates for any language but English', () => {
    expect(translationTarget('pt-BR')).toBe('pt')
    expect(translationTarget('en')).toBeNull()
  })

  it('sends texts in batches of a few thousand characters, a long one alone', () => {
    expect(batches(['a'.repeat(3000), 'b'.repeat(1000), 'c'.repeat(1000), 'd'.repeat(9000)], 4500).map(group => group.map(text => text.length)))
      .toEqual([[3000, 1000], [1000], [9000]])
  })

  it('cuts a chapter between its blocks, never inside a tag', () => {
    const html = `<p>${'x'.repeat(30)}</p>text<ul><li>${'y'.repeat(30)}</li></ul>`
    expect(htmlPieces(html, 45)).toEqual([`<p>${'x'.repeat(30)}</p>text`, `<ul><li>${'y'.repeat(30)}</li></ul>`])
  })

  it('keeps a video as its thumbnail, through a translation\'s second sanitizing too', () => {
    const once = sanitizeGuideHtml('<lite-youtube videoid="env3Ip35Wwk" style="width:540px"><button>Play Video</button></lite-youtube><lite-youtube videoid="bad id"></lite-youtube>')
    expect(once).toBe('<div class="guide-video" data-video="env3Ip35Wwk"><img src="https://img.youtube.com/vi/env3Ip35Wwk/hqdefault.jpg" alt="" loading="lazy"></div>')
    expect(sanitizeGuideHtml(once)).toBe(once)
    expect(sanitizeGuideHtml('<img src="https://tracker.example/p.gif"><div class="guide-center">x</div>')).toBe('<div class="guide-center">x</div>')
  })
})
