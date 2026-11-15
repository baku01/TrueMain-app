import { describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS, guidePath, isBlockedPage, listPath, parseGuide, parseGuideList, sanitizeGuideHtml } from '~/utils/mobafire'

/** MOBAFire's markup as its pages carry it (16.22), cut down to one of each. */
const LIST = `<html><head><title>League of Legends Strategy Build Guides</title></head><body>
<div data-aliases="[&quot;kha zix&quot;,&quot;khazix&quot;]" data-link="/league-of-legends/build/khazix?nocache=1" style="display: none;">
  <a href="/league-of-legends/build/khazix?nocache=1"><img src="/images/champion/rectangle/khazix-47x.png"><span>Kha'Zix</span></a></div>
<div class="mf-listings">
  <div class="mf-listings__divider">2026, Season 3 Guides <span>//</span> Patch 26.22</div>
  <a href="/league-of-legends/build/26-22-rank-1-briar-jungle-629922" class="mf-listings__item player-grandmaster">
    <div class="mf-listings__item__rating"><div class="mf-listings__item__rating__circle mf-listings__item__rating__circle--live"><div class="mf-listings__item__rating__circle__inner"><span>10</span></div></div>
      <div class="mf-listings__item__rating__info"><div><i class="icon-thumbs-up"></i> 1657</div> <span>Votes</span> <div><span><i class="icon-thumbs-down"></i> 61</span></div></div></div>
    <div class="mf-listings__item__pic mf-listings__item__pic--large role-jungle"><img data-original="/images/avatars/briar-street-demons.png" title="Briar" src="/images/avatars/briar-street-demons.png"></div>
    <div class="mf-listings__item__info"><div class="mf-listings__item__info__main">
      <h3 class="mf-listings__item__info__title"><img src="/images/lanes/jungle.png"> {26.22} Rank 1 Briar / All Matchups </h3>
      <span class="mf-listings__item__info__meta">Guide by <span class="user-level">L0ganJG</span> updated <span class="localized-datetime" data-timestamp="1794600232">November 13, 2026</span></span></div>
      <ul class="mf-listings__item__info__tags"><li class="in-depth tooltip">In-depth</li></ul></div>
  </a>
  <div class="mf-listings__divider">2026, Season 2 Builds</div>
  <a href="/league-of-legends/build/briar-builds-640001" class="mf-listings__item">
    <div class="mf-listings__item__rating"><div class="mf-listings__item__rating__circle"><div class="mf-listings__item__rating__circle__inner"><span></span></div></div>
      <div class="mf-listings__item__rating__info"><div><i class="icon-thumbs-up"></i> 0</div><div><span><i class="icon-thumbs-down"></i> 0</span></div></div></div>
    <div class="mf-listings__item__pic mf-listings__item__pic--large role-top"><img data-original="/images/avatars/briar.png" title="Briar"></div>
    <div class="mf-listings__item__info"><h3 class="mf-listings__item__info__title">Briar Builds</h3></div>
  </a>
</div>
<div class="browse-pager"><div class="browse-pager__pages"><a href="/league-of-legends/build" class="current">1</a> <a href="/league-of-legends/build?page=2">2</a> <a href="/league-of-legends/build?page=50">50</a></div></div>
<div class="sidebar-module" id="trending-guides"><ul class="sidebar-module__list"><li>
  <a href="/league-of-legends/build/26-20-pengs-ahri-guide-648700" class="sidebar-module__list__item">
    <span class="sidebar-module__list__item__pic"><img data-original="/images/champion/square/ahri.png"></span>
    <span class="sidebar-module__list__item__content"><h4>[26.20] Peng's Ahri Guide</h4><p>By <span class="user-level">Peng04</span> Views: <b>271K</b></p></span>
    <span class="sidebar-module__list__item__votes"><div class="radial-progress"><div class="inset"><div class="percentage">+5</div></div></div></span>
  </a></li></ul></div>
</body></html>`

