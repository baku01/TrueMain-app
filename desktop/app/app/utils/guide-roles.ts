import type { GuideRole } from '~/utils/mobafire'
import { getPositionIconUrl } from '#shared/utils/ddragon'

/** MOBAFire's lane words as TrueMain's positions, whose icons the app already draws. */
const POSITION: Record<GuideRole, string> = { top: 'TOP', jungle: 'JUNGLE', middle: 'MIDDLE', adc: 'BOTTOM', support: 'UTILITY' }

export const guideRoleIcon = (role: GuideRole) => getPositionIconUrl(POSITION[role])
