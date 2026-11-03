import { parseTruemainNameTag } from '#shared/utils/truemain-path'

/**
 * Every player opens on the dashboard, as their own profile does: the shared
 * components link a player to the site's profile route (`/truemains/Name-TAG`,
 * `Account`), and an old link may still name `/player`. Both land on
 * `/?riotId=Name%23TAG`, read from Blitz there.
 */
export default defineNuxtRouteMiddleware((to) => {
  if (to.path === '/player') {
    const riotId = typeof to.query.riotId === 'string' ? to.query.riotId : null
    return navigateTo(riotId ? { path: '/', query: { riotId, region: to.query.region } } : '/', { replace: true })
  }
  const slug = /^\/truemains\/([^/]+)/.exec(to.path)?.[1]
  if (!slug) return
  const parsed = parseTruemainNameTag(decodeURIComponent(slug))
  return navigateTo(parsed ? { path: '/', query: { riotId: `${parsed.gameName}#${parsed.tagLine}` } } : '/', { replace: true })
})
