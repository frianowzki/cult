import { CONTRACT_ADDRESS, MODULE_NAME, OCTAS_PER_APT } from './constants'
import { aptos } from './aptos-core'
import type {
  CommentActivityItem,
  CommentItem,
  Content,
  CreatorProfile,
  IndexedCreator,
  LegacyPurchaseRecord,
  LegacySubscriptionRecord,
  NotificationItem,
  PurchaseHistoryItem,
  SaveRecord,
  SubscriptionStatus,
  UserProfile,
} from './aptos-types'

function sanitizeAddr(addr: string): string {
  const cleaned = addr.trim().toLowerCase()
  if (!/^0x[0-9a-f]{1,64}$/.test(cleaned)) {
    throw new Error(`Invalid address: ${addr}`)
  }
  return cleaned
}

export const unitsToUsd = (units: number): string =>
  (units / OCTAS_PER_APT).toFixed(2)

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

export async function getUserProfile(userAddr: string): Promise<UserProfile | null> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::get_user_profile`,
        typeArguments: [],
        functionArguments: [userAddr],
      },
    })

    const profile = result?.[0] as UserProfile | undefined
    if (!profile?.display_name) return null
    return profile
  } catch {
    return null
  }
}

export async function resolveDisplayIdentity(userAddr: string): Promise<{ name: string | null; avatarCid: string | null; kind: 'creator' | 'user' | 'address' }> {
  const creator = await getCreatorProfile(userAddr)
  if (creator) {
    return {
      name: creator.display_name || creator.handle || null,
      avatarCid: creator.avatar_shelby_cid || null,
      kind: 'creator',
    }
  }

  const user = await getUserProfile(userAddr)
  if (user) {
    return {
      name: user.display_name || null,
      avatarCid: user.avatar_shelby_cid || null,
      kind: 'user',
    }
  }

  return {
    name: null,
    avatarCid: null,
    kind: 'address',
  }
}

const CREATOR_CACHE_KEY = 'cult:getAllCreators:v1'
const CREATOR_CACHE_TTL_MS = 60 * 1000

function readCreatorCache(): IndexedCreator[] | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.sessionStorage.getItem(CREATOR_CACHE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as { timestamp: number; data: IndexedCreator[] }
    if (!parsed?.timestamp || !Array.isArray(parsed?.data)) return null
    if (Date.now() - parsed.timestamp > CREATOR_CACHE_TTL_MS) return null

    return parsed.data
  } catch {
    return null
  }
}

function writeCreatorCache(data: IndexedCreator[]) {
  if (typeof window === 'undefined') return

  try {
    window.sessionStorage.setItem(
      CREATOR_CACHE_KEY,
      JSON.stringify({ timestamp: Date.now(), data })
    )
  } catch {}
}

export function clearCreatorCache() {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(CREATOR_CACHE_KEY)
  } catch {}
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

export async function getSubscriptionStatus(fanAddr: string, creatorAddr: string): Promise<SubscriptionStatus> {
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

export async function hasPurchasedContent(fanAddr: string, creatorAddr: string, contentId: number): Promise<boolean> {
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

export async function canAccessContent(fanAddr: string, creatorAddr: string, contentId: number): Promise<boolean> {
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

export async function getAllCreators(forceRefresh = false): Promise<IndexedCreator[]> {
  const cached = !forceRefresh ? readCreatorCache() : null
  if (cached) return cached

  try {
    const fetchCreators = async () => {
      const result = await aptos.view({
        payload: {
          function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::get_all_creators`,
          typeArguments: [],
          functionArguments: [],
        },
      })

      const creatorAddresses = ((result?.[0] as string[]) || []).filter(Boolean)
      if (creatorAddresses.length === 0) return []

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
              searchable_content: contents.map((content) => ({
                id: content.id,
                title: content.title,
                description: content.description,
                content_type: content.content_type,
                access_level: content.access_level,
                purchase_price: content.purchase_price,
                published_at: content.published_at,
                thumbnail_shelby_cid: content.thumbnail_shelby_cid,
              })),
            }
          } catch (err) {
            console.error(`Failed to load creator profile for ${address}:`, err)
            return null
          }
        })
      )

      return profiles.filter((p): p is IndexedCreator => p !== null)
    }

    const first = await fetchCreators()
    if (first.length > 0) {
      writeCreatorCache(first)
      return first
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
    const second = await fetchCreators()
    if (second.length > 0) {
      writeCreatorCache(second)
      return second
    }

    if (cached) return cached
    writeCreatorCache([])
    return []
  } catch (error) {
    console.error('getAllCreators error:', error)
    if (cached) return cached
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
  const retryCreators = await getAllCreators(true)
  return retryCreators.find((creator) => creator.handle.toLowerCase() === normalized) || null
}

