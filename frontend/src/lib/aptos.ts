import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk'
import { CONTRACT_ADDRESS, MODULE_NAME, OCTAS_PER_APT, PLATFORM_ADDRESS } from './constants'

export const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }))

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface NotificationItem {
  id: string
  kind: 'new_post'
  creatorAddr: string
  creatorHandle: string
  creatorName: string
  creatorAvatarCid: string
  contentId: number
  contentTitle: string
  accessLevel: number
  publishedAt: number
}

export interface Tier {
  name: string
  price_per_month: number
  description: string
}

export interface CreatorProfile {
  creator_addr: string
  handle: string
  display_name: string
  bio: string
  avatar_shelby_cid: string
  banner_shelby_cid: string
  tiers: Tier[]
  total_earned: number
  subscriber_count: number
  content_count: number
  created_at: number
}

export interface Content {
  id: number
  content_type: number
  title: string
  description: string
  shelby_cid: string
  thumbnail_shelby_cid: string
  access_level: number
  purchase_price: number
  published_at: number
  is_active: boolean
}

export interface SubscriptionStatus {
  isActive: boolean
  tierIndex: number
  expiresAt: number
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

// Return as string to avoid precision loss — Move expects u64 strings
export const usdToUnitsStr = (usd: number): string =>
  Math.floor(usd * OCTAS_PER_APT).toString()

export const unitsToUsd = (units: number): string =>
  (units / OCTAS_PER_APT).toFixed(2)

// ─── Read Functions ────────────────────────────────────────────────────────────

export async function getCreatorProfile(creatorAddr: string): Promise<CreatorProfile | null> {
  try {
    const resource = await aptos.getAccountResource({
      accountAddress: creatorAddr,
      resourceType: `${CONTRACT_ADDRESS}::${MODULE_NAME}::CreatorProfile`,
    })
    const profile = resource as unknown as CreatorProfile
    if (!profile?.handle) return null
    return profile
  } catch {
    return null
  }
}

export async function getCreatorAddressByHandle(handle: string): Promise<string | null> {
  const normalized = handle.trim().toLowerCase().replace(/^@/, '')
  if (!normalized) return null

  try {
    const result = await aptos.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::get_creator_by_handle`,
        typeArguments: [],
        functionArguments: [normalized],
      },
    })

    const addr = result?.[0] as string
    if (addr && addr !== '0x0') return addr
  } catch (e) {
    console.warn('Direct handle lookup failed, falling back to full list', e)
  }

  // Fallback: fetch all creators and search (more reliable indexer)
  try {
    const creators = await getAllCreators()
    const found = creators.find(c => c.handle.toLowerCase() === normalized)
    return found ? found.address : null
  } catch (e) {
    console.error('Fallback indexer failed', e)
    return null
  }
}

export async function getCreatorContent(creatorAddr: string): Promise<Content[]> {
  try {
    const resource = await aptos.getAccountResource({
      accountAddress: creatorAddr,
      resourceType: `${CONTRACT_ADDRESS}::${MODULE_NAME}::ContentStore`,
    })
    const store = resource as unknown as { contents: Content[] }
    return store.contents.filter((c) => c.is_active)
  } catch {
    return []
  }
}

export async function getSubscriptionStatus(
  fanAddr: string,
  creatorAddr: string,
): Promise<SubscriptionStatus> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::has_active_subscription`,
        typeArguments: [],
        functionArguments: [fanAddr, creatorAddr],
      },
    })
    const [isActive, tierIndex, expiresAt] = result as [boolean, number, number]
    return { isActive, tierIndex, expiresAt }
  } catch {
    return { isActive: false, tierIndex: 0, expiresAt: 0 }
  }
}

export async function hasPurchasedContent(
  fanAddr: string,
  creatorAddr: string,
  contentId: number,
): Promise<boolean> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::has_purchased_content`,
        typeArguments: [],
        functionArguments: [fanAddr, creatorAddr, contentId.toString()],
      },
    })
    return result[0] as boolean
  } catch {
    return false
  }
}

export async function canAccessContent(
  fanAddr: string,
  creatorAddr: string,
  contentId: number,
): Promise<boolean> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::can_access_content`,
        typeArguments: [],
        functionArguments: [fanAddr, creatorAddr, contentId.toString()],
      },
    })
    return result[0] as boolean
  } catch {
    return false
  }
}

// ─── Transaction Payloads ──────────────────────────────────────────────────────
// NOTE: All integer arguments must be strings for the Aptos SDK serializer

