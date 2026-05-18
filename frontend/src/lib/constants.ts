const DEFAULT_CONTRACT_ADDRESS = '0x9fdad97a7d44e6af7f969ff0fa143b821868222ac5c90c2983bf58b613bc9a23'

export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || DEFAULT_CONTRACT_ADDRESS
export const PLATFORM_ADDRESS = import.meta.env.VITE_PLATFORM_ADDRESS || DEFAULT_CONTRACT_ADDRESS
export const MODULE_NAME = 'cult'
export const APTOS_NETWORK = 'testnet'
export const OCTAS_PER_APT = 100_000_000

// Validate critical on-chain constants at startup (log errors, don't crash)
if (!/^0x[0-9a-f]{1,64}$/.test(CONTRACT_ADDRESS)) {
  console.error(`[CULT] Invalid CONTRACT_ADDRESS: "${CONTRACT_ADDRESS}". On-chain calls will fail.`)
}
if (!/^[a-z_]+$/.test(MODULE_NAME)) {
  console.error(`[CULT] Invalid MODULE_NAME: "${MODULE_NAME}". On-chain calls will fail.`)
}

export const CONTENT_TYPES = { VIDEO: 0, IMAGE: 1, AUDIO: 2, ARTICLE: 3 } as const

export const CONTENT_TYPE_LABELS: Record<number, string> = {
  0: 'Video', 1: 'Image', 2: 'Audio', 3: 'Article',
}

export const CONTENT_TYPE_ICONS: Record<number, string> = {
  0: '▶', 1: '◉', 2: '♪', 3: '✦',
}

export const ACCESS_LEVELS = {
  FREE: 0, TIER_1: 1, TIER_2: 2, TIER_3: 3, PURCHASE: 4,
} as const

export const ACCESS_LEVEL_LABELS: Record<number, string> = {
  0: 'Free', 1: 'Tier 1', 2: 'Tier 2', 3: 'Tier 3', 4: 'Purchase Only',
}

export const PLATFORM_FEE_PERCENT = 5
export const CREATOR_SHARE_PERCENT = 95
export const DEFAULT_TIER_NAMES = ['Fan', 'Member', 'Inner Circle']
