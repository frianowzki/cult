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
  const [dashTab, setDashTab] = useState<'posts' | 'analytics' | 'following' | 'history'>('posts')
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

  async function handlePermanentDelete(c: Content) {
    if (!connected || !account) {
      toast.error('Connect wallet first')
      return
    }

    const ok = window.confirm('Delete this content from Shelby and remove it from CULT?')
    if (!ok) return

    setViewingContent(null)
    setDeletingId(c.id)

    try {
      const mainBlob = parseCid(c.shelby_cid)
      if (!mainBlob) throw new Error('Invalid Shelby blob reference')

      const mainDeleteTx = await signAndSubmitTransaction({
        data: buildDeleteBlobPayload(mainBlob.blobName),
      })
      await aptos.waitForTransaction({ transactionHash: (mainDeleteTx as any).hash })

      if (c.thumbnail_shelby_cid) {
        const thumbBlob = parseCid(c.thumbnail_shelby_cid)
        if (thumbBlob) {
          const thumbDeleteTx = await signAndSubmitTransaction({
            data: buildDeleteBlobPayload(thumbBlob.blobName),
          })
          await aptos.waitForTransaction({ transactionHash: (thumbDeleteTx as any).hash })
        }
      }

      const toggleTx = await signAndSubmitTransaction({
        data: buildToggleContentPayload(c.id),
      })
      await aptos.waitForTransaction({ transactionHash: (toggleTx as any).hash })

      setContents((prev) => prev.filter((item) => item.id !== c.id))
      toast.success('Content deleted from Shelby and removed from CULT')
      await loadData()
      setViewingContent(null)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to permanently delete content')
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
        {(['posts', 'analytics', 'following', 'history'] as const).map((tab) => (
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
            {tab === 'posts' ? 'Your Content' : tab === 'analytics' ? 'Analytics' : tab === 'following' ? 'Following Feed' : 'History'}
          </button>
        ))}
      </div>

      {dashTab === 'analytics' ? (
        <div style={{ display: 'grid', gap: 20, marginBottom: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {[
              { label: 'Sales Revenue', value: `$${unitsToUsd(totalSalesRevenue)}`, hint: `${creatorPurchaseHistory.length} total conversions` },
              { label: 'Subscription Revenue', value: `$${unitsToUsd(subSales.reduce((sum, item) => sum + item.amount_paid, 0))}`, hint: `${subSales.length} membership sales` },
              { label: 'Paid Post Revenue', value: `$${unitsToUsd(paidSales.reduce((sum, item) => sum + item.amount_paid, 0))}`, hint: `${paidSales.length} paid unlocks` },
              { label: 'Avg Revenue / Sale', value: `$${unitsToUsd(avgRevenuePerSale)}`, hint: 'Across subscriptions and paid posts' },
            ].map((stat) => (
              <div key={stat.label} className="card" style={{ padding: '20px 22px' }}>
                <div className="section-eyebrow">Analytics</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', lineHeight: 1, margin: '8px 0 6px' }}>{stat.value}</div>
                <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>{stat.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{stat.hint}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: '22px 24px' }}>
            <div className="section-eyebrow">Funnel breakdown</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 300, marginBottom: 14 }}>Where conversion is coming from</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 16 }}>
              {[
                { label: 'Free posts', value: freePosts.length, hint: 'Top-of-funnel discovery' },
                { label: 'Member posts', value: memberPosts.length, hint: 'Recurring-value inventory' },
                { label: 'Buy-once posts', value: oneOffPosts.length, hint: 'One-time conversion assets' },
                { label: 'Selling posts', value: postsWithSales.length, hint: 'Posts with actual paid conversions' },
              ].map((item) => (
                <div key={item.label} style={{ padding: '14px 16px', border: '1px solid var(--border)', background: 'var(--bg-2)' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.45rem', lineHeight: 1, marginBottom: 6 }}>{item.value}</div>
                  <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 6 }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{item.hint}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
                <span style={{ color: 'var(--text-2)' }}>Recurring revenue</span>
                <strong>${unitsToUsd(recurringRevenue)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
                <span style={{ color: 'var(--text-2)' }}>One-off revenue</span>
                <strong>${unitsToUsd(oneOffRevenue)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
                <span style={{ color: 'var(--text-2)' }}>Revenue mix</span>
                <strong>{totalSalesRevenue > 0 ? `${Math.round((recurringRevenue / totalSalesRevenue) * 100)}% recurring / ${Math.round((oneOffRevenue / totalSalesRevenue) * 100)}% one-off` : 'No sales yet'}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <div className="card" style={{ padding: '22px 24px' }}>
              <div className="section-eyebrow">Best monetizing post</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 300, marginBottom: 14 }}>Top paid content</h3>
              {topPaidPost && topPaidPost.revenue > 0 ? (
                <>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>{topPaidPost.content.title}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    <span className="badge">{topPaidPost.sales} sales</span>
                    <span className="badge badge-accent">${unitsToUsd(topPaidPost.revenue)}</span>
                    <span className="badge">{ACCESS_LEVEL_LABELS[topPaidPost.content.access_level]}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-2)' }}>This is currently your strongest paid conversion asset. Push fans here from social and notifications.</p>
                </>
              ) : (
                <p style={{ margin: 0, color: 'var(--text-3)' }}>No paid post revenue yet. Your first conversion target should be one clear flagship paid post.</p>
              )}
            </div>

            <div className="card" style={{ padding: '22px 24px' }}>
              <div className="section-eyebrow">Conversion advice</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 300, marginBottom: 14 }}>What to do next</h3>
              <div style={{ display: 'grid', gap: 10, fontSize: 13, color: 'var(--text-2)' }}>
                <div>• Put one strongest paid post near the top, don’t spread value too thin.</div>
                <div>• Make tier descriptions outcome-driven, not vague.</div>
                <div>• If followers see locked posts often, push them toward one obvious membership tier.</div>
                <div>• Use notifications to bring fans back, then convert with your best locked post.</div>
                <div>• Right now you have {freePosts.length} free, {memberPosts.length} member-only, and {oneOffPosts.length} one-time paid posts. Balance discovery against monetization.</div>
              </div>
            </div>

            <div className="card" style={{ padding: '22px 24px' }}>
              <div className="section-eyebrow">Converting posts</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 300, marginBottom: 14 }}>What is actually selling</h3>
              {postsWithSales.length > 0 ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  {postsWithSales.slice(0, 4).map((item) => (
                    <div key={item.content.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{item.content.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{item.sales} sale{item.sales === 1 ? '' : 's'} • {ACCESS_LEVEL_LABELS[item.content.access_level]}</div>
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--accent)' }}>${unitsToUsd(item.revenue)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, color: 'var(--text-3)' }}>No converting posts yet. You need one cleaner flagship paid offer.</p>
              )}
            </div>
          </div>
        </div>
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