export function buildRegisterCreatorPayload(params: {
  handle: string
  displayName: string
  bio: string
  avatarCid: string
  bannerCid: string
  tiers: Array<{ name: string; priceUsd: number; description: string }>
}) {
  const { handle, displayName, bio, avatarCid, bannerCid, tiers } = params

  const tier1 = tiers[0] || { name: '', priceUsd: 0, description: '' }
  const tier2 = tiers[1] || { name: '', priceUsd: 0, description: '' }
  const tier3 = tiers[2] || { name: '', priceUsd: 0, description: '' }

  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::register_creator` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [
      handle,
      displayName,
      bio,
      avatarCid,
      bannerCid,
      tier1.name,
      usdToUnitsStr(tier1.priceUsd),
      tier1.description,
      tier2.name,
      usdToUnitsStr(tier2.priceUsd),
      tier2.description,
      tier3.name,
      usdToUnitsStr(tier3.priceUsd),
      tier3.description,
    ],
  }
}

export function buildPublishContentPayload(params: {
  contentType: number
  title: string
  description: string
  shelbyCid: string
  thumbnailCid: string
  accessLevel: number
  purchasePriceUsd: number
}) {
  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::publish_content` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [
      params.contentType,
      params.title,
      params.description,
      params.shelbyCid,
      params.thumbnailCid,
      params.accessLevel,
      usdToUnitsStr(params.purchasePriceUsd),
    ],
  }
}

export function buildEditContentPayload(params: {
  contentId: number
  title: string
  description: string
  shelbyCid: string
  thumbnailCid: string
  accessLevel: number
  purchasePriceUsd: number
}) {
  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::edit_content` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [
      params.contentId.toString(),
      params.title,
      params.description,
      params.shelbyCid,
      params.thumbnailCid,
      params.accessLevel,
      usdToUnitsStr(params.purchasePriceUsd),
    ],
  }
}

export function buildSubscribePayload(creatorAddr: string, tierIndex: number) {
  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::subscribe` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [creatorAddr, tierIndex.toString(), PLATFORM_ADDRESS],
  }
}

export function buildPurchaseContentPayload(creatorAddr: string, contentId: number) {
  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::purchase_content` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [creatorAddr, contentId.toString(), PLATFORM_ADDRESS],
  }
}

export function buildTipPayload(creatorAddr: string, amountUsd: number, message: string) {
  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::tip_creator` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [creatorAddr, usdToUnitsStr(amountUsd), message, PLATFORM_ADDRESS],
  }
}

export function buildUpdateTiersPayload(params: {
  tiers: Array<{ name: string; priceUsd: number; description: string }>
}) {
  const tier1 = params.tiers[0] || { name: '', priceUsd: 0, description: '' }
  const tier2 = params.tiers[1] || { name: '', priceUsd: 0, description: '' }
  const tier3 = params.tiers[2] || { name: '', priceUsd: 0, description: '' }

  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::update_tiers` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [
      tier1.name,
      usdToUnitsStr(tier1.priceUsd),
      tier1.description,
      tier2.name,
      usdToUnitsStr(tier2.priceUsd),
      tier2.description,
      tier3.name,
      usdToUnitsStr(tier3.priceUsd),
      tier3.description,
    ],
  }
}

// ─── Indexer: fetch all creator profiles ─────────────────────────────────────

export interface IndexedCreator {
  address: string
  handle: string
  display_name: string
  bio: string
  avatar_shelby_cid: string
  banner_shelby_cid: string
  subscriber_count: number
  content_count: number
  total_earned: number
  tiers: Tier[]
  created_at: number
}

export async function getAllCreators(): Promise<IndexedCreator[]> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::get_all_creators`,
        typeArguments: [],
        functionArguments: [],
      },
    })

    const creatorAddresses = ((result?.[0] as string[]) || []).filter(Boolean)

    if (creatorAddresses.length === 0) {
      return []
    }

    const profiles = await Promise.all(
      creatorAddresses.map(async (address) => {
        try {
          const [profile, contents] = await Promise.all([
            getCreatorProfile(address),
            getCreatorContent(address),
          ])
          if (!profile) return null

          return {
            address,
            handle: profile.handle,
            display_name: profile.display_name,
            bio: profile.bio,
            avatar_shelby_cid: profile.avatar_shelby_cid,
            banner_shelby_cid: profile.banner_shelby_cid,
            subscriber_count: profile.subscriber_count,
            content_count: contents.length,
            total_earned: profile.total_earned,
            tiers: profile.tiers,
            created_at: profile.created_at,
          }
        } catch (err) {
          console.error(`Failed to load creator profile for ${address}:`, err)
          return null
        }
      })
    )

    return profiles.filter((p): p is IndexedCreator => p !== null)
  } catch (error) {
    console.error('getAllCreators error:', error)
    return []
  }
}

export async function findCreatorByHandle(handle: string): Promise<IndexedCreator | null> {
  const normalized = handle.trim().toLowerCase().replace(/^@/, '')
  if (!normalized) return null

  const creators = await getAllCreators()
  const found = creators.find((creator) => creator.handle.toLowerCase() === normalized)
  if (found) return found

  await new Promise((resolve) => setTimeout(resolve, 400))
  const retryCreators = await getAllCreators()
  return retryCreators.find((creator) => creator.handle.toLowerCase() === normalized) || null
}

export function buildToggleContentPayload(contentId: number) {
  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::toggle_content` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [contentId.toString()],
  }
}
export function buildDeleteCreatorPayload() {
  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::delete_creator` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [],
  }
}

// ─── Follow / Unfollow ────────────────────────────────────────────────────────

export function buildFollowPayload(creatorAddr: string) {
  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::follow_creator` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [creatorAddr],
  }
}

export function buildUnfollowPayload(creatorAddr: string) {
  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::unfollow_creator` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [creatorAddr],
  }
}