const GUIDE = `<html><head><title>Briar Build Guide : {26.22} Rank 1 Briar :: League of Legends Strategy Builds</title></head><body>
<div class="view-guide__banner" style="background-image:url(/images/champion/skins/banner/briar-street-demons.jpg);">
  <div class="view-guide__banner__slash">
    <h1 class="view-guide__banner__title tablet-up guide-h1"><img src="/images/lanes/white-jungle.png" alt="Jungle"><span> {26.22} Rank 1 Briar </span></h1>
    <span class="view-guide__banner__date tablet-up">Updated on <span class="localized-datetime" data-timestamp="1794600232">November 13, 2026</span></span>
    <div class="view-guide__banner__ranking"><div class="mf-listings__item__rating__circle mf-listings__item__rating__circle--live"><span>10</span></div>
      <div class="mf-listings__item__rating__info tablet-up"><div><i class="icon-thumbs-up"></i> 1657</div> <span>Votes</span> <div><span><i class="icon-thumbs-down"></i> 61</span></div></div></div>
    <div class="view-guide__banner__slash__elo"><div class="view-guide__banner__slash__elo__bar">grandmaster</div></div>
  </div>
  <div class="view-guide__banner__bot">
    <span class="view-guide__banner__author tablet-up"><span><img src="/images/avatars/briar-battle-academia.png"><span>Build Guide By <a href="/profile/l0ganjg-1148198">L0ganJG</a></span></span></span>
    <span class="view-guide__banner__meta view-guide__banner__meta--big"><span><img src="/images/new-guide/views.svg"> 1,803,879 <span class="tablet-up"> Views</span></span> <span><img src="/images/new-guide/comments.svg"> 68 <span class="tablet-up"> Comments</span></span></span>
  </div>
</div>
<div class="view-guide__build" style="display: block;">
  <div class="view-guide__build__core"><div class="view-guide__build__core__inner" data-count="2">
    <span class="ajax-tooltip"><a href="/league-of-legends/item/titanic-hydra-289"><img data-original="/images/item/titanic-hydra-64x.png" src="/images/item/titanic-hydra-64x.png"><span>Titanic Hydra</span></a></span>
    <span class="ajax-tooltip"><a href="/league-of-legends/item/black-cleaver-59"><img data-original="/images/item/black-cleaver-64x.png"><span>Black Cleaver</span></a></span>
  </div></div>
  <div class="view-guide__build__runes"><h3 class="collapse-title">Runes: <span>PTA / Bruiser Runes </span></h3>
    <div class="view-guide__build__switcher"><span title="PTA / Bruiser Runes " class="active">1</span><span title="Lethal / BRUISER OR CRIT">2</span></div>
    <div class="new-runes"><div class="view-guide__build__notes tooltip" title="Triumph basically do not change."><img></div>
      <div class="new-runes__primary" path="Precision">
        <div class="new-runes__item"><div class="new-runes__item__circle"><img src="/images/new-guide/new-runes/precision.png"></div><span></span></div>
        <div class="new-runes__item new-runes__item--keystone"><div class="new-runes__item__circle"><img src="/images/reforged-rune/press-the-attack.png"></div><span>Press the Attack</span></div>
        <div class="new-runes__item"><div class="new-runes__item__circle"><img src="/images/reforged-rune/triumph.png"></div><span>Triumph</span></div>
      </div>
      <div class="new-runes__secondary" path="Domination">
        <div class="new-runes__item"><div class="new-runes__item__circle"><img src="/images/new-guide/new-runes/domination.png"></div><span></span></div>
        <div class="new-runes__item"><div class="new-runes__item__circle"><img src="/images/reforged-rune/sudden-impact.png"></div><span>Sudden Impact</span></div>
      </div>
      <div class="new-runes__bonuses"><div class="new-runes__shards"><span shard-type="diamond"><img src="/images/shards/adaptive-force.png"></span><span shard-type="heart plus"><img src="/images/shards/health-scaling.png"></span></div>
        <span>Bonus:</span><p> +9 Adaptive (5.4 AD or 9 AP)<br> +10-180 Bonus Health<br> </p></div>
    </div>
    <div class="new-runes"><div class="new-runes__primary" path="Precision">
      <div class="new-runes__item"><div class="new-runes__item__circle"><img data-original="/images/new-guide/new-runes/precision.png"></div><span></span></div>
      <div class="new-runes__item new-runes__item--keystone"><div class="new-runes__item__circle"><img data-original="/images/reforged-rune/lethal-tempo.png"></div><span>Lethal Tempo</span></div>
    </div></div>
  </div>
  <div class="view-guide__build__spells"><div class="view-guide__spells" style="display: block;"><span>Every Game</span>
    <div class="view-guide__spells__row"><img src="/images/summoner-spell/flash.png"><h4>Flash</h4></div>
    <div class="view-guide__spells__row"><img src="/images/summoner-spell/smite.png"><h4>Smite</h4></div></div></div>
  <div class="view-guide__build__items"><div class="view-guide__items">
    <div class="view-guide__items__bar"><span>Boots</span><span class="tooltip" title="Steelcaps into AD."><img></span></div>
    <div class="view-guide__items__content"><span><a href="/league-of-legends/item/plated-steelcaps-422"><img data-original="/images/item/plated-steelcaps-46x.png" src="/images/spacer.png"><span>Plated Steelcaps</span></a></span></div>
  </div></div>
  <div class="view-guide__build__abilities"><h3 class="collapse-title">Ability Order <span>Every Game! </span></h3><div class="champ-build__abilities">
    <div class="champ-build__abilities__row champ-build__abilities__row--passive"><a><img src="/images/ability/briar-crimson-curse.png"><h4>Crimson Curse <span class="mobile-only">(PASSIVE)</span></h4></a></div>
    <div class="champ-build__abilities__row"><a><img data-original="/images/ability/briar-head-rush.png"><h4>Head Rush <span class="mobile-only">(Q)</span></h4></a>
      <ul><li level="1"></li><li level="2"></li><li level="3" class="lit"></li><li level="8" class="lit"></li></ul></div>
  </div></div>
</div>
<div class="view-guide__tS__bot__left collapsed" level="1">
  <div class="row" level="1"><div class="row__image"><img data-original="/images/champion/square/elise.png"></div><h4>Elise</h4><label>Extreme</label><p>VERY TOUGH MATCHUP!<br> Counter gank her.</p></div>
  <div class="row" level="4"><div class="row__image"><img></div><h4>Zed</h4><label>Minor</label><p></p></div>
</div>
<div class="view-guide__tS__bot__right collapsed tablet-up" level="1"><div class="collapse-box"> </div></div>
<div class="view-guide__chapters">
  <div class="view-guide__chapter"><div class="view-guide__chapter__top"><span>Easy First Week Guide! </span></div>
    <div class="view-guide__chapter__content">Hi I am <span style="color:#ff0000">Logan</span>!<script>alert(1)</script><br><img src="/images/spacer.png" data-original="/images/champion/skins/portrait/briar-street-demons.jpg"></div></div>
</div>
</body></html>`

