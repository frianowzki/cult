import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Content } from '../lib/aptos-types'
import { CONTENT_TYPE_ICONS } from '../lib/constants'
import { resolveContentUrl } from '../lib/shelby'

/* ─── Types ─── */

interface Collection {
  id: string
  name: string
  description: string
  contentIds: number[]
  createdAt: number
}

/* ─── LocalStorage helper ─── */

function loadCollections(creatorAddr: string): Collection[] {
  try {
    const raw = localStorage.getItem(`cult:collections:${creatorAddr}`)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/* ─── Component ─── */

interface Props {
  creatorAddr: string
  contents: Content[]
}

export default function CollectionViewer({ creatorAddr, contents }: Props) {
  const [collections, setCollections] = useState<Collection[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    setCollections(loadCollections(creatorAddr))
  }, [creatorAddr])

  function getContentById(id: number): Content | undefined {
    return contents.find((c) => c.id === id)
  }

  const activeCollection = activeId ? collections.find((c) => c.id === activeId) : null
  const activeContent = activeCollection
    ? (activeCollection.contentIds.map(getContentById).filter(Boolean) as Content[])
    : []

  /* ── Empty state ── */
  if (collections.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-3)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', marginBottom: 12 }}>◎</div>
        <p style={{ fontSize: 13 }}>No collections yet.</p>
      </div>
    )
  }

  /* ── Active collection detail view ── */
  if (activeCollection) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Back button & header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setActiveId(null)}
            style={{ fontSize: 13 }}
          >
            ← Back
          </button>
          <div>
            <h3
              style={{
                margin: 0,
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--accent)',
              }}
            >
              {activeCollection.name}
            </h3>
            {activeCollection.description && (
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-3)' }}>
                {activeCollection.description}
              </p>
            )}
          </div>
          <span className="badge" style={{ marginLeft: 'auto', fontSize: 11 }}>
            {activeContent.length} items
          </span>
        </div>

        {/* Content grid */}
        {activeContent.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-3)', fontSize: 13 }}>
            This collection has no content yet.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 12,
            }}
          >
            {activeContent.map((item, i) => {
              const thumbUrl = resolveContentUrl(item.thumbnail_shelby_cid)
              const icon = CONTENT_TYPE_ICONS[item.content_type] ?? '•'

              return (
                <motion.div
                  key={item.id}
                  className="card"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  style={{ overflow: 'hidden', cursor: 'pointer' }}
                >
                  {/* Thumbnail */}
                  <div
                    style={{
                      height: 140,
                      background: thumbUrl
                        ? `url(${thumbUrl}) center/cover no-repeat`
                        : 'var(--bg-3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                    }}
                  >
                    {!thumbUrl && (
                      <span style={{ fontSize: 32, color: 'var(--text-3)' }}>{icon}</span>
                    )}
                    <span
                      className="badge"
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        fontSize: 11,
                      }}
                    >
                      {icon}
                    </span>
                  </div>

                  {/* Info */}
                  <div style={{ padding: '10px 12px' }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 13,
                        fontFamily: 'var(--font-display)',
                        color: 'var(--text-2)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.title}
                    </div>
                    {item.description && (
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--text-3)',
                          marginTop: 4,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {item.description}
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </motion.div>
    )
  }

  /* ── Collections grid ── */
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 12,
      }}
    >
      {collections.map((col, i) => {
        const firstItems = col.contentIds.slice(0, 3).map(getContentById).filter(Boolean) as Content[]
        const thumbUrl = firstItems.length > 0 ? resolveContentUrl(firstItems[0].thumbnail_shelby_cid) : ''

        return (
          <motion.div
            key={col.id}
            className="card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => setActiveId(col.id)}
            style={{ overflow: 'hidden', cursor: 'pointer' }}
            whileHover={{ scale: 1.02 }}
          >
            {/* Thumbnail mosaic */}
            <div
              style={{
                height: 120,
                background: thumbUrl
                  ? `url(${thumbUrl}) center/cover no-repeat`
                  : 'var(--bg-3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              {!thumbUrl && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 28, color: 'var(--text-3)' }}>
                  ◎
                </span>
              )}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: '24px 12px 8px',
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                }}
              >
                <span className="badge" style={{ fontSize: 11 }}>
                  {col.contentIds.length} items
                </span>
              </div>
            </div>

            {/* Info */}
            <div style={{ padding: '10px 12px' }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 14,
                  fontFamily: 'var(--font-display)',
                  color: 'var(--accent)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {col.name}
              </div>
              {col.description && (
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-3)',
                    marginTop: 4,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {col.description}
                </div>
              )}

              {/* Mini content previews */}
              {firstItems.length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                  {firstItems.map((item) => (
                    <span
                      key={item.id}
                      className="badge"
                      style={{ fontSize: 10 }}
                      title={item.title}
                    >
                      {CONTENT_TYPE_ICONS[item.content_type] ?? '•'} {item.title.slice(0, 16)}
                      {item.title.length > 16 ? '…' : ''}
                    </span>
                  ))}
                  {col.contentIds.length > 3 && (
                    <span className="badge" style={{ fontSize: 10, color: 'var(--text-3)' }}>
                      +{col.contentIds.length - 3} more
                    </span>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