export async function hasLovedContent(fanAddr: string, contentId: number): Promise<boolean> {
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

export async function hasGlobalCommentStore(creatorAddr: string): Promise<boolean> {
  try {
    await aptos.getAccountResource({
      accountAddress: creatorAddr,
      resourceType: `${CONTRACT_ADDRESS}::${MODULE_NAME}::GlobalCommentStore`,
    })
    return true
  } catch {
    return false
  }
}

export async function getFanComments(fanAddr: string, contentId: number): Promise<CommentItem[]> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::get_fan_comments`,
        typeArguments: [],
        functionArguments: [fanAddr, contentId.toString()],
      },
    })
    const raw = result[0] as Array<{ id: string; fan_addr: string; content_id: string; text: string; posted_at: string }>
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

export async function getCommentsForContent(creatorAddr: string, contentId: number): Promise<CommentItem[]> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::get_comments_for_content`,
        typeArguments: [],
        functionArguments: [creatorAddr, contentId.toString()],
      },
    })

    const raw = result[0] as Array<{ id: string; fan_addr: string; content_id: string; text: string; posted_at: string }>

    return raw.map((c) => ({
      id: Number(c.id),
      fanAddr: c.fan_addr,
      contentId: Number(c.content_id),
      text: c.text,
      postedAt: Number(c.posted_at),
    })).sort((a, b) => a.postedAt - b.postedAt)
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

export async function getLegacyFanSubscriptions(fanAddr: string): Promise<LegacySubscriptionRecord[]> {
  try {
    const resource = await aptos.getAccountResource({
      accountAddress: fanAddr,
      resourceType: `${CONTRACT_ADDRESS}::${MODULE_NAME}::FanSubscriptions`,
    })
    return ((resource as { subscriptions?: LegacySubscriptionRecord[] })?.subscriptions || [])
  } catch {
    return []
  }
}

export async function getLegacyFanPurchases(fanAddr: string): Promise<LegacyPurchaseRecord[]> {
  try {
    const resource = await aptos.getAccountResource({
      accountAddress: fanAddr,
      resourceType: `${CONTRACT_ADDRESS}::${MODULE_NAME}::FanPurchases`,
    })
    return ((resource as { purchases?: LegacyPurchaseRecord[] })?.purchases || [])
  } catch {
    return []
  }
}

export async function getLegacyFanHistoryFromEvents(fanAddr: string): Promise<PurchaseHistoryItem[]> {
  try {
    const response = await fetch('https://api.testnet.aptoslabs.com/v1/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': import.meta.env.VITE_APTOS_API_KEY || '',
      },
      body: JSON.stringify({
        query: `
          query GetLegacyFanHistory {
            subscriptions: events(
              where: {
                type: { _eq: "${CONTRACT_ADDRESS}::${MODULE_NAME}::SubscribeEvent" }
                data: { _contains: { fan_addr: "${sanitizeAddr(fanAddr)}" } }
              }
              order_by: { transaction_version: desc }
              limit: 100
            ) {
              data
            }
            purchases: events(
              where: {
                type: { _eq: "${CONTRACT_ADDRESS}::${MODULE_NAME}::PurchaseEvent" }
                data: { _contains: { fan_addr: "${sanitizeAddr(fanAddr)}" } }
              }
              order_by: { transaction_version: desc }
              limit: 100
            ) {
              data
            }
          }
        `,
      }),
    })

    const json = await response.json()
    const subscriptions = (json?.data?.subscriptions || []).map((event: any) => ({
      kind: 0,
      counterparty_addr: event.data?.creator_addr || '',
      content_id: 0,
      tier_index: Number(event.data?.tier_index ?? 0),
      amount_paid: Number(event.data?.amount_paid ?? 0),
      timestamp: Number(event.data?.expires_at ?? 0) > 0 ? Number(event.data.expires_at) - 30 * 24 * 60 * 60 : 0,
      expires_at: Number(event.data?.expires_at ?? 0),
    }))

    const purchases = (json?.data?.purchases || []).map((event: any) => ({
      kind: 1,
      counterparty_addr: event.data?.creator_addr || '',
      content_id: Number(event.data?.content_id ?? 0),
      tier_index: 255,
      amount_paid: Number(event.data?.amount_paid ?? 0),
      timestamp: 0,
      expires_at: 0,
    }))

    return [...subscriptions, ...purchases]
  } catch {
    return []
  }
}