describe('MOBAFire addresses', () => {
  it('writes the list\'s address as the site does', () => {
    expect(listPath(DEFAULT_FILTERS)).toBe('league-of-legends/build')
    expect(listPath({ ...DEFAULT_FILTERS, champion: 'briar', role: 'jungle', sort: 'top', ranked: true, page: 2 }))
      .toBe('league-of-legends/build/briar/jungle?sort=top&author=verified&page=2')
    expect(listPath({ ...DEFAULT_FILTERS, role: 'adc', category: 'off-meta' })).toBe('league-of-legends/build/adc?category=off-meta')
  })

  it('opens a guide by its slug only', () => {
    expect(guidePath('26-22-rank-1-briar-jungle-629922')).toBe('league-of-legends/build/26-22-rank-1-briar-jungle-629922')
    expect(guidePath('briar')).toBeNull()
    expect(guidePath('../ajax-1')).toBeNull()
  })

  it('knows Cloudflare\'s pages from the site\'s', () => {
    expect(isBlockedPage('<html><head><title>Attention Required! | Cloudflare</title>')).toBe(true)
    expect(isBlockedPage('<html><head><title>Um momento…</title>')).toBe(true)
    expect(isBlockedPage(LIST)).toBe(false)
  })
})

describe('parseGuideList', () => {
  const list = parseGuideList(LIST)

  it('reads each guide under its divider', () => {
    expect(list.sections.map(section => [section.label, section.guides.length])).toEqual([
      ['2026, Season 3 Guides · Patch 26.22', 1],
      ['2026, Season 2 Builds', 1],
    ])
    expect(list.sections[0]!.guides[0]).toEqual({
      path: 'league-of-legends/build/26-22-rank-1-briar-jungle-629922',
      slug: '26-22-rank-1-briar-jungle-629922',
      title: '{26.22} Rank 1 Briar / All Matchups',
      champion: 'Briar',
      avatar: 'https://www.mobafire.com/images/avatars/briar-street-demons.png',
      role: 'jungle',
      score: 10,
      current: true,
      votesUp: 1657,
      votesDown: 61,
      author: 'L0ganJG',
      updatedAt: 1794600232000,
      tags: ['In-depth'],
      rank: 'grandmaster',
    })
  })

  it('leaves an unrated guide without a score, its picture read from where the site loads it late', () => {
    const guide = list.sections[1]!.guides[0]!
    expect([guide.score, guide.current, guide.author, guide.rank, guide.role]).toEqual([null, false, '', null, 'top'])
    expect(guide.avatar).toBe('https://www.mobafire.com/images/avatars/briar.png')
  })

  it('reads the pages, the trending guides and the site\'s champions', () => {
    expect([list.page, list.pages]).toEqual([1, 50])
    expect(list.trending).toEqual([{ slug: '26-20-pengs-ahri-guide-648700', title: '[26.20] Peng\'s Ahri Guide', image: 'https://www.mobafire.com/images/champion/square/ahri.png', author: 'Peng04', views: '271K', votes: '+5' }])
    expect(list.champions).toEqual([{ slug: 'khazix', name: 'Kha\'Zix', image: 'https://www.mobafire.com/images/champion/rectangle/khazix-47x.png', aliases: ['kha zix', 'khazix'] }])
  })
})

