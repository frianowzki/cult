import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { motion } from 'framer-motion'

import {
  getFollowing,
  getSavedContent,
  getCreatorProfile,
  getCreatorContent,
  canAccessContent,
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

export default function Feed() {
  const { account, connected } = useWallet()
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [viewingContent, setViewingContent] = useState<FeedItem | null>(null)
  const [savedItems, setSavedItems] = useState<Array<FeedItem & { savedAt: number }>>([])
  const [selectedTab, setSelectedTab] = useState<'following' | 'saved'>('following')

  useEffect(() => {
    void loadFeed()
  }, [account?.address])

  async function loadFeed() {
    if (!connected || !account?.address) {
      setItems([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const following = await getFollowing(String(account.address))
      if (!following.length) {
        setItems([])
        return
      }

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

      const merged = creators
        .flat()
        .sort((a, b) => b.content.published_at - a.content.published_at)

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
    } catch (e) {
      console.error(e)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const groupedCount = useMemo(() => new Set(items.map((item) => item.creatorAddr)).size, [items])

  if (!connected) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px clamp(16px, 4vw, 32px) 16px', textAlign: 'center', minHeight: '100%' }}>
        <div className="section-eyebrow">Feed</div>
        <h2 style={{ marginBottom: 12 }}>Connect wallet to view your feed</h2>
        <p>Follow creators first, then their newest posts will show up here.</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px clamp(16px, 4vw, 32px) 12px', minHeight: '100%' }}>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="section-eyebrow">Feed</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 300, marginBottom: 6 }}>From creators you follow</h2>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>Latest drops from the people you already care about.</p>
        </div>
        {!loading && (
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {selectedTab === 'following' ? `${items.length} posts · ${groupedCount} creators` : `${savedItems.length} saved`}
          </span>
        )}
      </div>

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
      ) : selectedTab === 'following' && items.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 24px', borderStyle: 'dashed' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.2rem', color: 'var(--text-3)', marginBottom: 12 }}>◌</div>
          <p style={{ marginBottom: 18 }}>Your feed is empty. Follow creators to see their posts here.</p>
          <Link to="/explore" className="btn btn-primary">Explore creators</Link>
        </div>
      ) : selectedTab === 'saved' && savedItems.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 24px', borderStyle: 'dashed' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.2rem', color: 'var(--text-3)', marginBottom: 12 }}>⌑</div>
          <p style={{ marginBottom: 18 }}>You haven’t saved any content yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(selectedTab === 'following' ? items : savedItems).map((item, index) => {
            const thumbUrl = resolveContentUrl(item.content.thumbnail_shelby_cid)
            const avatarUrl = resolveContentUrl(item.creator.avatar_shelby_cid)

            return (
              <motion.div
                key={`${item.creatorAddr}-${item.content.id}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="card"
                style={{ overflow: 'hidden', cursor: 'pointer' }}
                onClick={() => setViewingContent(item)}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(88px, 120px) 1fr', minHeight: 120 }}>
                  <div
                    style={{
                      background: thumbUrl ? `url(${thumbUrl}) center/cover no-repeat` : 'var(--bg-3)',
                      borderRight: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-3)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '1.8rem',
                      position: 'relative',
                    }}
                  >
                    {!thumbUrl && CONTENT_TYPE_ICONS[item.content.content_type]}
                    {!item.hasAccess && item.content.access_level !== 0 && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,8,7,0.56)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.8rem' }}>
                        🔒
                      </div>
                    )}
                  </div>

                  <div style={{ padding: '16px' }}>
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

                      <div style={{ textAlign: 'right' }}>
                        <div className="badge" style={{ fontSize: 9 }}>{ACCESS_LEVEL_LABELS[item.content.access_level]}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 6 }}>
                          {new Date(item.content.published_at * 1000).toLocaleString()}
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

                    <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>
                      {item.content.description || 'No description'}
                    </p>
                  </div>
                </div>
              </motion.div>
            )
          })}
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
