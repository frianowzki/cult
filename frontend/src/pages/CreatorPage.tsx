import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

import {
  getCreatorProfile,
  getCreatorContent,
  getSubscriptionStatus,
  canAccessContent,
  buildSubscribePayload,
  buildPurchaseContentPayload,
  getCreatorAddressByHandle,
  unitsToUsd,
  type CreatorProfile,
  type Content,
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

export default function CreatorPage() {
  const { handle } = useParams<{ handle: string }>()
  const { account, signAndSubmitTransaction, connected } = useWallet()
  const { openTipModal, tipModalOpen } = useStore()

  const [creator, setCreator] = useState<CreatorProfile | null>(null)
  const [contents, setContents] = useState<Content[]>([])
  const [subStatus, setSubStatus] = useState<{ isActive: boolean; tierIndex: number; expiresAt: number } | null>(null)
  const [accessMap, setAccessMap] = useState<Record<number, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState<'all' | 'video' | 'image' | 'audio' | 'article'>('all')
  const [subscribing, setSubscribing] = useState<number | null>(null)
  const [purchasing, setPurchasing] = useState<number | null>(null)
  const [viewingContent, setViewingContent] = useState<Content | null>(null)
  const [creatorAddr, setCreatorAddr] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const [giftModalOpen, setGiftModalOpen] = useState(false)

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
      const [profile, contentList] = await Promise.all([
        getCreatorProfile(resolvedCreatorAddr),
        getCreatorContent(resolvedCreatorAddr),
      ])
      setCreator(profile)
      setContents(contentList)

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
      setSubscribing(tierIndex)
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

  const filteredContent = useMemo(() => contents.filter((c) => {
    if (selectedTab === 'all') return true
    const typeMap: Record<string, number> = { video: 0, image: 1, audio: 2, article: 3 }
    return c.content_type === typeMap[selectedTab]
  }), [contents, selectedTab])

  if (loading) return <LoadingSkeleton />

  if (!creator) {
    return (
      <div style={{ textAlign: 'center', padding: '120px 16px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', color: 'var(--text-3)' }}>Creator not found</div>
        <p style={{ marginTop: 12 }}>Username: <span className="mono">@{handle}</span></p>
      </div>
    )
  }

  const avatarUrl = resolveContentUrl(creator.avatar_shelby_cid)
  const bannerUrl = resolveContentUrl(creator.banner_shelby_cid)

  return (
    <div style={{ minHeight: '100%', marginTop: isMobile ? -116 : -60, paddingTop: isMobile ? 116 : 60 }}>
      <div style={{ height: isMobile ? 140 : 'clamp(140px, 28vw, 220px)', background: bannerUrl ? `url(${bannerUrl}) center/cover no-repeat` : 'linear-gradient(135deg, #1a1510 0%, #2a2015 50%, #1a1510 100%)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(6,6,6,0.08) 0%, rgba(6,6,6,0.18) 30%, rgba(6,6,6,0.58) 78%, var(--bg) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(8,8,8,0.35) 0%, transparent 28%, transparent 72%, rgba(8,8,8,0.35) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, transparent 0%, transparent 52%, rgba(0,0,0,0.18) 100%)' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontFamily: 'var(--font-mono)', fontSize: isMobile ? '2.6rem' : '4rem', color: 'rgba(200,169,110,0.08)', pointerEvents: 'none', userSelect: 'none' }}>✦</div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: `0 ${isMobile ? 14 : 32}px 8px`, minHeight: `calc(100% - ${isMobile ? 140 : 220}px)` }}>
        <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginTop: isMobile ? 8 : 12, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
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
            <div style={{ paddingBottom: 4, paddingTop: isMobile ? 8 : 18, minWidth: 0 }}>
              <h2 style={{ fontSize: isMobile ? '1.45rem' : '1.8rem', fontWeight: 300, marginBottom: 2, lineHeight: 1.1, wordBreak: 'break-word' }}>{creator.display_name}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="mono" style={{ fontSize: 12, color: 'var(--accent)' }}>@{creator.handle}</span>
                {subStatus?.isActive && (
                  <span className="badge badge-accent" style={{ marginLeft: 0 }}>
                    ✦ {creator.tiers[subStatus.tierIndex]?.name || 'Subscribed'}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingBottom: 4, flexWrap: 'wrap' }}>
            <FollowButton creatorAddr={creatorAddr} size="sm" />
            <button className="btn btn-sm" onClick={() => openTipModal(creatorAddr)}>♡ Tip</button>
            <button className="btn btn-sm" onClick={() => setGiftModalOpen(true)}>Gift</button>
          </div>
        </div>

        {creator.bio && (
          <p style={{ maxWidth: 560, marginBottom: 20, color: 'var(--text-2)', lineHeight: 1.65, fontSize: isMobile ? 13 : 15 }}>{creator.bio}</p>
        )}

        <div style={{ display: 'flex', gap: isMobile ? 14 : 20, flexWrap: 'wrap', marginBottom: 28, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
          {[[creator.subscriber_count, 'Subscribers'], [contents.length, 'Posts'], ['$' + unitsToUsd(creator.total_earned), 'Earned']].map(([val, label]) => (
            <div key={String(label)} style={{ minWidth: isMobile ? 84 : 'auto' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? '1.35rem' : '1.6rem', fontWeight: 300, color: 'var(--text)', lineHeight: 1 }}>{val}</div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr)', gap: 24, alignItems: 'start' }}>
          <div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '1px solid var(--border)', overflowX: 'auto', paddingBottom: 2 }}>
              {(['all', 'video', 'image', 'audio', 'article'] as const).map((tab) => (
                <button key={tab} className="btn btn-ghost btn-sm" onClick={() => setSelectedTab(tab)}
                  style={{ color: selectedTab === tab ? 'var(--accent)' : 'var(--text-3)', borderBottom: selectedTab === tab ? '2px solid var(--accent)' : '2px solid transparent', borderRadius: 0, paddingBottom: 10, flexShrink: 0 }}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {filteredContent.length === 0 ? (
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
                              <button className="btn btn-sm btn-primary" onClick={() => handlePurchase(content.id)} disabled={purchasing === content.id} style={{ whiteSpace: 'nowrap', fontSize: 10, padding: '8px 10px' }}>
                                {purchasing === content.id ? '…' : `Buy ${unitsToUsd(content.purchase_price)} USD`}
                              </button>
                            ) : connected ? (
                              <button
                                className="btn btn-sm"
                                onClick={() => handleSubscribe(Math.max(0, content.access_level - 1))}
                                disabled={subscribing !== null}
                                style={{ whiteSpace: 'nowrap', fontSize: 10, padding: '8px 10px' }}
                              >
                                {subscribing === Math.max(0, content.access_level - 1) ? '…' : `Unlock with Tier ${content.access_level}`}
                              </button>
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
            <div className="section-eyebrow" style={{ marginBottom: 16 }}>Membership Tiers</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
    <div>
      <div className="skeleton" style={{ height: 220, width: '100%' }} />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px' }}>
        <div style={{ display: 'flex', gap: 20, marginBottom: 32 }}>
          <div className="skeleton" style={{ width: 88, height: 88, borderRadius: '50%' }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 24, width: 200, marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 14, width: 120 }} />
          </div>
        </div>
      </div>
    </div>
  )
}
