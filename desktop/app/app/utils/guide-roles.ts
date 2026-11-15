import type { ChampionPosition } from '#common/utils/positions'
import type { GuideRole } from '~/utils/mobafire'
import { getPositionIconUrl } from '#shared/utils/ddragon'

/** MOBAFire's lane words as TrueMain's positions, whose icons and picker the app already draws. */
const POSITION: Record<GuideRole, ChampionPosition> = { top: 'TOP', jungle: 'JUNGLE', middle: 'MIDDLE', adc: 'BOTTOM', support: 'UTILITY' }

export const guideRoleIcon = (role: GuideRole) => getPositionIconUrl(POSITION[role])

/** A lane as the app's position (`RolePicker`'s value). */
export const guidePosition = (role: GuideRole | null): ChampionPosition | null => (role ? POSITION[role] : null)

/** The app's position as MOBAFire's lane word. */
export const guideRoleOf = (position: ChampionPosition | null): GuideRole | null =>
  (Object.entries(POSITION) as [GuideRole, ChampionPosition][]).find(([, value]) => value === position)?.[0] ?? null