export async function getFanPurchaseHistory(fanAddr: string): Promise<PurchaseHistoryItem[]> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::get_fan_purchase_history`,
        typeArguments: [],
        functionArguments: [fanAddr],
      },
    })
    return (result?.[0] as PurchaseHistoryItem[]) || []
  } catch {
    return []
  }
}

export async function getCreatorPurchaseHistory(creatorAddr: string): Promise<PurchaseHistoryItem[]> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::get_creator_purchase_history`,
        typeArguments: [],
        functionArguments: [creatorAddr],
      },
    })
    return (result?.[0] as PurchaseHistoryItem[]) || []
  } catch {
    return []
  }
}

export function buildSaveContentPayload(creatorAddr: string, contentId: number) {
  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::save_content` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [creatorAddr, contentId.toString()],
  }
}

export function buildUnsaveContentPayload(creatorAddr: string, contentId: number) {
  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::unsave_content` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [creatorAddr, contentId.toString()],
  }
}

export async function hasSavedContent(fanAddr: string, creatorAddr: string, contentId: number): Promise<boolean> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::has_saved_content`,
        typeArguments: [],
        functionArguments: [fanAddr, creatorAddr, contentId.toString()],
      },
    })
    return Boolean(result?.[0])
  } catch {
    return false
  }
}

export async function getSavedContent(fanAddr: string): Promise<SaveRecord[]> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::get_saved_content`,
        typeArguments: [],
        functionArguments: [fanAddr],
      },
    })
    return (result?.[0] as SaveRecord[]) || []
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
            id: `post-${creatorAddr}-${content.id}`,
            kind: 'new_post' as const,
            creatorAddr,
            creatorHandle: creator.handle,
            creatorName: creator.display_name,
            creatorAvatarCid: creator.avatar_shelby_cid,
            contentId: content.id,
            contentTitle: content.title,
            accessLevel: content.access_level,
            createdAt: content.published_at,
            publishedAt: content.published_at,
          }))
        } catch {
          return []
        }
      })
    )

    return all.flat().sort((a, b) => b.createdAt - a.createdAt)
  } catch {
    return []
  }
}

export async function getRecentCommentActivityForFan(fanAddr: string, limit = 8): Promise<CommentActivityItem[]> {
  try {
    const following = await getFollowing(fanAddr)
    if (!following.length) return []

    const activity = await Promise.all(
      following.map(async (creatorAddr) => {
        try {
          const [creator, contents] = await Promise.all([
            getCreatorProfile(creatorAddr),
            getCreatorContent(creatorAddr),
          ])

          if (!creator || contents.length === 0) return []

          const commentLists = await Promise.all(
            contents.map(async (content) => {
              const comments = await getCommentsForContent(creatorAddr, content.id)
              return comments
                .filter((comment) => comment.fanAddr === fanAddr)
                .map((comment) => ({
                  id: `${creatorAddr}-${content.id}-${comment.id}`,
                  creatorAddr,
                  creatorHandle: creator.handle,
                  creatorName: creator.display_name,
                  creatorAvatarCid: creator.avatar_shelby_cid,
                  contentId: content.id,
                  contentTitle: content.title,
                  text: comment.text,
                  postedAt: comment.postedAt,
                }))
            })
          )

          return commentLists.flat()
        } catch {
          return []
        }
      })
    )

    return activity.flat().sort((a, b) => b.postedAt - a.postedAt).slice(0, limit)
  } catch {
    return []
  }
}

