import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { motion } from 'framer-motion'

import {
  getFollowing,
  getSavedContent,
  getCreatorProfile,
  getCreatorContent,
  getAllCreators,
  canAccessContent,
  getCommentsForContent,
  type Content,
  type CreatorProfile,
  type SaveRecord,
} from '../lib/aptos'
import { CONTENT_TYPE_ICONS, ACCESS_LEVEL_LABELS } from '../lib/constants'
import { resolveContentUrl } from '../lib/shelby'
import ContentViewer from '../components/ContentViewer'

type FeedItem = {
  creatorAddr: string
  creator: CreatorProfile
  content: Content
  hasAccess: boolean
}

function rankFeedItems(feedItems: FeedItem[], isPublicFeed: boolean) {
  const now = Date.now() / 1000

  return feedItems
    .map((item) => {
      const hoursOld = Math.max(1, (now - item.content.published_at) / 3600)
      const recencyScore = 1000 / Math.sqrt(hoursOld)
      const creatorScore = Math.min(item.creator.subscriber_count, 250) * 0.8
      const earningsScore = Math.min(item.creator.total_earned / 100000000, 200) * 0.15
      const freeBoost = isPublicFeed && item.content.access_level === 0 ? 25 : 0
      const mediaBoost = item.content.content_type === 0 ? 18 : item.content.content_type === 1 ? 12 : item.content.content_type === 2 ? 8 : 4
      const titleBoost = item.content.title.trim().length > 0 ? 6 : 0

      return {
        ...item,
        __rank: recencyScore + creatorScore + earningsScore + freeBoost + mediaBoost + titleBoost,
      }
    })
    .sort((a, b) => b.__rank - a.__rank || b.content.published_at - a.content.published_at)
    .map(({ __rank, ...item }) => item)
}

const FEED_PAGE_SIZE = 12

