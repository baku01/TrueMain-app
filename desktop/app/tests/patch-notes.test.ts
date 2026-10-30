import { describe, expect, it } from 'vitest'
import { isIcon, parsePatchList, parsePatchNote, patchVersion, safeImage, sanitizeNoteHtml } from '~/utils/patch-notes'

const page = (blades: unknown[]) => JSON.stringify({ props: { pageProps: { page: { blades } } } })

describe('parsePatchList', () => {
  const item = (version: string, extra: Record<string, unknown> = {}) => ({
    title: `Notas ${version}`,
    publishedAt: '2026-10-20T18:00:00.000Z',
    media: { url: 'https://cmsassets.rgpub.io/x.jpg' },
    action: { payload: { url: `/pt-br/news/game-updates/league-of-legends-patch-${version.replace('.', '-')}-notes` } },
    ...extra,
  })

  it('lists the patches newest first, one per version', () => {
    const json = page([{ type: 'articleCardGrid', items: [item('26.9'), item('26.21'), item('26.10'), item('26.21')] }])
    expect(parsePatchList(json).map(patch => patch.version)).toEqual(['26.21', '26.10', '26.9'])
  })

  it('reads a description given as an html object as plain text', () => {
    const json = page([{ type: 'articleCardGrid', items: [item('26.21', { description: { type: 'html', body: 'True <b>Damage</b> has arrived' } })] }])
    expect(parsePatchList(json)[0]!.description).toBe('True Damage has arrived')
  })

  it('leaves out what is not a patch note, and survives garbage', () => {
    const other = { title: 'Dev', action: { payload: { url: '/pt-br/news/dev/something' } } }
    expect(parsePatchList(page([{ type: 'articleCardGrid', items: [other] }]))).toEqual([])
    expect(parsePatchList('not json')).toEqual([])
  })
})

describe('patchVersion', () => {
  it('reads the version out of a note path', () => {
    expect(patchVersion('/pt-br/news/game-updates/league-of-legends-patch-26-21-notes')).toBe('26.21')
    expect(patchVersion('/pt-br/news/game-updates/patch-14-1-notes/')).toBe('14.1')
    expect(patchVersion('/pt-br/news/dev/x')).toBeNull()
  })
})

describe('safeImage', () => {
  it('unwraps Riot CDN proxy addresses and keeps only known hosts over https', () => {
    expect(safeImage('https://am-a.akamaihd.net/image?f=https://ddragon.leagueoflegends.com/cdn/16.18.1/img/champion/Azir.png'))
      .toBe('https://ddragon.leagueoflegends.com/cdn/16.18.1/img/champion/Azir.png')
    expect(safeImage('https://cmsassets.rgpub.io/a.jpg')).toBe('https://cmsassets.rgpub.io/a.jpg')
    expect(safeImage('http://ddragon.leagueoflegends.com/a.png')).toBeNull()
    expect(safeImage('https://evil.example/a.png')).toBeNull()
    expect(safeImage('javascript:alert(1)')).toBeNull()
    expect(safeImage('https://am-a.akamaihd.net/image?f=https://evil.example/a.png')).toBeNull()
  })
})

describe('isIcon', () => {
  it('tells an icon from a picture by the size Riot puts in the address', () => {
    expect(isIcon('https://cmsassets.rgpub.io/a-512x512.png')).toBe(true)
    expect(isIcon('https://ddragon.leagueoflegends.com/cdn/1/img/item/3031.png')).toBe(true)
    expect(isIcon('https://cmsassets.rgpub.io/a-1610x590.jpg')).toBe(false)
    expect(isIcon('https://cmsassets.rgpub.io/a.jpg')).toBe(false)
  })
})