function getNotificationSeenKey(fanAddr: string) {
  return `cult:notifications:lastSeen:${fanAddr.toLowerCase()}`
}

export function getLastNotificationsSeenAt(fanAddr: string): number {
  if (typeof window === 'undefined') return 0
  try {
    return Number(window.localStorage.getItem(getNotificationSeenKey(fanAddr)) || '0') || 0
  } catch {
    return 0
  }
}

export function markNotificationsSeen(fanAddr: string, timestamp?: number) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(getNotificationSeenKey(fanAddr), String(timestamp || Date.now()))
  } catch {}
}

async function queryNotificationEvents(query: string) {
  const response = await fetch('https://api.testnet.aptoslabs.com/v1/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_APTOS_API_KEY || '',
    },
    body: JSON.stringify({ query }),
  })
  const json = await response.json()
  return json?.data || {}
}

export async function getActivityNotificationsForCreator(creatorAddr: string): Promise<NotificationItem[]> {
  try {
    const [creator, contents, data] = await Promise.all([
      getCreatorProfile(creatorAddr),
      getCreatorContent(creatorAddr),
      queryNotificationEvents(`
        query GetCreatorActivityNotifications {
          subscriptions: events(
            where: {
              type: { _eq: "${CONTRACT_ADDRESS}::${MODULE_NAME}::SubscribeEvent" }
              data: { _contains: { creator_addr: "${sanitizeAddr(creatorAddr)}" } }
            }
            order_by: { transaction_version: desc }
            limit: 40
          ) { data event_index transaction_version }
          purchases: events(
            where: {
              type: { _eq: "${CONTRACT_ADDRESS}::${MODULE_NAME}::PurchaseEvent" }
              data: { _contains: { creator_addr: "${sanitizeAddr(creatorAddr)}" } }
            }
            order_by: { transaction_version: desc }
            limit: 40
          ) { data event_index transaction_version }
          follows: events(
            where: {
              type: { _eq: "${CONTRACT_ADDRESS}::${MODULE_NAME}::FollowEvent" }
              data: { _contains: { creator_addr: "${sanitizeAddr(creatorAddr)}" } }
            }
            order_by: { transaction_version: desc }
            limit: 40
          ) { data event_index transaction_version }
          comments: events(
            where: {
              type: { _eq: "${CONTRACT_ADDRESS}::${MODULE_NAME}::CommentEvent" }
              data: { _contains: { creator_addr: "${sanitizeAddr(creatorAddr)}" } }
            }
            order_by: { transaction_version: desc }
            limit: 40
          ) { data event_index transaction_version }
          loves: events(
            where: {
              type: { _eq: "${CONTRACT_ADDRESS}::${MODULE_NAME}::LoveEvent" }
              data: { _contains: { creator_addr: "${sanitizeAddr(creatorAddr)}" } }
            }
            order_by: { transaction_version: desc }
            limit: 40
          ) { data event_index transaction_version }
        }
      `),
    ])

    if (!creator) return []

    const contentMap = new Map(contents.map((content) => [content.id, content]))
    const identityCache = new Map<string, Awaited<ReturnType<typeof resolveDisplayIdentity>>>()
    const getIdentity = async (addr: string) => {
      if (!addr) return null
      if (!identityCache.has(addr)) {
        identityCache.set(addr, await resolveDisplayIdentity(addr))
      }
      return identityCache.get(addr) || null
    }
    const versionToTimestamp = (value: unknown) => {
      const version = Number(value ?? 0)
      return version > 0 ? version : 0
    }

    const subscriptions = await Promise.all(((data?.subscriptions || []) as any[]).map(async (event) => {
      const actorAddr = event.data?.fan_addr || ''
      const identity = await getIdentity(actorAddr)
      return {
        id: `sub-${event.transaction_version}-${event.event_index}`,
        kind: 'new_subscriber' as const,
        creatorAddr,
        creatorHandle: creator.handle,
        creatorName: creator.display_name,
        creatorAvatarCid: creator.avatar_shelby_cid,
        actorAddr,
        actorName: identity?.name || undefined,
        actorAvatarCid: identity?.avatarCid || undefined,
        tierIndex: Number(event.data?.tier_index ?? 0),
        amountPaid: Number(event.data?.amount_paid ?? 0),
        createdAt: versionToTimestamp(event.transaction_version),
      }
    }))

    const purchases = await Promise.all(((data?.purchases || []) as any[]).map(async (event) => {
      const actorAddr = event.data?.fan_addr || ''
      const contentId = Number(event.data?.content_id ?? 0)
      const identity = await getIdentity(actorAddr)
      const content = contentMap.get(contentId)
      return {
        id: `purchase-${event.transaction_version}-${event.event_index}`,
        kind: 'new_purchase' as const,
        creatorAddr,
        creatorHandle: creator.handle,
        creatorName: creator.display_name,
        creatorAvatarCid: creator.avatar_shelby_cid,
        actorAddr,
        actorName: identity?.name || undefined,
        actorAvatarCid: identity?.avatarCid || undefined,
        contentId,
        contentTitle: content?.title || `Post #${contentId}`,
        amountPaid: Number(event.data?.amount_paid ?? 0),
        createdAt: versionToTimestamp(event.transaction_version),
      }
    }))

    const follows = await Promise.all(((data?.follows || []) as any[]).map(async (event) => {
      const actorAddr = event.data?.fan_addr || ''
      const identity = await getIdentity(actorAddr)
      return {
        id: `follow-${event.transaction_version}-${event.event_index}`,
        kind: 'new_follower' as const,
        creatorAddr,
        creatorHandle: creator.handle,
        creatorName: creator.display_name,
        creatorAvatarCid: creator.avatar_shelby_cid,
        actorAddr,
        actorName: identity?.name || undefined,
        actorAvatarCid: identity?.avatarCid || undefined,
        createdAt: versionToTimestamp(event.transaction_version),
      }
    }))

    const comments = await Promise.all(((data?.comments || []) as any[]).map(async (event) => {
      const actorAddr = event.data?.fan_addr || ''
      const contentId = Number(event.data?.content_id ?? 0)
      const identity = await getIdentity(actorAddr)
      const content = contentMap.get(contentId)
      return {
        id: `comment-${event.transaction_version}-${event.event_index}`,
        kind: 'new_comment' as const,
        creatorAddr,
        creatorHandle: creator.handle,
        creatorName: creator.display_name,
        creatorAvatarCid: creator.avatar_shelby_cid,
        actorAddr,
        actorName: identity?.name || undefined,
        actorAvatarCid: identity?.avatarCid || undefined,
        contentId,
        contentTitle: content?.title || `Post #${contentId}`,
        commentText: event.data?.comment || event.data?.text || '',
        createdAt: versionToTimestamp(event.transaction_version),
      }
    }))

    const loves = await Promise.all(((data?.loves || []) as any[]).map(async (event) => {
      const actorAddr = event.data?.fan_addr || ''
      const contentId = Number(event.data?.content_id ?? 0)
      const identity = await getIdentity(actorAddr)
      const content = contentMap.get(contentId)
      return {
        id: `love-${event.transaction_version}-${event.event_index}`,
        kind: 'new_love' as const,
        creatorAddr,
        creatorHandle: creator.handle,
        creatorName: creator.display_name,
        creatorAvatarCid: creator.avatar_shelby_cid,
        actorAddr,
        actorName: identity?.name || undefined,
        actorAvatarCid: identity?.avatarCid || undefined,
        contentId,
        contentTitle: content?.title || `Post #${contentId}`,
        createdAt: versionToTimestamp(event.transaction_version),
      }
    }))

    return [...subscriptions, ...purchases, ...follows, ...comments, ...loves].sort((a, b) => b.createdAt - a.createdAt)
  } catch {
    return []
  }
}

