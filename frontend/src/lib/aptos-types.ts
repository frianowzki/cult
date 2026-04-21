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
  isRead?: boolean
}

export interface CommentActivityItem {
  id: string
  creatorAddr: string
  creatorHandle: string
  creatorName: string
  creatorAvatarCid: string
  contentId: number
  contentTitle: string
  text: string
  postedAt: number
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

export interface UserProfile {
  user_addr: string
  handle: string
  display_name: string
  bio: string
  avatar_shelby_cid: string
  created_at: number
  updated_at: number
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
  scheduled_for: number
  is_draft: boolean
  is_active: boolean
}

export interface SubscriptionStatus {
  isActive: boolean
  tierIndex: number
  expiresAt: number
}

export interface LegacySubscriptionRecord {
  creator_addr: string
  tier_index: number
  expires_at: number
  subscribed_at: number
}

export interface LegacyPurchaseRecord {
  creator_addr: string
  content_id: number
  purchased_at: number
}

export interface IndexedContentSearchItem {
  id: number
  title: string
  description: string
  content_type: number
  access_level: number
  purchase_price: number
  published_at: number
  thumbnail_shelby_cid: string
}

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
  searchable_content: IndexedContentSearchItem[]
}

export interface PurchaseHistoryItem {
  kind: number
  counterparty_addr: string
  content_id: number
  tier_index: number
  amount_paid: number
  timestamp: number
  expires_at: number
}

export interface SaveRecord {
  creator_addr: string
  content_id: number
  saved_at: number
}

export interface CommentItem {
  id: number
  fanAddr: string
  contentId: number
  text: string
  postedAt: number
}
