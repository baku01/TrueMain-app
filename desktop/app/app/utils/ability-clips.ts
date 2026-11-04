/**
 * Riot's ability clips (the ones leagueoflegends.com plays): their addresses,
 * a still to show at once, and a warm-up that starts downloading them before
 * they are asked for. A clip is a few megabytes; started on the hover that
 * shows it, it took two seconds to play. Warmed while the player is still on
 * the list (or moving toward the skill order), it is in the cache by then.
 */
const BASE = 'https://d28xe8vt774jo5.cloudfront.net/champion-abilities'

const id = (championId: number) => String(championId).padStart(4, '0')

/** The clip itself: mp4, the lighter of the two cuts Riot serves, and the one the macOS webview plays. */
export const clipUrl = (championId: number, key: string) => `${BASE}/${id(championId)}/ability_${id(championId)}_${key}1.mp4`
/** The clip's first frame, shown while it loads. */
export const posterUrl = (championId: number, key: string) => `${BASE}/${id(championId)}/ability_${id(championId)}_${key}1.jpg`

/** Clips being downloaded or done, kept so the browser keeps them; the oldest are let go. */
const warm = new Map<string, HTMLVideoElement>()
const KEPT = 12

/** Start downloading a champion's clips (and their stills), most likely first. */
export function warmClips(championId: number, keys: readonly string[]) {
  if (typeof document === 'undefined') return
  for (const key of keys) {
    const url = clipUrl(championId, key)
    if (warm.has(url)) continue
    const still = new Image()
    still.src = posterUrl(championId, key)
    const video = document.createElement('video')
    video.muted = true
    video.preload = 'auto'
    video.src = url
    video.load()
    warm.set(url, video)
    if (warm.size > KEPT) {
      const [oldest, element] = warm.entries().next().value!
      element.removeAttribute('src')
      element.load()
      warm.delete(oldest)
    }
  }
}