function groupNotifications(items: NotificationItem[]): NotificationItem[] {
  const grouped = new Map<string, NotificationItem[]>()

  for (const item of items) {
    const key = `${item.kind}:${item.creatorAddr}:${item.contentId ?? 'none'}`
    const bucket = grouped.get(key) || []
    bucket.push(item)
    grouped.set(key, bucket)
  }

  return Array.from(grouped.values()).map((bucket) => {
    if (bucket.length === 1) return bucket[0]
    const latest = bucket.sort((a, b) => b.createdAt - a.createdAt)[0]
    return {
      ...latest,
      id: `grouped-${latest.kind}-${latest.creatorAddr}-${latest.contentId ?? 'none'}`,
      kind: 'grouped' as const,
      groupedCount: bucket.length,
      groupedKinds: Array.from(new Set(bucket.map((item) => item.kind))),
    }
  }).sort((a, b) => b.createdAt - a.createdAt)
}

export async function getRecentNotifications(fanAddr: string, limit = 10): Promise<NotificationItem[]> {
  try {
    const [fanPostNotifications, creatorActivityNotifications] = await Promise.all([
      getPostNotificationsForFan(fanAddr),
      getActivityNotificationsForCreator(fanAddr),
    ])
    const all = groupNotifications([...creatorActivityNotifications, ...fanPostNotifications].sort((a, b) => b.createdAt - a.createdAt))
    const lastSeen = getLastNotificationsSeenAt(fanAddr)
    return all.slice(0, limit).map((item) => ({
      ...item,
      isRead: item.createdAt > 1000000000 ? item.createdAt * 1000 <= lastSeen : false,
    }))
  } catch {
    return []
  }
}

