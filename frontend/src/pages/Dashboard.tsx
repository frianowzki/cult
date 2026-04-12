import toast from 'react-hot-toast'
import { useEffect, useState } from 'react'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { motion } from 'framer-motion'
import FollowingFeed from '../components/FollowingFeed'

import {
  aptos,
  getCreatorProfile,
  getCreatorContent,
  buildToggleContentPayload,
  unitsToUsd,
  type CreatorProfile,
  type Content,
} from '../lib/aptos'
import { CONTENT_TYPE_ICONS, ACCESS_LEVEL_LABELS } from '../lib/constants'
import { resolveContentUrl, buildDeleteBlobPayload, parseCid } from '../lib/shelby'
import { useStore } from '../lib/store'
import UploadContentModal from '../components/UploadContentModal'
import EditProfileModal from '../components/EditProfileModal'
import ContentViewer from '../components/ContentViewer'

export default function Dashboard() {
  const { connected, account, signAndSubmitTransaction } = useWallet()
  const { uploadModalOpen, setUploadModalOpen, setRegisterModalOpen } = useStore()

  const [creator, setCreator] = useState<CreatorProfile | null>(null)
  const [contents, setContents] = useState<Content[]>([])
  const [loading, setLoading] = useState(true)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [viewingContent, setViewingContent] = useState<Content | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [dashTab, setDashTab] = useState<'posts' | 'following'>('posts')

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
      const [profile, contentList] = await Promise.all([
        getCreatorProfile(String(account.address)),
        getCreatorContent(String(account.address)),
      ])
      setCreator(profile)
      setContents(contentList)
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
          minHeight: '60vh',
          gap: 20,
          textAlign: 'center',
          padding: '60px 32px',
        }}
      >
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '3rem', color: 'var(--text-3)' }}>◌</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 300 }}>Connect your wallet</h2>
        <p>Connect Petra to access your creator dashboard</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px clamp(16px, 4vw, 32px)' }}>
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
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: 24,
          textAlign: 'center',
          padding: '60px 32px',
        }}
      >
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '4rem', color: 'var(--text-3)', fontStyle: 'italic' }}>
          CULT
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 300 }}>You're not yet a creator</h2>
        <p style={{ maxWidth: 400 }}>
          Register your creator profile to start publishing content and earning from your audience.
        </p>
        <button className="btn btn-primary btn-lg" onClick={() => setRegisterModalOpen(true)}>
          Register as Creator
        </button>
      </div>
    )
  }

  const avatarUrl = resolveContentUrl(creator.avatar_shelby_cid)

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px clamp(16px, 4vw, 32px) 8px' }}>
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

      <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '1px solid var(--border)' }}>
        {(['posts', 'following'] as const).map((tab) => (
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
            {tab === 'posts' ? 'Your Content' : 'Following Feed'}
          </button>
        ))}
      </div>

      {dashTab === 'following' ? (
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
      {editModalOpen && (
        <EditProfileModal
          profile={creator}
          onSuccess={loadData}
          onClose={() => setEditModalOpen(false)}
        />
      )}
      {viewingContent && (
        <ContentViewer
          content={viewingContent}
          hasAccess={true}
          onClose={() => setViewingContent(null)}
          onDelete={() => void handlePermanentDelete(viewingContent)}
          deleting={deletingId === viewingContent.id}
        />
      )}
    </div>
  )
}