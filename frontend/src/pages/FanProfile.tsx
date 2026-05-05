import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { motion } from 'framer-motion'

import {
  getFollowing,
  getRecentCommentActivityForFan,
  getUserProfile,
  getCreatorProfile,
  getSubscriptionStatus,
  getFanPurchaseHistory,
  unitsToUsd,
  type CommentActivityItem,
  type CreatorProfile,
  type SubscriptionStatus,
  type PurchaseHistoryItem,
  type UserProfile,
} from '../lib/aptos'
import { ACCESS_LEVEL_LABELS } from '../lib/constants'
import { resolveContentUrl } from '../lib/shelby'
import UserProfileModal from '../components/UserProfileModal'
import { useStore } from '../lib/store'

interface SubscriptionEntry {
  creator: CreatorProfile
  status: SubscriptionStatus
}

export default function FanProfile() {
  const { address } = useParams<{ address: string }>()
  const { account } = useWallet()
  const theme = useStore((state) => state.theme)

  const normalizedAddress = (address || '').trim()
  const viewerAddress = String(account?.address || '')
  const isOwnProfile = !!viewerAddress && viewerAddress.toLowerCase() === normalizedAddress.toLowerCase()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [followingCount, setFollowingCount] = useState(0)
  const [supportedCreators, setSupportedCreators] = useState<CreatorProfile[]>([])
  const [recentComments, setRecentComments] = useState<CommentActivityItem[]>([])
  const [subscriptions, setSubscriptions] = useState<SubscriptionEntry[]>([])
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!normalizedAddress) {
      setLoading(false)
      return
    }
    void loadProfile()
  }, [normalizedAddress])

  async function loadProfile() {
    setLoading(true)
    try {
      const [profileData, following, comments] = await Promise.all([
        getUserProfile(normalizedAddress),
        getFollowing(normalizedAddress),
        getRecentCommentActivityForFan(normalizedAddress, 6),
      ])
      setProfile(profileData)
      setFollowingCount(following.length)
      setRecentComments(comments)

      const creatorProfiles = await Promise.all(
        following.slice(0, 6).map(async (creatorAddr) => getCreatorProfile(creatorAddr))
      )
      setSupportedCreators(creatorProfiles.filter((item): item is CreatorProfile => !!item))

      // Load subscription status for ALL followed creators (not just first 6)
      const [allCreatorProfiles, purchaseHistoryData] = await Promise.all([
        Promise.all(following.map(async (addr) => getCreatorProfile(addr))),
        getFanPurchaseHistory(normalizedAddress),
      ])
      setPurchaseHistory(purchaseHistoryData)

      const validCreators = allCreatorProfiles.filter((c): c is CreatorProfile => !!c)

      // Load subscription status in parallel for each creator
      const subStatuses = await Promise.all(
        validCreators.map(async (creator) => {
          const status = await getSubscriptionStatus(normalizedAddress, creator.creator_addr)
          return { creator, status }
        })
      )
      setSubscriptions(subStatuses)
    } catch (e) {
      console.error(e)
      setProfile(null)
      setFollowingCount(0)
      setSupportedCreators([])
      setRecentComments([])
      setSubscriptions([])
      setPurchaseHistory([])
    } finally {
      setLoading(false)
    }
  }

  function getDaysRemaining(expiresAt: number): number {
    const now = Math.floor(Date.now() / 1000)
    return Math.max(0, Math.ceil((expiresAt - now) / 86400))
  }

  function getRenewalBadgeColor(daysRemaining: number): string {
    if (daysRemaining > 7) return '#22c55e'   // green
    if (daysRemaining >= 3) return '#eab308'   // yellow
    return '#ef4444'                             // red
  }

  const activeSubscriptions = subscriptions.filter((s) => s.status.isActive)
  const expiredSubscriptions = subscriptions.filter((s) => !s.status.isActive && s.status.expiresAt > 0)

  // Spending summary
  const subscriptionPurchases = purchaseHistory.filter((p) => p.kind === 0)
  const oneTimePurchases = purchaseHistory.filter((p) => p.kind === 1)
  const totalSpent = purchaseHistory.reduce((sum, p) => sum + p.amount_paid, 0)

  const avatarUrl = profile?.avatar_shelby_cid ? resolveContentUrl(profile.avatar_shelby_cid) : ''
  const shortAddr = normalizedAddress
    ? `${normalizedAddress.slice(0, 6)}…${normalizedAddress.slice(-4)}`
    : ''

  if (loading) {
    return (
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '32px clamp(16px, 4vw, 32px)' }}>
        <div className="skeleton" style={{ height: 220, width: '100%', marginBottom: 20 }} />
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div className="skeleton" style={{ width: 88, height: 88, borderRadius: '50%' }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 22, width: 220, marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 12, width: 180 }} />
          </div>
        </div>
        <div className="skeleton" style={{ height: 160, width: '100%', marginTop: 20 }} />
      </div>
    )
  }

  if (!profile) {
    return (
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '72px 16px', textAlign: 'center' }}>
        <div className="section-eyebrow">Fan</div>
        <h2 style={{ marginBottom: 10 }}>Profile not found</h2>
        <p style={{ margin: '0 auto 18px' }}>This fan has not created a CULT profile yet.</p>
        {isOwnProfile && (
          <button className="btn btn-primary" onClick={() => setEditing(true)}>
            Create your profile
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '24px clamp(16px, 4vw, 32px) 28px' }}>
        {/* ── Profile Card ────────────────────────────────────────────── */}
        <div className="card" style={{ padding: '24px clamp(18px, 4vw, 32px) 28px', background: theme === 'light' ? 'linear-gradient(180deg, rgba(255,250,244,0.98) 0%, rgba(247,241,232,0.98) 100%)' : 'linear-gradient(180deg, rgba(20,18,17,0.96) 0%, rgba(13,12,11,0.98) 100%)', border: theme === 'light' ? '1px solid rgba(120,92,68,0.12)' : '1px solid rgba(255,255,255,0.08)', boxShadow: theme === 'light' ? '0 20px 48px rgba(103,78,58,0.08)' : '0 24px 60px rgba(0,0,0,0.28)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: theme === 'light' ? 'radial-gradient(circle at 16% 18%, rgba(254,119,201,0.08), transparent 26%), radial-gradient(circle at 82% 12%, rgba(254,119,201,0.05), transparent 22%)' : 'radial-gradient(circle at 16% 18%, rgba(254,119,201,0.14), transparent 26%), radial-gradient(circle at 82% 12%, rgba(254,119,201,0.08), transparent 22%)', pointerEvents: 'none' }} />

          <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ width: 88, height: 88, borderRadius: '50%', border: theme === 'light' ? '2px solid rgba(120,92,68,0.12)' : '2px solid rgba(255,255,255,0.08)', background: avatarUrl ? `url(${avatarUrl}) center/cover no-repeat` : 'linear-gradient(135deg, rgba(254,119,201,0.22), rgba(254,119,201,0.06))', boxShadow: theme === 'light' ? '0 10px 24px rgba(103,78,58,0.10)' : '0 10px 30px rgba(0,0,0,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: '1.8rem', overflow: 'hidden' }}>
                {!avatarUrl && (profile.display_name.charAt(0).toUpperCase() || '◌')}
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="section-eyebrow">Fan</div>
                <h2 style={{ marginBottom: 6, lineHeight: 1 }}>{profile.display_name}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: profile.bio ? 10 : 0 }}>
                  {profile.handle && <span className="badge mono" style={{ fontSize: 10 }}>@{profile.handle}</span>}
                  <span className="badge mono" style={{ fontSize: 10 }}>{shortAddr}</span>
                  {isOwnProfile && <span className="badge badge-accent">You</span>}
                </div>
                {profile.bio && (
                  <p style={{ maxWidth: 620, color: 'var(--text-2)', lineHeight: 1.7, margin: 0 }}>{profile.bio}</p>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {isOwnProfile && (
                <button className="btn btn-sm btn-primary" onClick={() => setEditing(true)}>
                  Edit profile
                </button>
              )}
              <Link className="btn btn-sm" to="/explore">Explore creators</Link>
            </div>
          </div>

          <div style={{ position: 'relative', display: 'flex', gap: 24, flexWrap: 'wrap', paddingTop: 18, borderTop: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--text)', lineHeight: 1 }}>{followingCount}</div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Following</div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--text)', lineHeight: 1 }}>{new Date(profile.created_at * 1000).getFullYear()}</div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Joined</div>
            </div>
          </div>
        </div>

        {/* ── Subscriptions Section ───────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          style={{ marginTop: 20 }}
        >
          <div className="card" style={{ padding: '22px clamp(18px, 4vw, 28px)' }}>
            <div className="section-eyebrow">Subscriptions</div>
            <h3 style={{ marginBottom: 4 }}>Active & recent subscriptions</h3>
            <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 16px' }}>
              {activeSubscriptions.length} active · {expiredSubscriptions.length} expired
            </p>

            {subscriptions.length === 0 ? (
              <p style={{ color: 'var(--text-3)' }}>No subscriptions yet. Explore creators to get started!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Active subscriptions first */}
                {activeSubscriptions.map(({ creator, status }) => {
                  const daysRemaining = getDaysRemaining(status.expiresAt)
                  const badgeColor = getRenewalBadgeColor(daysRemaining)
                  const tierName = creator.tiers[status.tierIndex]?.name || ACCESS_LEVEL_LABELS[status.tierIndex + 1] || `Tier ${status.tierIndex + 1}`
                  const tierPrice = creator.tiers[status.tierIndex]?.price_per_month
                  const creatorAvatar = creator.avatar_shelby_cid ? resolveContentUrl(creator.avatar_shelby_cid) : ''
                  const expiryDate = new Date(status.expiresAt * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

                  return (
                    <Link
                      key={creator.creator_addr}
                      to={`/u/${creator.handle}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '14px 16px',
                        borderRadius: 10,
                        background: 'var(--bg-2)',
                        border: '1px solid var(--border)',
                        textDecoration: 'none',
                        color: 'var(--text)',
                        transition: 'background 0.15s',
                      }}
                    >
                      <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: creatorAvatar ? `url(${creatorAvatar}) center/cover no-repeat` : 'var(--bg-3)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 16,
                        flexShrink: 0,
                      }}>
                        {!creatorAvatar && '✦'}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{creator.display_name}</span>
                          <span className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>@{creator.handle}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                          <span className="badge" style={{ fontSize: 10 }}>{tierName}</span>
                          {tierPrice != null && tierPrice > 0 && (
                            <span className="mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>
                              ${unitsToUsd(tierPrice)}/mo
                            </span>
                          )}
                          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                            Expires {expiryDate}
                          </span>
                        </div>
                      </div>

                      <div
                        className="badge"
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          background: `${badgeColor}18`,
                          color: badgeColor,
                          border: `1px solid ${badgeColor}30`,
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        Renews in {daysRemaining}d
                      </div>
                    </Link>
                  )
                })}

                {/* Expired subscriptions dimmed */}
                {expiredSubscriptions.map(({ creator, status }) => {
                  const tierName = creator.tiers[status.tierIndex]?.name || ACCESS_LEVEL_LABELS[status.tierIndex + 1] || `Tier ${status.tierIndex + 1}`
                  const creatorAvatar = creator.avatar_shelby_cid ? resolveContentUrl(creator.avatar_shelby_cid) : ''
                  const expiredDate = new Date(status.expiresAt * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

                  return (
                    <Link
                      key={creator.creator_addr}
                      to={`/u/${creator.handle}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '14px 16px',
                        borderRadius: 10,
                        background: 'var(--bg-2)',
                        border: '1px solid var(--border)',
                        textDecoration: 'none',
                        color: 'var(--text)',
                        opacity: 0.5,
                        transition: 'opacity 0.15s',
                      }}
                    >
                      <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: creatorAvatar ? `url(${creatorAvatar}) center/cover no-repeat` : 'var(--bg-3)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-3)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 16,
                        flexShrink: 0,
                      }}>
                        {!creatorAvatar && '✦'}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{creator.display_name}</span>
                          <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>@{creator.handle}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                          <span className="badge" style={{ fontSize: 10 }}>{tierName}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                            Expired {expiredDate}
                          </span>
                        </div>
                      </div>

                      <span
                        className="badge"
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'var(--text-3)',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        Expired
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Spending Summary Card ───────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          style={{ marginTop: 20 }}
        >
          <div className="card" style={{ padding: '22px clamp(18px, 4vw, 28px)' }}>
            <div className="section-eyebrow">Spending</div>
            <h3 style={{ marginBottom: 16 }}>Your spending summary</h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
              <div style={{ padding: '16px', borderRadius: 10, background: 'var(--bg-2)', border: '1px solid var(--border)', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text)', lineHeight: 1 }}>
                  ${unitsToUsd(totalSpent)}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Total Spent
                </div>
              </div>

              <div style={{ padding: '16px', borderRadius: 10, background: 'var(--bg-2)', border: '1px solid var(--border)', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--accent)', lineHeight: 1 }}>
                  {activeSubscriptions.length}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Active Subs
                </div>
              </div>

              <div style={{ padding: '16px', borderRadius: 10, background: 'var(--bg-2)', border: '1px solid var(--border)', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text)', lineHeight: 1 }}>
                  {oneTimePurchases.length}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  One-time Purchases
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Existing Grid: Supporting + Comments ────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 20, marginTop: 20 }}>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="card"
          >
            <div style={{ padding: '22px clamp(18px, 4vw, 28px)' }}>
              <div className="section-eyebrow">Supporting</div>
              <h3 style={{ marginBottom: 14 }}>Creators in their circle</h3>
              {supportedCreators.length === 0 ? (
                <p>No followed creators yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {supportedCreators.map((creator) => {
                    const creatorAvatar = creator.avatar_shelby_cid ? resolveContentUrl(creator.avatar_shelby_cid) : ''
                    return (
                      <Link key={creator.creator_addr} to={`/u/${creator.handle}`} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: creatorAvatar ? `url(${creatorAvatar}) center/cover no-repeat` : 'var(--bg-3)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                          {!creatorAvatar && '✦'}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{creator.display_name}</div>
                          <div className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>@{creator.handle}</div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="card"
          >
            <div style={{ padding: '22px clamp(18px, 4vw, 28px)' }}>
              <div className="section-eyebrow">Recent comments</div>
              <h3 style={{ marginBottom: 14 }}>What they've been saying</h3>
              {recentComments.length === 0 ? (
                <p>No recent comment activity yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {recentComments.map((item) => {
                    const creatorAvatar = item.creatorAvatarCid ? resolveContentUrl(item.creatorAvatarCid) : ''
                    return (
                      <Link key={item.id} to={`/u/${item.creatorHandle}`} style={{ display: 'block', paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: creatorAvatar ? `url(${creatorAvatar}) center/cover no-repeat` : 'var(--bg-3)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 10, flexShrink: 0 }}>
                            {!creatorAvatar && '✦'}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700 }}>{item.creatorName}</div>
                            <div className="mono" style={{ fontSize: 10, color: 'var(--accent)' }}>{item.contentTitle}</div>
                          </div>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 6 }}>
                          "{item.text.length > 120 ? `${item.text.slice(0, 120)}…` : item.text}"
                        </p>
                        <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>
                          {new Date(item.postedAt * 1000).toLocaleString()}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {editing && (
        <UserProfileModal
          profile={profile}
          onSuccess={() => void loadProfile()}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  )
}
