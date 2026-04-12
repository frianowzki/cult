export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '0xYOUR_DEPLOYED_ADDRESS'
export const PLATFORM_ADDRESS = import.meta.env.VITE_PLATFORM_ADDRESS || '0xYOUR_PLATFORM_ADDRESS'
export const MODULE_NAME = 'cult'
export const APTOS_NETWORK = 'testnet'
export const SHELBY_API_KEY = import.meta.env.VITE_SHELBY_API_KEY || ''
export const OCTAS_PER_APT = 100_000_000

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