describe('parseGuide', () => {
  const guide = parseGuide(GUIDE, '26-22-rank-1-briar-jungle-629922')

  it('reads the banner', () => {
    expect(guide).toMatchObject({
      title: '{26.22} Rank 1 Briar',
      champion: 'Briar',
      role: 'jungle',
      banner: 'https://www.mobafire.com/images/champion/skins/banner/briar-street-demons.jpg',
      updatedAt: 1794600232000,
      score: 10,
      current: true,
      votesUp: 1657,
      votesDown: 61,
      rank: 'grandmaster',
      author: { name: 'L0ganJG', avatar: 'https://www.mobafire.com/images/avatars/briar-battle-academia.png' },
      views: '1,803,879',
      comments: 68,
    })
  })

  it('reads a build block by block, each rune page under its switcher\'s title', () => {
    const [build] = guide.builds
    expect(build!.recommended.map(item => item.name)).toEqual(['Titanic Hydra', 'Black Cleaver'])
    expect(build!.runes).toHaveLength(2)
    expect(build!.runes[0]).toEqual({
      title: 'PTA / Bruiser Runes',
      notes: 'Triumph basically do not change.',
      primary: { tree: 'Precision', runes: [{ name: 'Press the Attack', image: 'https://www.mobafire.com/images/reforged-rune/press-the-attack.png' }, { name: 'Triumph', image: 'https://www.mobafire.com/images/reforged-rune/triumph.png' }] },
      secondary: { tree: 'Domination', runes: [{ name: 'Sudden Impact', image: 'https://www.mobafire.com/images/reforged-rune/sudden-impact.png' }] },
      shards: [{ name: 'adaptive force', image: 'https://www.mobafire.com/images/shards/adaptive-force.png' }, { name: 'health scaling', image: 'https://www.mobafire.com/images/shards/health-scaling.png' }],
      bonuses: ['+9 Adaptive (5.4 AD or 9 AP)', '+10-180 Bonus Health'],
    })
    expect(build!.runes[1]!.title).toBe('Lethal / BRUISER OR CRIT')
    expect(build!.runes[1]!.primary.runes[0]!.image).toBe('https://www.mobafire.com/images/reforged-rune/lethal-tempo.png')
    expect(build!.spells).toEqual([{ title: 'Every Game', notes: null, spells: [{ name: 'Flash', image: 'https://www.mobafire.com/images/summoner-spell/flash.png' }, { name: 'Smite', image: 'https://www.mobafire.com/images/summoner-spell/smite.png' }] }])
    expect(build!.items).toEqual([{ title: 'Boots', notes: 'Steelcaps into AD.', items: [{ name: 'Plated Steelcaps', image: 'https://www.mobafire.com/images/item/plated-steelcaps-46x.png' }] }])
    expect(build!.abilities).toEqual({
      title: 'Every Game!',
      notes: null,
      rows: [
        { key: 'P', name: 'Crimson Curse', image: 'https://www.mobafire.com/images/ability/briar-crimson-curse.png', levels: [] },
        { key: 'Q', name: 'Head Rush', image: 'https://www.mobafire.com/images/ability/briar-head-rush.png', levels: [3, 8] },
      ],
    })
  })

  it('reads the threats with their notes line by line, and no synergy where the author gave none', () => {
    expect(guide.threats).toEqual([
      { champion: 'Elise', image: 'https://www.mobafire.com/images/champion/square/elise.png', level: 1, label: 'Extreme', note: 'VERY TOUGH MATCHUP!\nCounter gank her.' },
      { champion: 'Zed', image: null, level: 4, label: 'Minor', note: '' },
    ])
    expect(guide.synergies).toEqual([])
  })

  it('keeps a chapter\'s writing and pictures, never its scripts', () => {
    expect(guide.chapters).toEqual([{
      title: 'Easy First Week Guide!',
      html: 'Hi I am <span style="color:#ff0000">Logan</span>!<br><img src="https://www.mobafire.com/images/champion/skins/portrait/briar-street-demons.jpg" alt="" loading="lazy">',
    }])
  })
})

describe('sanitizeGuideHtml', () => {
  it('drops what runs or loads a frame, and every attribute but a colour', () => {
    const html = sanitizeGuideHtml('<p onclick="x()">a<iframe srcdoc="x"></iframe><a href="javascript:x()">b</a><span style="color:red;background:url(x)">c</span></p><img src="javascript:x()"><img src="https://i.imgur.com/a.png" onerror="x()">')
    expect(html).toBe('<p>ab<span style="color:red">c</span></p><img src="https://i.imgur.com/a.png" alt="" loading="lazy">')
  })

  it('keeps the site\'s icons in the text icon-sized, and its centred blocks centred', () => {
    expect(sanitizeGuideHtml('<div class="bbcode_center">x <img src="/images/item/black-cleaver-46x.png"></div>'))
      .toBe('<div class="guide-center">x <img src="https://www.mobafire.com/images/item/black-cleaver-46x.png" alt="" loading="lazy" class="guide-icon"></div>')
  })
})
