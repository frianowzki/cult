import toast from 'react-hot-toast'
import { useEffect, useState } from 'react'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { motion } from 'framer-motion'
import FollowingFeed from '../components/FollowingFeed'

import {
  aptos,
  getCreatorProfile,
  getCreatorContent,
  getSubscriptionStatus,
  getUserProfile,
  getFanPurchaseHistory,
  getCreatorPurchaseHistory,
  getLegacyFanSubscriptions,
  getLegacyFanPurchases,
  getLegacyFanHistoryFromEvents,
  buildToggleContentPayload,
  unitsToUsd,
  type CreatorProfile,
  type Content,
  type PurchaseHistoryItem,
  type SubscriptionStatus,
  type UserProfile,
} from '../lib/aptos'
import { CONTENT_TYPE_ICONS, ACCESS_LEVEL_LABELS } from '../lib/constants'
import { resolveContentUrl, buildDeleteBlobPayload, parseCid } from '../lib/shelby'
import { useStore } from '../lib/store'
import UploadContentModal from '../components/UploadContentModal'
import EditProfileModal from '../components/EditProfileModal'
import RegisterCreatorModal from '../components/RegisterCreatorModal'
import EditContentModal from '../components/EditContentModal'
import AutoRenewBanner from '../components/AutoRenewBanner'
import ContentViewer from '../components/ContentViewer'
import UserProfileModal from '../components/UserProfileModal'
import GiftSubscriptionModal from '../components/GiftSubscriptionModal'
import CreatorAnalytics from '../components/CreatorAnalytics'
import EarningsView from '../components/EarningsView'
import CollectionsManager from '../components/CollectionsManager'

