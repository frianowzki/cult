import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

import {
  getCreatorProfile,
  getCreatorContent,
  getSubscriptionStatus,
  getCreatorPurchaseHistory,
  canAccessContent,
  buildSubscribePayload,
  buildPurchaseContentPayload,
  getCreatorAddressByHandle,
  unitsToUsd,
  type CreatorProfile,
  type Content,
  type PurchaseHistoryItem,
} from '../lib/aptos'
import {
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_ICONS,
  ACCESS_LEVEL_LABELS,
  ACCESS_LEVELS,
} from '../lib/constants'
import { resolveContentUrl } from '../lib/shelby'
import { useStore } from '../lib/store'
import TipModal from '../components/TipModal'
import FollowButton from '../components/FollowButton'
import ContentViewer from '../components/ContentViewer'
import GiftSubscriptionModal from '../components/GiftSubscriptionModal'
import CollectionViewer from '../components/CollectionViewer'

export default function CreatorPage() {
  const { handle } = useParams<{ handle: string }>()
  const { account, signAndSubmitTransaction, connected } = useWallet()
  const { openTipModal, tipModalOpen, theme } = useStore()

  const [creator, setCreator] = useState<CreatorProfile | null>(null)
  const [contents, setContents] = useState<Content[]>([])
  const [subStatus, setSubStatus] = useState<{ isActive: boolean; tierIndex: number; expiresAt: number } | null>(null)
  const [salesHistory, setSalesHistory] = useState<PurchaseHistoryItem[]>([])
  const [accessMap, setAccessMap] = useState<Record<number, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState<'all' | 'video' | 'image' | 'audio' | 'article' | 'collections'>('all')
  const [subscribing, setSubscribing] = useState<number | null>(null)
  const [purchasing, setPurchasing] = useState<number | null>(null)
  const [viewingContent, setViewingContent] = useState<Content | null>(null)
  const [creatorAddr, setCreatorAddr] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const [giftModalOpen, setGiftModalOpen] = useState(false)
  const postsSectionRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function updateViewport() {
      setIsMobile(window.innerWidth <= 640)
    }
    updateViewport()
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  useEffect(() => {
    void resolveCreator()
  }, [handle])

  useEffect(() => {
    if (!creatorAddr) return
    void loadCreator(creatorAddr)
  }, [creatorAddr, account?.address])

  async function resolveCreator() {
    if (!handle) {
      setCreatorAddr('')
      setCreator(null)
      setContents([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const resolvedAddress = await getCreatorAddressByHandle(handle)
      setCreatorAddr(resolvedAddress || '')
      if (!resolvedAddress) {
        setCreator(null)
        setContents([])
        setLoading(false)
      }
    } catch (e) {
      console.error(e)
      setCreatorAddr('')
      setCreator(null)
      setContents([])
      setLoading(false)
    }
  }

  async function loadCreator(resolvedCreatorAddr: string) {
    setLoading(true)
    try {
      const [profile, contentList, history] = await Promise.all([
        getCreatorProfile(resolvedCreatorAddr),
        getCreatorContent(resolvedCreatorAddr),
        getCreatorPurchaseHistory(resolvedCreatorAddr),
      ])
      setCreator(profile)
      setContents(contentList)
      setSalesHistory(history)

      if (account?.address) {
        const status = await getSubscriptionStatus(String(account.address), resolvedCreatorAddr)
        setSubStatus(status)

        if (contentList.length > 0) {
          const accessChecks = await Promise.all(
            contentList.map((c) => canAccessContent(String(account.address), resolvedCreatorAddr, c.id))
          )
          const map: Record<number, boolean> = {}
          contentList.forEach((c, i) => { map[c.id] = accessChecks[i] })
          setAccessMap(map)
        } else {
          setAccessMap({})
        }
      } else {
        setSubStatus(null)
        setAccessMap({})
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubscribe(tierIndex: number) {
    if (subscribing !== null) return
    if (!connected || !account) { toast.error('Connect wallet first'); return }
    setSubscribing(tierIndex)
    try {
      const payload = buildSubscribePayload(creatorAddr, tierIndex)
      await signAndSubmitTransaction({ data: payload })
      toast.success('Subscribed!')
      await loadCreator(creatorAddr)
    } catch (e: any) {
      toast.error(e?.message || 'Transaction failed')
    } finally {
      setSubscribing(null)
    }
  }

  async function handlePurchase(contentId: number) {
    if (!connected || !account) { toast.error('Connect wallet first'); return }
    setPurchasing(contentId)
    try {
      const payload = buildPurchaseContentPayload(creatorAddr, contentId)
      await signAndSubmitTransaction({ data: payload })
      toast.success('Content unlocked!')
      await loadCreator(creatorAddr)
    } catch (e: any) {
      toast.error(e?.message || 'Transaction failed')
    } finally {
      setPurchasing(null)
    }
  }

  async function handleShareCreator() {
    const url = typeof window !== 'undefined' ? window.location.href : `https://www.joincult.xyz/c/${creator?.handle || handle}`
    const text = `Check out ${creator?.display_name || creator?.handle || 'this creator'} on CULT`

    if (navigator.share) {
      try {
        await navigator.share({ title: creator?.display_name || creator?.handle || 'CULT creator', text, url })
        return
      } catch {
        // fall through to copy behavior
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      toast.success('Share link copied')
    } catch {
      toast.error('Could not share link')
    }
  }

  function handleBrowsePosts() {
    setSelectedTab('all')
    postsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const filteredContent = useMemo(() => {
    if (selectedTab === 'collections') return []
    return contents.filter((c) => {
      if (selectedTab === 'all') return true
      const typeMap: Record<string, number> = { video: 0, image: 1, audio: 2, article: 3 }
      return c.content_type === typeMap[selectedTab]
    })
  }, [contents, selectedTab])

  const lockedCount = filteredContent.filter((content) => !(accessMap[content.id] ?? (content.access_level === ACCESS_LEVELS.FREE))).length
  const cheapestTier = creator?.tiers?.[0] || null
  const featuredLockedPost = filteredContent.find((content) => !(accessMap[content.id] ?? (content.access_level === ACCESS_LEVELS.FREE)))
  const recentSupporters = salesHistory.slice().sort((a, b) => b.timestamp - a.timestamp).slice(0, 4)
  const supporterWall = salesHistory
    .slice()
    .sort((a, b) => b.amount_paid - a.amount_paid || b.timestamp - a.timestamp)
    .slice(0, 6)
  const popularPaidPost = contents
    .map((content) => ({
      content,
      sales: salesHistory.filter((item) => item.kind === 1 && item.content_id === content.id).length,
    }))
    .sort((a, b) => b.sales - a.sales)[0]

  const featuredPost = popularPaidPost?.sales
    ? popularPaidPost.content
    : contents.slice().sort((a, b) => b.published_at - a.published_at)[0]
  const bestConversionMessage = !subStatus?.isActive
    ? popularPaidPost?.sales && popularPaidPost.content.access_level === ACCESS_LEVELS.PURCHASE
      ? `Most fans start by unlocking ${popularPaidPost.content.title}.`
      : cheapestTier
        ? `Best first move: join ${cheapestTier.name} for ongoing access.`
        : 'Best first move: browse the strongest post and decide fast.'
    : 'You already have access. Browse the newest drops.'
  const purchaseOnlyCount = filteredContent.filter((content) => content.access_level === ACCESS_LEVELS.PURCHASE).length
  const memberOnlyCount = filteredContent.filter((content) => content.access_level !== ACCESS_LEVELS.FREE && content.access_level !== ACCESS_LEVELS.PURCHASE).length

  if (loading) return <LoadingSkeleton />

  if (!creator) {
    return (
      <div style={{ textAlign: 'center', padding: '120px 16px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', color: 'var(--text-3)' }}>Creator not found</div>
        <p style={{ marginTop: 12 }}>Username: <span className="mono">@{handle}</span></p>
      </div>
    )
  }

  const heroPrimaryLine = creator.subscriber_count > 0
    ? `${creator.subscriber_count} subscriber${creator.subscriber_count === 1 ? '' : 's'} already backing ${creator.display_name}.`
    : 'Early supporters can set the tone here.'
  const heroSecondaryLine = lockedCount > 0
    ? cheapestTier
      ? `Unlock ${lockedCount} locked post${lockedCount === 1 ? '' : 's'} from ${unitsToUsd(cheapestTier.price_per_month)} USD/mo.`
      : `Unlock ${lockedCount} locked post${lockedCount === 1 ? '' : 's'} and support this creator directly.`
    : purchaseOnlyCount > 0
      ? `${purchaseOnlyCount} paid unlock${purchaseOnlyCount === 1 ? '' : 's'} ready for one-time conversion.`
      : 'Browse the strongest posts, tip directly, or share the page.'

  const avatarUrl = resolveContentUrl(creator.avatar_shelby_cid)
  const bannerUrl = resolveContentUrl(creator.banner_shelby_cid)
  const creatorHeroBackground = bannerUrl
    ? `url(${bannerUrl}) center/cover no-repeat`
    : theme === 'light'
      ? 'linear-gradient(135deg, #f3e5d7 0%, #ecd8c4 50%, #f7f1e8 100%)'
      : 'linear-gradient(135deg, #1a1510 0%, #2a2015 50%, #1a1510 100%)'

  return (
    <div style={{ minHeight: '100%', marginTop: isMobile ? -116 : -60, paddingTop: isMobile ? 116 : 60 }}>
      <div style={{ height: isMobile ? 140 : 'clamp(140px, 28vw, 220px)', background: creatorHeroBackground, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: theme === 'light' ? 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(247,241,232,0.12) 30%, rgba(247,241,232,0.66) 78%, var(--bg) 100%)' : 'linear-gradient(180deg, rgba(6,6,6,0.08) 0%, rgba(6,6,6,0.18) 30%, rgba(6,6,6,0.58) 78%, var(--bg) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: theme === 'light' ? 'linear-gradient(90deg, rgba(255,255,255,0.16) 0%, transparent 28%, transparent 72%, rgba(116,84,58,0.12) 100%)' : 'linear-gradient(90deg, rgba(8,8,8,0.35) 0%, transparent 28%, transparent 72%, rgba(8,8,8,0.35) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: theme === 'light' ? 'radial-gradient(circle at center, transparent 0%, transparent 52%, rgba(116,84,58,0.08) 100%)' : 'radial-gradient(circle at center, transparent 0%, transparent 52%, rgba(0,0,0,0.18) 100%)' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontFamily: 'var(--font-mono)', fontSize: isMobile ? '2.6rem' : '4rem', color: theme === 'light' ? 'rgba(184,79,144,0.08)' : 'rgba(200,169,110,0.08)', pointerEvents: 'none', userSelect: 'none' }}>✦</div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: `0 ${isMobile ? 14 : 32}px 8px`, minHeight: `calc(100% - ${isMobile ? 140 : 220}px)` }}>
        <div className="card" style={{ marginTop: isMobile ? 8 : 12, marginBottom: 24, padding: isMobile ? '16px' : '20px 22px', background: theme === 'light' ? 'linear-gradient(180deg, rgba(255,255,255,0.74), rgba(254,119,201,0.05))' : 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(254,119,201,0.03))', border: '1px solid rgba(254,119,201,0.14)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.15fr) auto', gap: 18, alignItems: 'start' }}>
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{
                  width: isMobile ? 72 : 88, height: isMobile ? 72 : 88, borderRadius: '50%',
                  border: '3px solid var(--bg)',
                  background: avatarUrl ? `url(${avatarUrl}) center/cover no-repeat` : 'var(--bg-3)',
                  backgroundPosition: 'center',
                  backgroundSize: 'cover',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '2rem', color: 'var(--text-3)', flexShrink: 0,
                  overflow: 'hidden', position: 'relative', zIndex: 2,
                }}>
                  {!avatarUrl && '✦'}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h2 style={{ fontSize: isMobile ? '1.55rem' : '2rem', fontWeight: 300, marginBottom: 4, lineHeight: 1.05, wordBreak: 'break-word' }}>{creator.display_name}</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    <span className="mono" style={{ fontSize: 12, color: 'var(--accent)' }}>@{creator.handle}</span>
                    {subStatus?.isActive && (
                      <span className="badge badge-accent" style={{ marginLeft: 0 }}>
                        ✦ {creator.tiers[subStatus.tierIndex]?.name || 'Subscribed'}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span className="badge">{contents.length} post{contents.length === 1 ? '' : 's'}</span>
                    <span className="badge">{creator.subscriber_count} subscriber{creator.subscriber_count === 1 ? '' : 's'}</span>
                    {popularPaidPost?.sales ? <span className="badge badge-accent">{popularPaidPost.sales} paid unlock{popularPaidPost.sales === 1 ? '' : 's'}</span> : null}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: isMobile ? 14 : 15 }}>{heroPrimaryLine}</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{heroSecondaryLine}</div>
                {creator.bio && (
                  <p style={{ maxWidth: 640, margin: 0, color: 'var(--text-2)', lineHeight: 1.65, fontSize: isMobile ? 13 : 15 }}>{creator.bio}</p>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 10, minWidth: isMobile ? '100%' : 220 }}>
              <div style={{ display: 'grid', gap: 8 }}>
                <FollowButton creatorAddr={creatorAddr} size="sm" />
                <button className="btn btn-primary btn-sm" onClick={handleBrowsePosts}>
                  Browse posts
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                <button className="btn btn-sm" onClick={() => openTipModal(creatorAddr)}>Tip</button>
                <button className="btn btn-sm" onClick={() => setGiftModalOpen(true)}>Gift</button>
                <button className="btn btn-sm" onClick={() => void handleShareCreator()}>Share</button>
              </div>
            </div>
          </div>
        </div>

        {!subStatus?.isActive && creator.tiers.length > 0 && (
          <div className="card" style={{ padding: isMobile ? '16px' : '18px 20px', marginBottom: 24, background: 'linear-gradient(180deg, rgba(254,119,201,0.07), rgba(254,119,201,0.02))', border: '1px solid rgba(254,119,201,0.18)' }}>
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <div className="section-eyebrow">Membership</div>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Unlock {lockedCount} locked post{lockedCount === 1 ? '' : 's'} and ongoing drops</div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                    {cheapestTier ? `Start with ${cheapestTier.name} for $${unitsToUsd(cheapestTier.price_per_month)}/mo.` : 'Subscribe to unlock member content.'}
                    {featuredLockedPost ? ` Best entry point right now: ${featuredLockedPost.title}.` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {cheapestTier && (
                    <button className="btn btn-primary btn-sm" onClick={() => handleSubscribe(0)} disabled={subscribing !== null}>
                      {subscribing === 0 ? 'Processing…' : `Join ${cheapestTier.name}`}
                    </button>
                  )}
                  <button className="btn btn-sm" onClick={handleBrowsePosts}>
                    Browse posts
                  </button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.1fr) minmax(0, 0.9fr)', gap: 12 }}>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                    <div className="section-eyebrow">Best next step</div>
                    <div style={{ fontWeight: 700, margin: '6px 0 6px' }}>{bestConversionMessage}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      {lockedCount > 0 ? `There are ${lockedCount} locked posts ready once you convert.` : 'This creator is set up for direct support and future drops.'}
                    </div>
                  </div>
                  {(recentSupporters.length > 0 || creator.subscriber_count > 0 || (popularPaidPost && popularPaidPost.sales > 0)) && (
                    <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(254,119,201,0.14)' }}>
                      <div className="section-eyebrow">Social proof</div>
                      <div style={{ display: 'grid', gap: 8 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                          {creator.subscriber_count > 0
                            ? `${creator.subscriber_count} subscriber${creator.subscriber_count === 1 ? '' : 's'} already backing this creator.`
                            : 'Early supporters can set the tone here.'}
                        </div>
                        {popularPaidPost && popularPaidPost.sales > 0 && (
                          <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                            <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{popularPaidPost.sales} paid unlock{popularPaidPost.sales === 1 ? '' : 's'}</span> already on <span style={{ color: 'var(--text)' }}>{popularPaidPost.content.title}</span>.
                          </div>
                        )}
                        {recentSupporters.length > 0 && (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {recentSupporters.slice(0, 3).map((item, index) => (
                              <span key={`hero-supporter-${item.counterparty_addr}-${index}`} className="badge" style={{ maxWidth: '100%' }}>
                                {item.counterparty_addr.slice(0, 6)}…{item.counterparty_addr.slice(-4)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                  <div className="section-eyebrow">Why convert now</div>
                  <div style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--text-2)' }}>
                    <div>• instant access instead of browsing locked previews</div>
                    <div>• support the creator directly</div>
                    <div>• keep unlocks and history tied to your wallet</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: isMobile ? 14 : 20, flexWrap: 'wrap', marginBottom: 28, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
          {featuredPost && (
            <div className="card" style={{ width: '100%', padding: isMobile ? '16px' : '18px 20px', marginBottom: 4, background: 'linear-gradient(180deg, rgba(254,119,201,0.06), rgba(254,119,201,0.01))', border: '1px solid rgba(254,119,201,0.16)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <div className="section-eyebrow">Featured post</div>
                  <div style={{ fontWeight: 700, margin: '6px 0 6px' }}>{featuredPost.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                    {featuredPost === popularPaidPost?.content ? 'Best converting premium post right now.' : 'Latest highlighted post from this creator.'}
                  </div>
                </div>
                <button className="btn btn-sm btn-primary" onClick={() => setViewingContent(featuredPost)}>
                  Open featured post
                </button>
              </div>
            </div>
          )}
          {[[creator.subscriber_count, 'Subscribers'], [contents.length, 'Posts'], ['$' + unitsToUsd(creator.total_earned), 'Earned']].map(([val, label]) => (
            <div key={String(label)} style={{ minWidth: isMobile ? 84 : 'auto' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? '1.35rem' : '1.6rem', fontWeight: 300, color: 'var(--text)', lineHeight: 1 }}>{val}</div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
            </div>
          ))}
        </div>

        <div ref={postsSectionRef} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr)', gap: 24, alignItems: 'start' }}>
          <div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '1px solid var(--border)', overflowX: 'auto', paddingBottom: 2 }}>
              {(['all', 'video', 'image', 'audio', 'article', 'collections'] as const).map((tab) => (
                <button key={tab} className="btn btn-ghost btn-sm" onClick={() => setSelectedTab(tab)}
                  style={{ color: selectedTab === tab ? 'var(--accent)' : 'var(--text-3)', borderBottom: selectedTab === tab ? '2px solid var(--accent)' : '2px solid transparent', borderRadius: 0, paddingBottom: 10, flexShrink: 0 }}>
                  {tab === 'collections' ? 'Collections' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {selectedTab === 'collections' ? (
              <CollectionViewer creatorAddr={creatorAddr} contents={contents} />
            ) : filteredContent.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-3)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', marginBottom: 12 }}>◌</div>
                No content yet
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredContent.map((content, i) => {
                  const hasAccess = accessMap[content.id] ?? (content.access_level === ACCESS_LEVELS.FREE)
                  const thumbUrl = resolveContentUrl(content.thumbnail_shelby_cid)

                  return (
                    <motion.div
                      key={content.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', overflow: 'hidden' }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '72px minmax(0, 1fr)' : '160px minmax(0, 1fr)', gap: 0 }}>
                        <div
                          onClick={() => setViewingContent(content)}
                          style={{
                            background: 'var(--bg-3)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            gap: 4, borderRight: '1px solid var(--border)', padding: isMobile ? '10px 4px' : '8px',
                            cursor: 'pointer', minHeight: isMobile ? 72 : 96,
                            overflow: 'hidden',
                          }}
                        >
                          {thumbUrl ? (
                            <img
                              src={thumbUrl}
                              alt={content.title}
                              style={{
                                width: '100%',
                                height: '100%',
                                maxHeight: isMobile ? 72 : 96,
                                objectFit: 'contain',
                                objectPosition: 'center',
                                display: 'block',
                              }}
                            />
                          ) : (
                            <>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', color: 'var(--accent)' }}>{CONTENT_TYPE_ICONS[content.content_type]}</span>
                              <span style={{ fontSize: 8, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'center' }}>{CONTENT_TYPE_LABELS[content.content_type]}</span>
                            </>
                          )}
                        </div>

                        <div style={{ padding: '12px 12px 10px', minWidth: 0 }}>
                          <div onClick={() => setViewingContent(content)} style={{ cursor: 'pointer' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 600, fontSize: 13, color: hasAccess ? 'var(--text)' : 'var(--text-2)', wordBreak: 'break-word' }}>{content.title}</span>
                              {!hasAccess && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>🔒</span>}
                            </div>
                            {content.description && (
                              <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.45 }}>
                                {hasAccess ? content.description : content.description.slice(0, 72) + (content.description.length > 72 ? '…' : '')}
                              </p>
                            )}
                            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                              <span className="badge">{ACCESS_LEVEL_LABELS[content.access_level]}</span>
                              <span className="badge mono" style={{ fontSize: 9 }}>{new Date(content.published_at * 1000).toLocaleDateString()}</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                            {hasAccess ? (
                              <button className="btn btn-sm btn-ghost" onClick={() => setViewingContent(content)} style={{ color: 'var(--green)', fontSize: 10, padding: '8px 10px' }}>
                                ▶ View
                              </button>
                            ) : content.access_level === ACCESS_LEVELS.PURCHASE ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 7, flexWrap: 'wrap', maxWidth: 260 }}>
                                <button className="btn btn-sm btn-primary" onClick={() => handlePurchase(content.id)} disabled={purchasing === content.id} style={{ whiteSpace: 'nowrap', fontSize: 10, padding: '8px 10px' }}>
                                  {purchasing === content.id ? '…' : `Unlock this post for ${unitsToUsd(content.purchase_price)} USD`}
                                </button>
                                <span style={{ fontSize: 10, color: 'var(--text-2)', textAlign: 'right', lineHeight: 1.45 }}>
                                  One payment, permanent unlock for this post in your wallet history.
                                </span>
                                {cheapestTier ? (
                                  <span style={{ fontSize: 10, color: cheapestTier.price_per_month <= content.purchase_price ? 'var(--accent)' : 'var(--text-3)', fontWeight: cheapestTier.price_per_month <= content.purchase_price ? 600 : 500, textAlign: 'right', lineHeight: 1.45 }}>
                                    {cheapestTier.price_per_month <= content.purchase_price
                                      ? `Better value if you want more than one drop: ${cheapestTier.name} starts at ${unitsToUsd(cheapestTier.price_per_month)} USD/mo.`
                                      : `${cheapestTier.name} starts at ${unitsToUsd(cheapestTier.price_per_month)} USD/mo if you want ongoing access instead.`}
                                  </span>
                                ) : null}
                              </div>
                            ) : connected ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 7, maxWidth: 260 }}>
                                <button
                                  className="btn btn-sm"
                                  onClick={() => handleSubscribe(Math.max(0, content.access_level - 1))}
                                  disabled={subscribing !== null}
                                  style={{ whiteSpace: 'nowrap', fontSize: 10, padding: '8px 10px' }}
                                >
                                  {subscribing === Math.max(0, content.access_level - 1) ? '…' : `Join to unlock this post`}
                                </button>
                                <span style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'right', lineHeight: 1.45 }}>
                                  Membership unlocks this tier and future member drops.
                                </span>
                              </div>
                            ) : (
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>Tier {content.access_level}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>

          <aside style={{ position: isMobile ? 'static' : 'sticky', top: 80 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
              <div className="card" style={{ padding: '16px', background: 'var(--bg-2)' }}>
                <div className="section-eyebrow">Supporter activity</div>
                <div style={{ fontWeight: 700, margin: '6px 0 10px' }}>
                  {creator.subscriber_count > 0 ? `${creator.subscriber_count} people subscribed` : 'Be the first subscriber'}
                </div>
                {recentSupporters.length > 0 ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {recentSupporters.map((item, index) => (
                      <div key={`${item.counterparty_addr}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
                        <span className="mono" style={{ color: 'var(--accent)' }}>{item.counterparty_addr.slice(0, 6)}…{item.counterparty_addr.slice(-4)}</span>
                        <span style={{ color: 'var(--text-2)' }}>{item.kind === 0 ? `Joined Tier ${item.tier_index + 1}` : `Unlocked post #${item.content_id}`}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--text-2)', margin: 0 }}>No public supporter activity yet. Early supporters set the tone.</p>
                )}
              </div>

              <div className="card" style={{ padding: '16px', background: 'var(--bg-2)' }}>
                <div className="section-eyebrow">Share this creator</div>
                <div style={{ fontWeight: 700, margin: '6px 0 8px' }}>Bring people straight to the page that converts</div>
                <p style={{ fontSize: 12, color: 'var(--text-2)', margin: '0 0 12px' }}>
                  Send fans here when they are already interested. This page is built to turn curiosity into follows, tips, memberships, and paid unlocks.
                </p>
                <div style={{ display: 'grid', gap: 8 }}>
                  <button className="btn btn-sm btn-primary" style={{ width: '100%' }} onClick={() => void handleShareCreator()}>
                    Share creator page
                  </button>
                </div>
              </div>

              {!subStatus?.isActive && popularPaidPost && popularPaidPost.sales > 0 && (
                <div className="card" style={{ padding: '16px', background: 'var(--bg-2)', border: '1px solid rgba(254,119,201,0.18)' }}>
                  <div className="section-eyebrow">Popular paid unlock</div>
                  <div style={{ fontWeight: 700, margin: '6px 0 8px' }}>{popularPaidPost.content.title}</div>
                  <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12 }}>
                    Already unlocked {popularPaidPost.sales} time{popularPaidPost.sales === 1 ? '' : 's'}. Good proof that fans pay for this creator’s premium drops.
                  </p>
                  {popularPaidPost.content.access_level === ACCESS_LEVELS.PURCHASE ? (
                    <>
                      <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={() => handlePurchase(popularPaidPost.content.id)} disabled={purchasing === popularPaidPost.content.id}>
                        {purchasing === popularPaidPost.content.id ? 'Processing…' : `Buy for ${unitsToUsd(popularPaidPost.content.purchase_price)} USD`}
                      </button>
                      {cheapestTier && cheapestTier.price_per_month <= popularPaidPost.content.purchase_price && (
                        <p style={{ fontSize: 11, color: 'var(--accent)', margin: '10px 0 0' }}>
                          If you expect to want more than one post, the cheapest membership is the smarter buy.
                        </p>
                      )}
                    </>
                  ) : cheapestTier ? (
                    <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={() => handleSubscribe(0)} disabled={subscribing !== null}>
                      {subscribing === 0 ? 'Processing…' : `Subscribe from ${unitsToUsd(cheapestTier.price_per_month)} USD/mo`}
                    </button>
                  ) : null}
                </div>
              )}

              {supporterWall.length > 0 && (
                <div className="card" style={{ padding: '16px', background: 'var(--bg-2)' }}>
                  <div className="section-eyebrow">Top supporters</div>
                  <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                    {supporterWall.map((item, index) => (
                      <div key={`supporter-${item.counterparty_addr}-${item.timestamp}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, alignItems: 'center' }}>
                        <div style={{ minWidth: 0 }}>
                          <div className="mono" style={{ color: 'var(--accent)' }}>{item.counterparty_addr.slice(0, 6)}…{item.counterparty_addr.slice(-4)}</div>
                          <div style={{ color: 'var(--text-3)', fontSize: 11 }}>
                            {item.kind === 0 ? `Tier ${item.tier_index + 1} member` : `Unlocked post #${item.content_id}`}
                          </div>
                        </div>
                        <div style={{ fontWeight: 700 }}>${unitsToUsd(item.amount_paid)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="card" style={{ padding: '16px', background: 'var(--bg-2)', marginBottom: 18 }}>
              <div className="section-eyebrow">Tier comparison</div>
              <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
                {creator.tiers.map((tier, i) => (
                  <div key={`compare-${i}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', gap: 10, alignItems: 'center', fontSize: 12, paddingBottom: 10, borderBottom: i === creator.tiers.length - 1 ? 'none' : '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{tier.name}</div>
                      <div style={{ color: 'var(--text-3)' }}>{tier.description || 'Membership access'}</div>
                    </div>
                    <div className="mono" style={{ color: 'var(--accent)' }}>${unitsToUsd(tier.price_per_month)}/mo</div>
                    <div style={{ color: i === 0 ? 'var(--accent)' : 'var(--text-3)', fontWeight: i === 0 ? 700 : 500 }}>
                      {i === 0 ? 'Best entry' : `Tier ${i + 1}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="section-eyebrow" style={{ marginBottom: 16 }}>Membership Tiers</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {!subStatus?.isActive && creator.tiers.length > 0 && (
                <div className="card" style={{ padding: '16px', background: 'var(--bg-2)', border: '1px solid rgba(254,119,201,0.18)' }}>
                  <div className="section-eyebrow">Best next step</div>
                  <div style={{ fontWeight: 700, margin: '6px 0 8px' }}>Start with {creator.tiers[0].name}</div>
                  <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12 }}>
                    {purchaseOnlyCount > 0 && memberOnlyCount > 0
                      ? `You can buy ${purchaseOnlyCount} post${purchaseOnlyCount === 1 ? '' : 's'} one by one, or join once to unlock ${memberOnlyCount} member post${memberOnlyCount === 1 ? '' : 's'} plus future drops.`
                      : purchaseOnlyCount > 0
                        ? `Good for sampling. Buy ${purchaseOnlyCount} post${purchaseOnlyCount === 1 ? '' : 's'} one by one, or subscribe once if you want ongoing access.`
                        : `Low friction first. Convert with the cheapest tier, then upsell later through consistent drops.`}
                  </p>
                  <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={() => handleSubscribe(0)} disabled={subscribing !== null}>
                    {subscribing === 0 ? 'Processing…' : `Subscribe for ${unitsToUsd(creator.tiers[0].price_per_month)} USD/mo`}
                  </button>
                </div>
              )}
              {creator.tiers.map((tier, i) => {
                const isCurrentTier = subStatus?.isActive && subStatus.tierIndex === i
                const isLowerTier = subStatus?.isActive && subStatus.tierIndex > i
                return (
                  <motion.div key={i} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                    className="card"
                    style={{ padding: isMobile ? '16px' : '20px', border: isCurrentTier ? '1px solid var(--accent-dim)' : '1px solid var(--border)', background: isCurrentTier ? 'var(--accent-glow)' : 'var(--bg-2)' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '0.04em', marginBottom: 2 }}>{tier.name}</div>
                        {isCurrentTier && <span className="badge badge-accent" style={{ fontSize: 10 }}>Current</span>}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? '1.15rem' : '1.3rem', color: 'var(--accent)', lineHeight: 1 }}>{unitsToUsd(tier.price_per_month)}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.06em' }}>USD/MO</div>
                      </div>
                    </div>
                    {tier.description && <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 14, lineHeight: 1.5 }}>{tier.description}</p>}
                    <button
                      className={`btn btn-sm ${isCurrentTier || isLowerTier ? '' : 'btn-primary'}`}
                      style={{ width: '100%' }}
                      disabled={isCurrentTier || isLowerTier || subscribing !== null}
                      onClick={() => handleSubscribe(i)}
                    >
                      {subscribing === i ? 'Processing…' : isCurrentTier ? '✓ Subscribed' : isLowerTier ? 'Included' : 'Subscribe'}
                    </button>
                  </motion.div>
                )
              })}
            </div>
            {!connected && <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 16, textAlign: 'center' }}>Connect wallet to subscribe or purchase</p>}
          </aside>
        </div>
      </div>

      {tipModalOpen && <TipModal creatorAddr={creatorAddr} creatorName={creator.display_name} onClose={() => {}} />}
      {giftModalOpen && (
        <GiftSubscriptionModal
          creatorAddr={creatorAddr}
          creatorName={creator.display_name}
          tiers={creator.tiers}
          onClose={() => setGiftModalOpen(false)}
          onSuccess={() => void loadCreator(creatorAddr)}
        />
      )}
      {viewingContent && (
        <ContentViewer
          content={viewingContent}
          hasAccess={accessMap[viewingContent.id] ?? (viewingContent.access_level === ACCESS_LEVELS.FREE)}
          creatorAddr={creatorAddr}
          onClose={() => setViewingContent(null)}
        />
      )}
      <div style={{ height: isMobile ? 40 : 80 }} />
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div style={{ minHeight: '100%' }}>
      {/* Hero banner skeleton */}
      <div className="skeleton" style={{ height: 200, width: '100%', borderRadius: 0 }} />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px 8px' }}>
        {/* Profile card skeleton */}
        <div style={{ marginTop: 12, marginBottom: 24, padding: '20px 22px', background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
            <div className="skeleton" style={{ width: 80, height: 80, borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: 22, width: '60%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 16, width: '40%', marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 14, width: '80%' }} />
            </div>
          </div>
          {/* Bio skeleton */}
          <div className="skeleton" style={{ height: 14, width: '90%', marginBottom: 8 }} />
        </div>

        {/* Stats row skeleton */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 28, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ minWidth: 84 }}>
              <div className="skeleton" style={{ height: 24, width: 48, marginBottom: 6 }} />
              <div className="skeleton" style={{ height: 10, width: 64 }} />
            </div>
          ))}
        </div>

        {/* Content cards skeleton */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '160px minmax(0, 1fr)' }}>
              <div className="skeleton" style={{ height: 96, borderRadius: 0 }} />
              <div style={{ padding: '12px' }}>
                <div className="skeleton" style={{ height: 14, width: '70%', marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 11, width: '90%', marginBottom: 8 }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <div className="skeleton" style={{ height: 18, width: 48, borderRadius: 10 }} />
                  <div className="skeleton" style={{ height: 18, width: 60, borderRadius: 10 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
