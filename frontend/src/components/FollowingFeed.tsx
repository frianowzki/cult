import { useState, useEffect } from 'react'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  getFollowing,
  getCreatorProfile,
  getCreatorContent,
  type CreatorProfile,
  type Content,
} from '../lib/aptos'
import { resolveContentUrl } from '../lib/shelby'
import { CONTENT_TYPE_ICONS, ACCESS_LEVEL_LABELS, ACCESS_LEVELS } from '../lib/constants'

interface FeedItem {
  creator: CreatorProfile
  creatorAddr: string
  content: Content
}

export default function FollowingFeed() {
  const { account } = useWallet()
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [following, setFollowing] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (account?.address) loadFeed()
  }, [account?.address])

  async function loadFeed() {
    setLoading(true)
    try {
      const addrs = await getFollowing(String(account!.address))
      setFollowing(addrs)

      if (addrs.length === 0) {
        setFeed([])
        return
      }

      // Fetch profiles and content for all followed creators
      const results = await Promise.all(
        addrs.map(async (addr) => {
          const [profile, contents] = await Promise.all([
            getCreatorProfile(addr),
            getCreatorContent(addr),
          ])
          if (!profile) return []
          // Return latest 3 content items per creator
          return contents.slice(0, 3).map((content) => ({
            creator: profile,
            creatorAddr: addr,
            content,
          }))
        })
      )

      // Flatten and sort by published_at descending
      const flat = results.flat().sort((a, b) => b.content.published_at - a.content.published_at)
      setFeed(flat)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 80, borderRadius: 4 }} />
        ))}
      </div>
    )
  }

  if (following.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 32px', color: 'var(--text-3)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', marginBottom: 12 }}>◌</div>
        <p style={{ marginBottom: 16 }}>You're not following anyone yet.</p>
        <Link to="/explore" className="btn btn-primary btn-sm">Discover Creators</Link>
      </div>
    )
  }

  if (feed.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 32px', color: 'var(--text-3)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', marginBottom: 12 }}>◌</div>
        <p>Creators you follow haven't posted yet.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, border: '1px solid var(--border)' }}>
      {feed.map(({ creator, creatorAddr, content }, i) => {
        const thumbUrl = resolveContentUrl(content.thumbnail_shelby_cid)
        const isFree = content.access_level === ACCESS_LEVELS.FREE

        return (
          <motion.div
            key={`${creatorAddr}-${content.id}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            style={{
              display: 'grid',
              gridTemplateColumns: '80px 1fr',
              background: 'var(--bg-2)',
              borderBottom: '1px solid var(--border)',
              overflow: 'hidden',
            }}
          >
            {/* Thumbnail */}
            <Link to={`/${creatorAddr}`}>
              <div style={{
                height: '100%', minHeight: 80,
                background: thumbUrl ? `url(${thumbUrl}) center/cover no-repeat` : 'var(--bg-3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRight: '1px solid var(--border)',
              }}>
                {!thumbUrl && (
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: '1.2rem' }}>
                    {CONTENT_TYPE_ICONS[content.content_type]}
                  </span>
                )}
              </div>
            </Link>

            {/* Info */}
            <div style={{ padding: '14px 16px' }}>
              {/* Creator */}
              <Link to={`/${creatorAddr}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)' }}>
                  @{creator.handle}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
                  {new Date(content.published_at * 1000).toLocaleDateString()}
                </span>
              </Link>

              {/* Title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: 12 }}>
                  {CONTENT_TYPE_ICONS[content.content_type]}
                </span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{content.title}</span>
                {!isFree && (
                  <span className="badge" style={{ fontSize: 9 }}>
                    {ACCESS_LEVEL_LABELS[content.access_level]}
                  </span>
                )}
              </div>

              {/* Description preview */}
              {content.description && (
                <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {content.description}
                </p>
              )}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