export default function Dashboard() {
  const { connected, account, signAndSubmitTransaction } = useWallet()
  const {
    uploadModalOpen,
    setUploadModalOpen,
    registerModalOpen,
    setRegisterModalOpen,
    userProfileModalOpen,
    setUserProfileModalOpen,
  } = useStore()

  const [creator, setCreator] = useState<CreatorProfile | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [contents, setContents] = useState<Content[]>([])
  const [loading, setLoading] = useState(true)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [viewingContent, setViewingContent] = useState<Content | null>(null)
  const [editingContent, setEditingContent] = useState<Content | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [fanSubscription, setFanSubscription] = useState<SubscriptionStatus | null>(null)
  const [fanPurchaseHistory, setFanPurchaseHistory] = useState<PurchaseHistoryItem[]>([])
  const [creatorPurchaseHistory, setCreatorPurchaseHistory] = useState<PurchaseHistoryItem[]>([])
  const [dashTab, setDashTab] = useState<'posts' | 'analytics' | 'earnings' | 'collections' | 'following' | 'history'>('posts')
  const [giftModalOpen, setGiftModalOpen] = useState(false)

  useEffect(() => {
    if (account?.address) {
      loadData()
    } else {
      setLoading(false)
    }
  }, [account?.address])

  async function loadData() {
    if (!account?.address) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [profile, basicProfile, contentList, ownSubStatus, fanHistory, creatorHistory, legacySubscriptions, legacyPurchases, legacyEventHistory] = await Promise.all([
        getCreatorProfile(String(account.address)),
        getUserProfile(String(account.address)),
        getCreatorContent(String(account.address)),
        getSubscriptionStatus(String(account.address), String(account.address)),
        getFanPurchaseHistory(String(account.address)),
        getCreatorPurchaseHistory(String(account.address)),
        getLegacyFanSubscriptions(String(account.address)),
        getLegacyFanPurchases(String(account.address)),
        getLegacyFanHistoryFromEvents(String(account.address)),
      ])
      setCreator(profile)
      setUserProfile(basicProfile)
      setContents(contentList)
      setFanSubscription(ownSubStatus)
      const mergedFanHistory = [
        ...fanHistory,
        ...legacyEventHistory,
        ...legacySubscriptions.map((item) => ({
          kind: 0,
          counterparty_addr: item.creator_addr,
          content_id: 0,
          tier_index: item.tier_index,
          amount_paid: 0,
          timestamp: item.subscribed_at,
          expires_at: item.expires_at,
        })),
        ...legacyPurchases.map((item) => ({
          kind: 1,
          counterparty_addr: item.creator_addr,
          content_id: item.content_id,
          tier_index: 255,
          amount_paid: 0,
          timestamp: item.purchased_at,
          expires_at: 0,
        })),
      ]

      const dedupedFanHistory = mergedFanHistory.filter((item: PurchaseHistoryItem, index: number, arr: PurchaseHistoryItem[]) => {
        const key = `${item.kind}-${item.counterparty_addr}-${item.content_id}-${item.tier_index}-${item.amount_paid}-${item.timestamp}-${item.expires_at}`
        const firstIndex = arr.findIndex((candidate: PurchaseHistoryItem) => `${candidate.kind}-${candidate.counterparty_addr}-${candidate.content_id}-${candidate.tier_index}-${candidate.amount_paid}-${candidate.timestamp}-${candidate.expires_at}` === key)
        if (firstIndex !== index) return false
        if (item.amount_paid !== 0) return true
        return !arr.some((candidate: PurchaseHistoryItem) => (
          candidate.kind === item.kind &&
          candidate.counterparty_addr === item.counterparty_addr &&
          candidate.content_id === item.content_id &&
          candidate.tier_index === item.tier_index &&
          candidate.timestamp === item.timestamp &&
          candidate.expires_at === item.expires_at &&
          candidate.amount_paid > 0
        ))
      })

      setFanPurchaseHistory(dedupedFanHistory.sort((a, b) => b.timestamp - a.timestamp))
      setCreatorPurchaseHistory(creatorHistory.sort((a, b) => b.timestamp - a.timestamp))
    } finally {
      setLoading(false)
    }
  }

  async function tryDeleteShelbyBlob(cid: string | undefined, label: string) {
    if (!cid) return

    const parsed = parseCid(cid)
    if (!parsed) {
      console.warn(`Skipping ${label} Shelby delete: invalid CID`, cid)
      return
    }

    // Old mock uploads were stored on-chain as 0xmock::blobName but never existed in Shelby.
    if (parsed.address.toLowerCase() === '0xmock') {
      console.warn(`Skipping ${label} Shelby delete: mock CID was never uploaded`, cid)
      return
    }

    try {
      const tx = await signAndSubmitTransaction({
        data: buildDeleteBlobPayload(parsed.blobName),
      })
      await aptos.waitForTransaction({ transactionHash: (tx as any).hash })
    } catch (error) {
      // Missing Shelby metadata/blob should not block removing the CULT post.
      console.warn(`Failed to delete ${label} Shelby blob; content is already removed from CULT`, cid, error)
    }
  }

  async function handlePermanentDelete(c: Content) {
    if (!connected || !account) {
      toast.error('Connect wallet first')
      return
    }

    const ok = window.confirm('Remove this content from CULT? Shelby blobs will be deleted when they exist; old broken mock blobs will be skipped.')
    if (!ok) return

    setViewingContent(null)
    setDeletingId(c.id)

    try {
      // Remove from CULT first. Blob cleanup is best-effort so broken/missing Shelby blobs cannot trap bad posts.
      const toggleTx = await signAndSubmitTransaction({
        data: buildToggleContentPayload(c.id),
      })
      await aptos.waitForTransaction({ transactionHash: (toggleTx as any).hash })

      setContents((prev) => prev.filter((item) => item.id !== c.id))
      toast.success('Content removed from CULT')
      setViewingContent(null)

      await tryDeleteShelbyBlob(c.shelby_cid, 'content')
      await tryDeleteShelbyBlob(c.thumbnail_shelby_cid, 'thumbnail')
      await loadData()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to remove content from CULT')
    } finally {
      setDeletingId(null)
    }
  }

  if (!connected) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100%',
          gap: 20,
          textAlign: 'center',
          padding: '60px 32px',
        }}
      >
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '3rem', color: 'var(--text-3)' }}>◌</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 300 }}>Connect your wallet</h2>
        <p>Connect an Aptos wallet to access your creator dashboard</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px clamp(16px, 4vw, 32px) 16px', minHeight: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 40 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 100, borderRadius: 4 }} />
          ))}
        </div>
        <div className="skeleton" style={{ height: 300 }} />
      </div>
    )
  }

  if (!creator) {
    return (
      <>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100%',
            gap: 24,
            textAlign: 'center',
            padding: '60px 32px',
          }}
        >
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '4rem', color: 'var(--text-3)', fontStyle: 'italic' }}>
            CULT
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 300 }}>
            {userProfile ? `Welcome, ${userProfile.display_name}` : "You're not yet a creator"}
          </h2>
          <p style={{ maxWidth: 400 }}>
            {userProfile
              ? 'You already have a fan profile. Register as a creator whenever you want to start publishing and earning.'
              : 'Create a fan profile now, or register your creator profile to start publishing content and earning from your audience.'}
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="btn" onClick={() => setUserProfileModalOpen(true)}>
              {userProfile ? 'Edit Fan Profile' : 'Create Fan Profile'}
            </button>
            <button className="btn btn-primary btn-lg" onClick={() => setRegisterModalOpen(true)}>
              Register as Creator
            </button>
          </div>
        </div>
        {registerModalOpen && <RegisterCreatorModal onSuccess={loadData} />}
        {userProfileModalOpen && (
          <UserProfileModal
            profile={userProfile}
            onSuccess={loadData}
            onClose={() => setUserProfileModalOpen(false)}
          />
        )}
      </>
    )
  }

  const avatarUrl = resolveContentUrl(creator.avatar_shelby_cid)

  const paidSales = creatorPurchaseHistory.filter((item) => item.kind === 1)
  const subSales = creatorPurchaseHistory.filter((item) => item.kind === 0)
  const totalSalesRevenue = creatorPurchaseHistory.reduce((sum, item) => sum + item.amount_paid, 0)
  const avgRevenuePerSale = creatorPurchaseHistory.length ? totalSalesRevenue / creatorPurchaseHistory.length : 0
  const topPaidPost = contents
    .map((content) => ({
      content,
      sales: paidSales.filter((item) => item.content_id === content.id).length,
      revenue: paidSales.filter((item) => item.content_id === content.id).reduce((sum, item) => sum + item.amount_paid, 0),
    }))
    .sort((a, b) => b.revenue - a.revenue || b.sales - a.sales)[0]
  const freePosts = contents.filter((content) => content.access_level === 0)
  const memberPosts = contents.filter((content) => content.access_level > 0 && content.access_level !== 4)
  const oneOffPosts = contents.filter((content) => content.access_level === 4)
  const recurringRevenue = subSales.reduce((sum, item) => sum + item.amount_paid, 0)
  const oneOffRevenue = paidSales.reduce((sum, item) => sum + item.amount_paid, 0)
  const postsWithSales = contents
    .map((content) => ({
      content,
      sales: paidSales.filter((item) => item.content_id === content.id).length,
      revenue: paidSales.filter((item) => item.content_id === content.id).reduce((sum, item) => sum + item.amount_paid, 0),
    }))
    .filter((item) => item.sales > 0 || item.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue || b.sales - a.sales)
  const creatorNextMove = contents.length === 0
    ? 'Publish one strong free post first, then one clear paid post right after it.'
    : freePosts.length === 0
      ? 'You need at least one free post. Discovery is too weak without a public entry point.'
      : oneOffPosts.length === 0
        ? 'You need one flagship paid unlock. Give fans a simple first purchase.'
        : memberPosts.length === 0
          ? 'You need member-only inventory. Subscriptions are weak without recurring-value posts.'
          : postsWithSales.length === 0
            ? 'Your offers exist, but nothing is converting yet. Push one flagship paid post harder.'
            : recurringRevenue < oneOffRevenue
              ? 'One-off sales are working. Add stronger member-only reasons to upgrade into recurring revenue.'
              : 'Recurring revenue is working. Keep feeding it with consistent member-only drops.'
  const creatorGuidance = [
    freePosts.length === 0
      ? 'Add one free post this week so new fans have a no-friction discovery entry point.'
      : `Keep at least ${Math.max(1, Math.min(3, freePosts.length))} free post${Math.max(1, Math.min(3, freePosts.length)) === 1 ? '' : 's'} visible to keep discovery alive.`,
    oneOffPosts.length === 0
      ? 'Create one premium post with obvious standalone value, then push that as the flagship unlock.'
      : topPaidPost?.revenue
        ? `Your best paid post is ${topPaidPost.content.title}. Push traffic there instead of spreading attention thin.`
        : 'Choose one premium post and make it the obvious first paid conversion.',
    memberPosts.length === 0
      ? 'Add member-only posts so subscriptions feel like ongoing access, not just a donation.'
      : `You already have ${memberPosts.length} member-only post${memberPosts.length === 1 ? '' : 's'}. Keep that lane active so memberships feel alive.`,
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px clamp(16px, 4vw, 32px) 8px', minHeight: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 20,
          marginBottom: 28,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              flexShrink: 0,
              border: '2px solid var(--border-light)',
              background: avatarUrl
                ? `url(${avatarUrl}) center/cover no-repeat`
                : 'var(--bg-3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.8rem',
              color: 'var(--text-3)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {!avatarUrl && '✦'}
          </div>

          <div>
            <div className="section-eyebrow">Creator Dashboard</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 300, marginBottom: 2 }}>
              {creator.display_name}
            </h2>
            <span className="mono" style={{ fontSize: 12, color: 'var(--accent)' }}>
              @{creator.handle}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => setEditModalOpen(true)}>
            ✎ Edit Profile
          </button>
          <button className="btn" onClick={() => setGiftModalOpen(true)}>
            Gift Subscription
          </button>
          <button className="btn btn-primary" onClick={() => setUploadModalOpen(true)}>
            + Publish Content
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '18px 20px', marginBottom: 18, background: 'linear-gradient(180deg, rgba(254,119,201,0.07), rgba(254,119,201,0.02))', border: '1px solid rgba(254,119,201,0.16)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 0.85fr)', gap: 16 }}>
          <div>
            <div className="section-eyebrow">Creator guidance</div>
            <div style={{ fontWeight: 700, margin: '6px 0 8px' }}>{creatorNextMove}</div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
              Best current mix: {freePosts.length} free, {memberPosts.length} member-only, {oneOffPosts.length} buy-once. Revenue is {totalSalesRevenue > 0 ? `${Math.round((recurringRevenue / Math.max(totalSalesRevenue, 1)) * 100)}% recurring and ${Math.round((oneOffRevenue / Math.max(totalSalesRevenue, 1)) * 100)}% one-off.` : 'still at zero, so the next post matters a lot.'}
            </div>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {creatorGuidance.map((tip, index) => (
              <div key={`creator-guidance-${index}`} style={{ fontSize: 12, color: 'var(--text-2)', padding: '10px 12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                • {tip}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 160px), 1fr))',
          gap: 1,
          border: '1px solid var(--border)',
          marginBottom: 28,
        }}
      >
        {[
          { label: 'Total Earned', value: unitsToUsd(creator.total_earned) + ' USD', icon: '◈' },
          { label: 'Subscribers', value: creator.subscriber_count, icon: '◎' },
          { label: 'Content Posts', value: contents.length, icon: '▣' },
          { label: 'Active Tiers', value: creator.tiers.length, icon: '⬡' },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ padding: '20px 20px', background: 'var(--bg-2)', borderRight: '1px solid var(--border)' }}
          >
            <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: 18, marginBottom: 12 }}>
              {stat.icon}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.6rem',
                fontWeight: 300,
                color: 'var(--text)',
                lineHeight: 1,
                marginBottom: 6,
              }}
            >
              {stat.value}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {stat.label}
            </div>
          </motion.div>
        ))}
      </div>

      {fanSubscription?.isActive && (
        <AutoRenewBanner
          creatorAddr={String(account?.address || '')}
          expiresAt={fanSubscription.expiresAt}
          onRenewed={loadData}
        />
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        {(['posts', 'analytics', 'earnings', 'collections', 'following', 'history'] as const).map((tab) => (
          <button
            key={tab}
            className="btn btn-ghost btn-sm"
            onClick={() => setDashTab(tab)}
            style={{
              color: dashTab === tab ? 'var(--accent)' : 'var(--text-3)',
              borderBottom: dashTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
              borderRadius: 0,
              paddingBottom: 12,
              textTransform: 'capitalize',
            }}
          >
            {tab === 'posts' ? 'Your Content' : tab === 'analytics' ? 'Analytics' : tab === 'earnings' ? 'Earnings' : tab === 'collections' ? 'Collections' : tab === 'following' ? 'Following Feed' : 'History'}
          </button>
        ))}
      </div>

      {dashTab === 'analytics' ? (
        <CreatorAnalytics
          contents={contents}
          purchaseHistory={creatorPurchaseHistory}
          totalEarned={creator.total_earned}
        />
      ) : dashTab === 'earnings' ? (
        <EarningsView
          creatorAddr={String(account?.address || '')}
          totalEarned={creator.total_earned}
          purchaseHistory={creatorPurchaseHistory}
        />
      ) : dashTab === 'collections' ? (
        <CollectionsManager
          creatorAddr={String(account?.address || '')}
          contents={contents}
        />
      ) : dashTab === 'history' ? (
        <div style={{ display: 'grid', gap: 20, marginBottom: 8 }}>
          <div className="card" style={{ padding: '22px 24px' }}>
            <div className="section-eyebrow">Your purchases</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 300, marginBottom: 18 }}>What you bought from other creators</h3>
            {fanPurchaseHistory.length === 0 ? (
              <p style={{ color: 'var(--text-3)', margin: 0 }}>You haven’t bought subscriptions or paid posts from other creators yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {fanPurchaseHistory.map((item, index) => (
                  <div key={`fan-history-${index}`} style={{ padding: '14px 16px', border: '1px solid var(--border)', background: 'var(--bg-2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                          {item.kind === 0 ? `Subscription, Tier ${item.tier_index + 1}` : `Content purchase, Post #${item.content_id}`}
                        </div>
                        <div className="mono" style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>
                          {item.counterparty_addr}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 600, color: 'var(--accent)' }}>${unitsToUsd(item.amount_paid)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{item.timestamp ? new Date(item.timestamp * 1000).toLocaleString() : 'Recorded on-chain'}</div>
                      </div>
                    </div>
                    {item.kind === 0 && item.expires_at > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
                        Expires {new Date(item.expires_at * 1000).toLocaleString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card" style={{ padding: '22px 24px' }}>
            <div className="section-eyebrow">Your sales</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 300, marginBottom: 18 }}>What fans bought from you</h3>
            {creatorPurchaseHistory.length === 0 ? (
              <p style={{ color: 'var(--text-3)', margin: 0 }}>No subscription or content sales yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {creatorPurchaseHistory.map((item, index) => (
                  <div key={`creator-history-${index}`} style={{ padding: '14px 16px', border: '1px solid var(--border)', background: 'var(--bg-2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                          {item.kind === 0 ? `Subscription sale, Tier ${item.tier_index + 1}` : `Content sale, Post #${item.content_id}`}
                        </div>
                        <div className="mono" style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>
                          {item.counterparty_addr}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 600, color: 'var(--accent)' }}>${unitsToUsd(item.amount_paid)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{item.timestamp ? new Date(item.timestamp * 1000).toLocaleString() : 'Recorded on-chain'}</div>
                      </div>
                    </div>
                    {item.kind === 0 && item.expires_at > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
                        Active until {new Date(item.expires_at * 1000).toLocaleString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : dashTab === 'following' ? (
        <FollowingFeed />
      ) : (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="section-eyebrow">Your Content</div>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>
              {contents.length} posts
            </span>
          </div>

          {contents.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '42px 24px', borderStyle: 'dashed' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.5rem', color: 'var(--text-3)', marginBottom: 16 }}>
                ◌
              </div>
              <p>No content published yet.</p>
              <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => setUploadModalOpen(true)}>
                Publish your first post
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))',
                gap: 1,
                border: '1px solid var(--border)',
              }}
            >
              {contents.map((c, i) => {
                const thumbUrl = resolveContentUrl(c.thumbnail_shelby_cid)

                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => setViewingContent(c)}
                    style={{
                      background: 'var(--bg-2)',
                      borderRight: '1px solid var(--border)',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'background var(--transition)',
                      overflow: 'hidden',
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-3)')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-2)')}
                  >
                    <div
                      style={{
                        height: 140,
                        background: thumbUrl
                          ? `url(${thumbUrl}) center/cover no-repeat`
                          : 'var(--bg-3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderBottom: '1px solid var(--border)',
                        position: 'relative',
                      }}
                    >
                      {!thumbUrl && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', color: 'var(--text-3)' }}>
                          {CONTENT_TYPE_ICONS[c.content_type]}
                        </span>
                      )}

                      {c.content_type === 0 && (
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(0,0,0,0.3)',
                          }}
                        >
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: '50%',
                              background: 'rgba(200,169,110,0.9)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 16,
                            }}
                          >
                            ▶
                          </div>
                        </div>
                      )}

                      <span className="badge" style={{ position: 'absolute', top: 8, right: 8, fontSize: 9 }}>
                        {ACCESS_LEVEL_LABELS[c.access_level]}
                      </span>
                    </div>

                    <div style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: 12 }}>
                          {CONTENT_TYPE_ICONS[c.content_type]}
                        </span>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: 13,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {c.title}
                        </span>
                      </div>

                      {c.description && (
                        <p
                          style={{
                            fontSize: 11,
                            color: 'var(--text-3)',
                            lineHeight: 1.5,
                            marginBottom: 10,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {c.description}
                        </p>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
                          {new Date(c.published_at * 1000).toLocaleDateString()}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
                            View →
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {uploadModalOpen && <UploadContentModal onSuccess={loadData} />}
      {userProfileModalOpen && (
        <UserProfileModal
          profile={userProfile}
          onSuccess={loadData}
          onClose={() => setUserProfileModalOpen(false)}
        />
      )}
      {registerModalOpen && <RegisterCreatorModal onSuccess={loadData} />}
      {editModalOpen && (
        <EditProfileModal
          profile={creator}
          onSuccess={loadData}
          onClose={() => setEditModalOpen(false)}
        />
      )}
      {editingContent && (
        <EditContentModal
          content={editingContent}
          onSuccess={loadData}
          onClose={() => setEditingContent(null)}
        />
      )}
      {viewingContent && (
        <ContentViewer
          content={viewingContent}
          hasAccess={true}
          creatorAddr={String(account?.address || '')}
          onClose={() => setViewingContent(null)}
          onEdit={() => {
            setEditingContent(viewingContent)
            setViewingContent(null)
          }}
          onDelete={() => void handlePermanentDelete(viewingContent)}
          deleting={deletingId === viewingContent.id}
        />
      )}
      {giftModalOpen && creator && (
        <GiftSubscriptionModal
          creatorAddr={String(account?.address || '')}
          creatorName={creator.display_name}
          tiers={creator.tiers}
          onClose={() => setGiftModalOpen(false)}
          onSuccess={loadData}
        />
      )}
    </div>
  )
}