describe('sanitizeNoteHtml', () => {
  it('drops scripts, handlers, links and unknown images', () => {
    const html = sanitizeNoteHtml('<p onclick="x()">Hi <a href="https://evil.example">there</a><script>alert(1)</script><img src="https://evil.example/a.png" onerror="x()"><strong>bold</strong></p>')
    expect(html).toBe('<p>Hi there<strong>bold</strong></p>')
  })

  it('keeps a known image and the classes the view styles', () => {
    expect(sanitizeNoteHtml('<h4 class="change-detail-title other">T</h4><img src="https://cmsassets.rgpub.io/a.jpg">'))
      .toBe('<h4 class="change-detail-title">T</h4><img src="https://cmsassets.rgpub.io/a.jpg" class="note-art" alt="" loading="lazy">')
  })
})

describe('parsePatchNote', () => {
  const body = `<div id="patch-notes-container">
    <blockquote class="blockquote context"><p>Intro</p></blockquote>
    <header class="header-primary"><h2>Campeões</h2></header>
    <div class="content-border"><div class="patch-change-block"><div>
      <p><a class="reference-link" href="https://x"><img src="https://am-a.akamaihd.net/image?f=https://ddragon.leagueoflegends.com/cdn/1/img/champion/Azir.png"></a></p>
      <h3 class="change-title">Azir</h3><hr class="divider"><h4 class="change-detail-title">Base</h4><ul><li><strong>Mana</strong>: 40 ⇒ 50</li></ul>
    </div></div></div>
    <header class="header-primary"><h2>Itens</h2></header>
    <div class="content-border"><div><h3 class="change-title">Mejai</h3><ul><li>Nerf</li></ul></div></div>
  </div>`

  it('splits the note into sections and one block per champion or item', () => {
    const note = parsePatchNote(page([{ type: 'patchNotesRichText', richText: { body } }]))
    expect(note.intro).toBe('<p>Intro</p>')
    expect(note.sections.map(section => section.title)).toEqual(['Campeões', 'Itens'])
    const azir = note.sections[0]!.blocks[0]!
    expect(azir.title).toBe('Azir')
    expect(azir.iconUrl).toBe('https://ddragon.leagueoflegends.com/cdn/1/img/champion/Azir.png')
    expect(azir.html).not.toContain('Azir')
    expect(azir.html).toContain('<li><strong>Mana</strong>: 40 ⇒ 50</li>')
    expect(note.sections[1]!.blocks[0]!.title).toBe('Mejai')
  })

  it('gives a block with one of Riot\'s pictures the whole row', () => {
    const block = (src: string) => `<div id="patch-notes-container"><div class="content-border"><div><p><img src="${src}"></p><p>Legend</p></div></div></div>`
    const wideOf = (src: string) => parsePatchNote(page([{ type: 'patchNotesRichText', richText: { body: block(src) } }])).sections[0]!.blocks[0]!.wide
    expect(wideOf('https://cmsassets.rgpub.io/x-1920x1080.jpg')).toBe(true)
    // An item's or ability's icon is a few hundred pixels: it stays in its card.
    expect(wideOf('https://cmsassets.rgpub.io/x-512x512.png')).toBe(false)
    expect(wideOf('https://cmsassets.rgpub.io/x-143x148.png')).toBe(false)
  })

  it('gives long prose with no champion the whole row, and a champion card a column', () => {
    const prose = `<div id="patch-notes-container"><div class="content-border"><div><h3 class="change-detail-title">Updates</h3><p>${'text '.repeat(80)}</p></div></div>`
      + '<div class="content-border"><div><p><a class="reference-link" href="https://x"><img src="https://ddragon.leagueoflegends.com/a.png"></a></p><h3 class="change-title">Azir</h3><p>'
      + `${'text '.repeat(80)}</p></div></div></div>`
    const blocks = parsePatchNote(page([{ type: 'patchNotesRichText', richText: { body: prose } }])).sections[0]!.blocks
    expect(blocks.map(block => block.wide)).toEqual([true, false])
  })

  it('answers an empty note for a page with no body', () => {
    expect(parsePatchNote(page([]))).toEqual({ intro: '', sections: [] })
  })
})
