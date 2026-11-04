import { championTraits, liveItems, liveVersion } from '~/utils/sources/champions'

/**
 * The pictures every page draws — champion portraits and item icons — fetched
 * once, quietly, a few seconds after the window opens, so a page that shows
 * them finds them in the cache: they no longer appear a beat after the page
 * (the flash of empty squares). The window only, never the overlay's panels;
 * in small batches between frames, so start-up stays smooth.
 */
export default defineNuxtPlugin(() => {
  if (window.location.pathname.startsWith('/overlay/') || window.location.hash.startsWith('#/overlay/')) return
  const idle = (callback: () => void) => ('requestIdleCallback' in window ? window.requestIdleCallback(callback, { timeout: 2000 }) : setTimeout(callback, 200))
  const kept: HTMLImageElement[] = []

  function warm(urls: string[]) {
    let at = 0
    const batch = () => {
      for (const url of urls.slice(at, at + 24)) {
        const image = new Image()
        image.decoding = 'async'
        image.src = url
        kept.push(image)
      }
      at += 24
      if (at < urls.length) idle(batch)
    }
    idle(batch)
  }

  setTimeout(async () => {
    try {
      const [version, champions, items] = await Promise.all([liveVersion(), championTraits(), liveItems()])
      const portraits = [...champions.values()].map(champion => `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champion.alias}.png`)
      warm([...portraits, ...Object.values(items).map(item => item.iconUrl)])
    }
    catch {
      // Nothing warmed: the pages load their pictures as before.
    }
  }, 2500)
})
