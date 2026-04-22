import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { unitsToUsd, getAllCreators, type IndexedCreator } from '../lib/aptos'
import { CONTENT_TYPE_ICONS } from '../lib/constants'
import { resolveContentUrl } from '../lib/shelby'

const ACCENT_CHARS = ['♪', '◉', '✦', '▶', '◈', '⬡', '◎', '▣', '⊕']

function rankCreators(creators: IndexedCreator[], normalizedSearch: string) {
  const now = Date.now() / 1000

  return creators
    .map((creator) => {
      const ageDays = Math.max(1, (now - creator.created_at) / 86400)
      const subscriberScore = Math.min(creator.subscriber_count, 250) * 2.2
      const contentScore = Math.min(creator.content_count, 80) * 1.1
      const earningsScore = Math.min(creator.total_earned / 100000000, 400) * 0.18
      const freshnessScore = 220 / Math.sqrt(ageDays)
      const searchableScore = creator.searchable_content.length > 0 ? 18 : 0
      const hasTiersScore = creator.tiers.length > 0 ? 16 : 0
      const searchBoost = normalizedSearch
        ? ([creator.handle, creator.display_name, creator.bio]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(normalizedSearch))
            ? 140
            : creator.searchable_content.some((content) =>
                [content.title, content.description]
                  .filter(Boolean)
                  .some((value) => value.toLowerCase().includes(normalizedSearch))
              )
              ? 90
              : 0)
        : 0

      return {
        ...creator,
        __rank: subscriberScore + contentScore + earningsScore + freshnessScore + searchableScore + hasTiersScore + searchBoost,
      }
    })
    .sort((a, b) => b.__rank - a.__rank || b.subscriber_count - a.subscriber_count || b.content_count - a.content_count)
}