export async function getLegacyCreatorSalesHistory(creatorAddr: string): Promise<PurchaseHistoryItem[]> {
  try {
    const response = await fetch('https://api.testnet.aptoslabs.com/v1/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': import.meta.env.VITE_APTOS_API_KEY || '',
      },
      body: JSON.stringify({
        query: `
          query GetLegacyCreatorSales {
            subscriptions: events(
              where: {
                type: { _eq: "${CONTRACT_ADDRESS}::${MODULE_NAME}::SubscribeEvent" }
                data: { _contains: { creator_addr: "${sanitizeAddr(creatorAddr)}" } }
              }
              order_by: { transaction_version: desc }
              limit: 100
            ) {
              data
            }
            purchases: events(
              where: {
                type: { _eq: "${CONTRACT_ADDRESS}::${MODULE_NAME}::PurchaseEvent" }
                data: { _contains: { creator_addr: "${sanitizeAddr(creatorAddr)}" } }
              }
              order_by: { transaction_version: desc }
              limit: 100
            ) {
              data
            }
          }
        `,
      }),
    })

    const json = await response.json()
    const subscriptions = (json?.data?.subscriptions || []).map((event: any) => ({
      kind: 0,
      counterparty_addr: event.data?.fan_addr || '',
      content_id: 0,
      tier_index: Number(event.data?.tier_index ?? 0),
      amount_paid: Number(event.data?.amount_paid ?? 0),
      timestamp: Number(event.data?.expires_at ?? 0) > 0 ? Number(event.data.expires_at) - 30 * 24 * 60 * 60 : 0,
      expires_at: Number(event.data?.expires_at ?? 0),
    }))

    const purchases = (json?.data?.purchases || []).map((event: any) => ({
      kind: 1,
      counterparty_addr: event.data?.fan_addr || '',
      content_id: Number(event.data?.content_id ?? 0),
      tier_index: 255,
      amount_paid: Number(event.data?.amount_paid ?? 0),
      timestamp: 0,
      expires_at: 0,
    }))

    return [...subscriptions, ...purchases]
  } catch {
    return []
  }
}

export async function getFollowerCount(creatorAddr: string): Promise<number> {
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
                data: { _contains: { creator_addr: "${sanitizeAddr(creatorAddr)}" } }
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
