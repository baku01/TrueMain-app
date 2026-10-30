import type { InjectionKey } from 'vue'

/**
 * A server's own flag, for the apps that show the player's real server
 * (`platformId`) rather than the site's three stylised regions — the site's
 * `americas` is the US flag, wrong for a Brazilian account. Only the servers
 * whose flag is drawn in the `region` icon collection are listed; any other
 * falls back to its region's. Literal names, so the desktop's icon scan bundles
 * them.
 */
const SERVER_FLAGS: Record<string, string> = {
  BR1: 'i-region-br1',
  TR1: 'i-region-tr1',
  RU: 'i-region-ru',
}

export function serverFlagIcon(platformId: string | null | undefined): string | null {
  return platformId ? SERVER_FLAGS[platformId.toUpperCase()] ?? null : null
}

/** Provided as `true` by an app that wants each server's own flag: the desktop app does, the site keeps its regions. */
export const SERVER_FLAGS_KEY: InjectionKey<boolean> = Symbol('server-flags')