export default function Explore() {
  const [search, setSearch] = useState('')
  const [creators, setCreators] = useState<IndexedCreator[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    loadCreators()
  }, [])

  async function loadCreators() {
    setLoading(true)
    setError(false)
    try {
      const data = await getAllCreators()
      setCreators(data)
    } catch (e) {
      console.error(e)
      if (creators.length === 0) {
        setError(true)
      }
    } finally {
      setLoading(false)
    }
  }

  const normalizedSearch = search.trim().toLowerCase().replace(/^@/, '')

  const filtered = rankCreators(creators.filter((c) => {
    if (!normalizedSearch) return true

    const matchesCreator = [c.handle, c.display_name, c.bio]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedSearch))

    if (matchesCreator) return true

    return c.searchable_content.some((content) =>
      [content.title, content.description]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch))
    )
  }), normalizedSearch)

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px clamp(16px, 4vw, 32px) 16px', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 48 }}>
        <div className="section-eyebrow">Discover</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 300, marginBottom: 24 }}>
          Find your circle
        </h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search creators or content"
            style={{ minWidth: 0, width: '100%', maxWidth: 320 }}
          />
          <button className="btn btn-primary btn-sm" onClick={loadCreators}>
            Search
          </button>
        </div>
      </div>

      {/* Results count */}
      {!loading && (
        <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {filtered.length} creator{filtered.length !== 1 ? 's' : ''}
            {normalizedSearch ? ` matching @${normalizedSearch}` : ' on-chain'}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={loadCreators}
            style={{ fontSize: 11 }}
          >
            ↻ Refresh
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: 1, border: '1px solid var(--border)' }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} style={{ padding: '32px', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
                <div className="skeleton" style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ height: 16, width: '60%', marginBottom: 8 }} />
                  <div className="skeleton" style={{ height: 12, width: '40%' }} />
                </div>
              </div>
              <div className="skeleton" style={{ height: 12, width: '100%', marginBottom: 6 }} />
              <div className="skeleton" style={{ height: 12, width: '80%' }} />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div style={{ textAlign: 'center', padding: '80px 32px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', color: 'var(--text-3)', marginBottom: 16 }}>◌</div>
          <p style={{ color: 'var(--text-2)', marginBottom: 20 }}>Could not load creators from indexer</p>
          <button className="btn" onClick={loadCreators}>Try again</button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 32px', color: 'var(--text-3)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', marginBottom: 12 }}>◌</div>
          <p>
            {creators.length === 0
              ? 'No creators registered yet — be the first!'
              : normalizedSearch
                ? `No creators or content found for ${search.trim()}`
                : 'No creators found'}
          </p>
        </div>
      )}

      {/* Grid */}
      {!loading && !error && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: 1, border: '1px solid var(--border)' }}>
          {filtered.map((creator, i) => {
            const avatarUrl = resolveContentUrl(creator.avatar_shelby_cid)
            const accentChar = ACCENT_CHARS[i % ACCENT_CHARS.length]
            return (
              <motion.div
                key={creator.address}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  to={`/u/${creator.handle}`}
                  style={{
                    display: 'block',
                    background: 'var(--bg-2)',
                    borderRight: '1px solid var(--border)',
                    borderBottom: '1px solid var(--border)',
                    padding: '32px',
                    transition: 'background var(--transition)',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-3)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)' }}
                >
                  {/* Avatar + name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
                      background: avatarUrl
                        ? `url(${avatarUrl}) center/cover no-repeat`
                        : 'var(--bg-4)',
                      border: '1px solid var(--border-light)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.3rem', color: 'var(--accent)', fontFamily: 'var(--font-mono)',
                    }}>
                      {!avatarUrl && accentChar}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{creator.display_name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)' }}>
                          @{creator.handle}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bio */}
                  <p style={{
                    fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 16,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {creator.bio || 'No bio yet.'}
                  </p>

                  <div style={{ marginBottom: 16, padding: '10px 12px', border: '1px solid rgba(254,119,201,0.14)', background: 'rgba(254,119,201,0.04)' }}>
                    <div className="section-eyebrow" style={{ marginBottom: 6 }}>Why open this creator</div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55 }}>
                      {creator.tiers.length > 0
                        ? `Membership starts at ${unitsToUsd(creator.tiers[0].price_per_month)} USD/mo, with ${creator.content_count} post${creator.content_count === 1 ? '' : 's'} already on the page.`
                        : `${creator.content_count} post${creator.content_count === 1 ? '' : 's'} live${creator.subscriber_count > 0 ? ` and ${creator.subscriber_count} subscriber${creator.subscriber_count === 1 ? '' : 's'} already backing them.` : '.'}`}
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'flex', gap: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--text)', lineHeight: 1 }}>
                        {creator.subscriber_count}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Fans</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--text)', lineHeight: 1 }}>
                        {creator.content_count}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Posts</div>
                    </div>
                    {creator.tiers.length > 0 && (
                      <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--accent)', lineHeight: 1 }}>
                          ${unitsToUsd(creator.tiers[0].price_per_month)}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>From / mo</div>
                      </div>
                    )}
                  </div>

                  {normalizedSearch && creator.searchable_content.some((content) =>
                    [content.title, content.description]
                      .filter(Boolean)
                      .some((value) => value.toLowerCase().includes(normalizedSearch))
                  ) && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                      <div className="mono" style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 10 }}>
                        Matching content
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {creator.searchable_content
                          .filter((content) =>
                            [content.title, content.description]
                              .filter(Boolean)
                              .some((value) => value.toLowerCase().includes(normalizedSearch))
                          )
                          .slice(0, 3)
                          .map((content) => (
                            <div key={content.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: 12, marginTop: 1 }}>
                                {CONTENT_TYPE_ICONS[content.content_type]}
                              </span>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{content.title}</div>
                                {content.description && (
                                  <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
                                    {content.description.length > 96 ? `${content.description.slice(0, 96)}…` : content.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Tier pills */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                    {creator.tiers.map((_, ti) => (
                      <span key={ti} className="badge" style={{ fontSize: 10 }}>Tier {ti + 1}</span>
                    ))}
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>Open creator page →</span>
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