// ─── ADD THESE to src/lib/aptos.ts ────────────────────────────────────────────
// Paste after the existing buildUnfollowPayload / isFollowing functions

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CommentItem {
  id: number
  fanAddr: string
  contentId: number
  text: string
  postedAt: number
}

// ── Love ───────────────────────────────────────────────────────────────────────

export function buildLoveContentPayload(creatorAddr: string, contentId: number) {
  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::love_content` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [creatorAddr, contentId.toString()],
  }
}

export function buildUnloveContentPayload(contentId: number) {
  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::unlove_content` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [contentId.toString()],
  }
}

export async function hasLovedContent(
  fanAddr: string,
  contentId: number,
): Promise<boolean> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::has_loved_content`,
        typeArguments: [],
        functionArguments: [fanAddr, contentId.toString()],
      },
    })
    return result[0] as boolean
  } catch {
    return false
  }
}

// ── Comments ───────────────────────────────────────────────────────────────────

export function buildPostCommentPayload(
  creatorAddr: string,
  contentId: number,
  text: string,
) {
  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::post_comment` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [creatorAddr, contentId.toString(), text],
  }
}

export function buildDeleteCommentPayload(creatorAddr: string, contentId: number, commentId: number) {
  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::delete_comment_v2`,
    typeArguments: [],
    functionArguments: [creatorAddr, contentId.toString(), commentId.toString()],
  }
}


export async function getFanComments(
  fanAddr: string,
  contentId: number,
): Promise<CommentItem[]> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::get_fan_comments`,
        typeArguments: [],
        functionArguments: [fanAddr, contentId.toString()],
      },
    })
    const raw = result[0] as Array<{
      id: string
      fan_addr: string
      content_id: string
      text: string
      posted_at: string
    }>
    return raw.map((c) => ({
      id: Number(c.id),
      fanAddr: c.fan_addr,
      contentId: Number(c.content_id),
      text: c.text,
      postedAt: Number(c.posted_at),
    }))
  } catch {
    return []
  }
}

// Fetch comments from all followers of this creator for a content post.
// Since comments are stored per-fan, we need to query each fan address.
// For the MVP we query the current user's own comments + passed fan addresses.
export async function getCommentsForContent(
  fanAddresses: string[],
  contentId: number,
): Promise<CommentItem[]> {
  try {
    const all = await Promise.all(
      fanAddresses.map((addr) => getFanComments(addr, contentId))
    )
    return all.flat().sort((a, b) => a.postedAt - b.postedAt)
  } catch {
    return []
  }
}

export async function isFollowing(fanAddr: string, creatorAddr: string): Promise<boolean> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::is_following`,
        typeArguments: [],
        functionArguments: [fanAddr, creatorAddr],
      },
    })
    return result[0] as boolean
  } catch {
    return false
  }
}

export async function getPostNotificationsForFan(fanAddr: string): Promise<NotificationItem[]> {
  try {
    const following = await getFollowing(fanAddr)
    if (!following.length) return []

    const all = await Promise.all(
      following.map(async (creatorAddr) => {
        try {
          const [creator, contents] = await Promise.all([
            getCreatorProfile(creatorAddr),
            getCreatorContent(creatorAddr),
          ])

          if (!creator) return []

          return contents.map((content) => ({
            id: `${creatorAddr}-${content.id}`,
            kind: 'new_post' as const,
            creatorAddr,
            creatorHandle: creator.handle,
            creatorName: creator.display_name,
            creatorAvatarCid: creator.avatar_shelby_cid,
            contentId: content.id,
            contentTitle: content.title,
            accessLevel: content.access_level,
            publishedAt: content.published_at,
          }))
        } catch {
          return []
        }
      })
    )

    return all.flat().sort((a, b) => b.publishedAt - a.publishedAt)
  } catch {
    return []
  }
}

export async function getRecentNotifications(fanAddr: string, limit = 10): Promise<NotificationItem[]> {
  try {
    const all = await getPostNotificationsForFan(fanAddr)
    return all.slice(0, limit)
  } catch {
    return []
  }
}

export async function getFollowing(fanAddr: string): Promise<string[]> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::get_following`,
        typeArguments: [],
        functionArguments: [fanAddr],
      },
    })
    return result[0] as string[]
  } catch {
    return []
  }
}

export async function getFollowerCount(creatorAddr: string): Promise<number> {
  // Query indexer for accounts that have creatorAddr in their FollowStore
  try {
    const response = await fetch('https://api.testnet.aptoslabs.com/v1/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': import.meta.env.VITE_APTOS_API_KEY || '',
      },
      body: JSON.stringify({
        query: `
          query GetFollowerCount {
            events(
              where: {
                type: { _eq: "${CONTRACT_ADDRESS}::${MODULE_NAME}::FollowEvent" }
                data: { _contains: { creator_addr: "${creatorAddr}" } }
              }
            ) {
              aggregate { count }
            }
          }
        `,
      }),
    })
    const json = await response.json()
    return json?.data?.events?.aggregate?.count || 0
  } catch {
    return 0
  }
}