export default function Feed() {
  const { account, connected } = useWallet()
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [viewingContent, setViewingContent] = useState<FeedItem | null>(null)
  const [savedItems, setSavedItems] = useState<Array<FeedItem & { savedAt: number }>>([])
  const [selectedTab, setSelectedTab] = useState<'following' | 'saved'>('following')
  const [visibleCount, setVisibleCount] = useState(FEED_PAGE_SIZE)
  const [engagementMap, setEngagementMap] = useState<Record<string, number>>({})

  useEffect(() => {
    void loadFeed()
  }, [account?.address])

  async function loadFeed() {
    setLoading(true)
    try {
      if (!connected || !account?.address) {
        const creators = await getAllCreators()
        const publicFeedGroups = await Promise.all(
          creators.map(async (creator) => {
            const contents = await getCreatorContent(creator.address)
            return contents
              .filter((content) => content.access_level === 0)
              .map((content) => ({
                creatorAddr: creator.address,
                creator: {
                  creator_addr: creator.address,
                  handle: creator.handle,
                  display_name: creator.display_name,
                  bio: creator.bio,
                  avatar_shelby_cid: creator.avatar_shelby_cid,
                  banner_shelby_cid: creator.banner_shelby_cid,
                  tiers: creator.tiers,
                  total_earned: creator.total_earned,
                  subscriber_count: creator.subscriber_count,
                  content_count: creator.content_count,
                  created_at: creator.created_at,
                },
                content,
                hasAccess: true,
              }))
          })
        )

        const publicFeed = rankFeedItems(publicFeedGroups.flat(), true)

        setItems(publicFeed)
        setSavedItems([])
        setSelectedTab('following')
        return
      }

      const following = await getFollowing(String(account.address))
      if (!following.length) {
        setItems([])
      } else {
        const [followingSaved, creators] = await Promise.all([
          getSavedContent(String(account.address)),
          Promise.all(
            following.map(async (creatorAddr) => {
              const [creator, contents] = await Promise.all([
                getCreatorProfile(creatorAddr),
                getCreatorContent(creatorAddr),
              ])
              if (!creator) return [] as FeedItem[]
              const accessList = await Promise.all(
                contents.map((content) => canAccessContent(String(account.address), creatorAddr, content.id))
              )
              return contents.map((content, index) => ({ creatorAddr, creator, content, hasAccess: accessList[index] }))
            })
          ),
        ])

        const merged = rankFeedItems(creators.flat(), false)

        setItems(merged)

        const savedRecords = followingSaved as SaveRecord[]
        if (savedRecords.length === 0) {
          setSavedItems([])
        } else {
          const uniqueCreators = Array.from(new Set(savedRecords.map((record) => record.creator_addr)))
          const savedCreatorData = await Promise.all(
            uniqueCreators.map(async (creatorAddr) => {
              const [creator, contents] = await Promise.all([
                getCreatorProfile(creatorAddr),
                getCreatorContent(creatorAddr),
              ])
              return creator ? { creatorAddr, creator, contents } : null
            })
          )

          const savedResolved = savedRecords
            .map((record) => {
              const creatorData = savedCreatorData.find((item) => item?.creatorAddr === record.creator_addr)
              if (!creatorData) return null
              const content = creatorData.contents.find((item) => item.id === record.content_id)
              if (!content) return null
              return {
                creatorAddr: record.creator_addr,
                creator: creatorData.creator,
                content,
                hasAccess: false,
                savedAt: record.saved_at,
              }
            })
            .filter((item): item is FeedItem & { savedAt: number } => item !== null)
            .sort((a, b) => b.savedAt - a.savedAt)

          setSavedItems(savedResolved)
        }
      }
    } catch (e) {
      console.error(e)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const groupedCount = useMemo(() => new Set(items.map((item) => item.creatorAddr)).size, [items])
  const activeItems = selectedTab === 'following' ? items : savedItems
  const visibleItems = activeItems.slice(0, visibleCount)

  useEffect(() => {
    let cancelled = false

    async function loadEngagement() {
      const uncachedItems = visibleItems.filter((item) => engagementMap[`${item.creatorAddr}-${item.content.id}`] === undefined)
      if (uncachedItems.length === 0) return

      const entries = await Promise.all(
        uncachedItems.map(async (item) => {
          try {
            const comments = await getCommentsForContent(item.creatorAddr, item.content.id)
            return [`${item.creatorAddr}-${item.content.id}`, comments.length] as const
          } catch {
            return [`${item.creatorAddr}-${item.content.id}`, 0] as const
          }
        })
      )

      if (!cancelled && entries.length > 0) {
        setEngagementMap((prev) => ({
          ...prev,
          ...Object.fromEntries(entries),
        }))
      }
    }

    void loadEngagement()
    return () => {
      cancelled = true
    }
  }, [visibleItems, engagementMap])
  const hasMoreItems = visibleCount < activeItems.length
  const shouldShowLoggedOutCta = !connected && visibleItems.length >= 4

  useEffect(() => {
    setVisibleCount(FEED_PAGE_SIZE)
  }, [selectedTab, items.length, savedItems.length, connected])

  function handleLoadMore() {
    setVisibleCount((count) => count + FEED_PAGE_SIZE)
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px clamp(16px, 4vw, 32px) 12px', minHeight: '100%' }}>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="section-eyebrow">Feed</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 300, marginBottom: connected ? 6 : 0 }}>{connected ? 'From creators you follow' : 'Discover CULT contents.'}</h2>
          {connected && <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>Latest drops from the people you already care about.</p>}
        </div>
        {!loading && (
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {!connected ? `${items.length} public posts` : selectedTab === 'following' ? `${items.length} posts · ${groupedCount} creators` : `${savedItems.length} saved`}
          </span>
        )}
      </div>

      {connected && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {(['following', 'saved'] as const).map((tab) => (
            <button
              key={tab}
              className="btn btn-ghost btn-sm"
              onClick={() => setSelectedTab(tab)}
              style={{
                color: selectedTab === tab ? 'var(--accent)' : 'var(--text-3)',
                borderBottom: selectedTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                borderRadius: 0,
                paddingBottom: 12,
                textTransform: 'capitalize',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="card" style={{ padding: 20 }}>
              <div className="skeleton" style={{ height: 18, width: '35%', marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 12, width: '100%', marginBottom: 6 }} />
              <div className="skeleton" style={{ height: 12, width: '70%' }} />
            </div>
          ))}
        </div>
      ) : items.length === 0 && (!connected || selectedTab === 'following') ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 24px', borderStyle: 'dashed' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.2rem', color: 'var(--text-3)', marginBottom: 12 }}>◌</div>
          <p style={{ marginBottom: 18 }}>{connected ? 'Your feed is empty. Follow creators to see their posts here.' : 'No public posts yet. Creators need to publish free content to show up here.'}</p>
          <Link to="/explore" className="btn btn-primary">Explore creators</Link>
        </div>
      ) : selectedTab === 'saved' && savedItems.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 24px', borderStyle: 'dashed' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.2rem', color: 'var(--text-3)', marginBottom: 12 }}>⌑</div>
          <p style={{ marginBottom: 18 }}>You haven’t saved any content yet.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16 }}>
            {visibleItems.flatMap((item, index) => {
            const thumbUrl = resolveContentUrl(item.content.thumbnail_shelby_cid)
            const contentUrl = resolveContentUrl(item.content.shelby_cid)
            const avatarUrl = resolveContentUrl(item.creator.avatar_shelby_cid)

            const cards = [(
              <motion.div
                key={`${item.creatorAddr}-${item.content.id}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="card"
                style={{ overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column', minHeight: 420 }}
                onClick={() => setViewingContent(item)}
              >
                <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
                  <div
                    style={{
                      background: 'var(--bg-3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-3)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '1.8rem',
                      position: 'relative',
                      aspectRatio: '4 / 5',
                      borderBottom: '1px solid var(--border)',
                      overflow: 'hidden',
                    }}
                  >
                    {item.content.access_level === 0 && contentUrl ? (
                      item.content.content_type === 0 ? (
                        <video
                          src={contentUrl}
                          muted
                          autoPlay
                          loop
                          playsInline
                          preload="metadata"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: '#000' }}
                        />
                      ) : item.content.content_type === 1 ? (
                        <img
                          src={contentUrl}
                          alt={item.content.title}
                          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: 'var(--bg)' }}
                        />
                      ) : item.content.content_type === 2 ? (
                        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, background: 'linear-gradient(180deg, rgba(254,119,201,0.10), rgba(254,119,201,0.02))' }}>
                          {thumbUrl ? (
                            <img
                              src={thumbUrl}
                              alt={item.content.title}
                              style={{ width: '100%', height: '100%', maxHeight: '68%', objectFit: 'contain', borderRadius: 0, display: 'block' }}
                            />
                          ) : (
                            <span style={{ fontSize: '3.25rem', color: 'var(--accent)' }}>♪</span>
                          )}
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 700, marginBottom: 4 }}>Audio post</div>
                            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Tap to listen</span>
                          </div>
                        </div>
                      ) : (
                        <div style={{ width: '100%', height: '100%', padding: 22, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start', textAlign: 'left', fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: 1.7, color: 'var(--text)', background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.00)), var(--bg-2)' }}>
                          <div>
                            <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 10 }}>Article preview</div>
                            <div style={{ display: '-webkit-box', WebkitLineClamp: 8, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {item.content.description || item.content.title}
                            </div>
                          </div>
                        </div>
                      )
                    ) : thumbUrl ? (
                      <div style={{ position: 'absolute', inset: 0, background: `url(${thumbUrl}) center/cover no-repeat` }} />
                    ) : (
                      CONTENT_TYPE_ICONS[item.content.content_type]
                    )}
                    {!item.hasAccess && item.content.access_level !== 0 && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,8,7,0.56)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.8rem' }}>
                        🔒
                      </div>
                    )}
                  </div>

                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
                      <Link to={`/u/${item.creator.handle}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }} onClick={(e) => e.stopPropagation()}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            background: avatarUrl ? `url(${avatarUrl}) center/cover no-repeat` : 'var(--bg-4)',
                            border: '1px solid var(--border-light)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--accent)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 12,
                            flexShrink: 0,
                          }}
                        >
                          {!avatarUrl && '✦'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{item.creator.display_name}</div>
                          <div className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>@{item.creator.handle}</div>
                        </div>
                      </Link>

                      <div style={{ textAlign: 'right', display: 'grid', gap: 6, justifyItems: 'end' }}>
                        <div className="badge" style={{ fontSize: 9 }}>{ACCESS_LEVEL_LABELS[item.content.access_level]}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-3)' }}>
                          {new Date(item.content.published_at * 1000).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: 12 }}>
                        {CONTENT_TYPE_ICONS[item.content.content_type]}
                      </span>
                      <div style={{ fontWeight: 700 }}>{item.content.title}</div>
                      <span style={{ fontSize: 11, color: item.hasAccess ? 'var(--accent)' : 'var(--text-3)', fontWeight: 600, marginLeft: 'auto' }}>
                        {item.hasAccess || item.content.access_level === 0 ? 'Open →' : 'Locked'}
                      </span>
                    </div>

                    <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, margin: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {item.content.description || 'No description'}
                    </p>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span className="badge" style={{ fontSize: 10 }}>
                        {engagementMap[`${item.creatorAddr}-${item.content.id}`] ?? 0} comments
                      </span>
                      {item.content.access_level === 0 && (
                        <span className="badge" style={{ fontSize: 10 }}>Open discussion</span>
                      )}
                    </div>

                    <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        {connected ? (item.hasAccess || item.content.access_level === 0 ? 'Tap to open' : 'Locked preview') : 'Free preview'}
                      </span>
                      <Link to={`/u/${item.creator.handle}`} style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }} onClick={(e) => e.stopPropagation()}>
                        See profile and offers →
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            )]

            if (!connected && index === 3 && shouldShowLoggedOutCta) {
              cards.push(
                <motion.div
                  key="logged-out-feed-cta"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card"
                  style={{ padding: '22px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 420, background: 'linear-gradient(180deg, rgba(254,119,201,0.08), rgba(254,119,201,0.02))', border: '1px solid rgba(254,119,201,0.18)' }}
                >
                  <div>
                    <div className="section-eyebrow">Want the full CULT experience?</div>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 300, marginBottom: 12 }}>Free posts are open. Wallet unlocks the rest.</h3>
                    <div style={{ display: 'grid', gap: 10, fontSize: 13, color: 'var(--text-2)' }}>
                      <div>• follow creators and build a real feed</div>
                      <div>• unlock paid posts and memberships</div>
                      <div>• save content and keep your history</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
                    <Link to="/explore" className="btn btn-primary">Explore creators</Link>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>You can already browse free posts without connecting.</span>
                  </div>
                </motion.div>
              )
            }

            return cards
            })}
          </div>

          {hasMoreItems && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button className="btn" onClick={handleLoadMore}>
                Load more
              </button>
            </div>
          )}
        </div>
      )}

      {viewingContent && (
        <ContentViewer
          content={viewingContent.content}
          hasAccess={viewingContent.hasAccess || viewingContent.content.access_level === 0}
          creatorAddr={viewingContent.creatorAddr}
          onClose={() => setViewingContent(null)}
        />
      )}
    </div>
  )
}
