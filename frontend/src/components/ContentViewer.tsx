import toast from 'react-hot-toast'
import { useEffect, useState } from 'react'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { motion } from 'framer-motion'
import { getCreatorProfile, type Content } from '../lib/aptos'
import { resolveContentUrl } from '../lib/shelby'
import { CONTENT_TYPE_ICONS, CONTENT_TYPE_LABELS, ACCESS_LEVEL_LABELS } from '../lib/constants'

interface Props {
  content: Content
  hasAccess: boolean
  onClose: () => void
  onDelete?: () => void
  deleting?: boolean
}

export default function ContentViewer({ content, hasAccess, onClose, onDelete, deleting = false }: Props) {
  const { connected, account, signMessage } = useWallet()
  const [downloading, setDownloading] = useState(false)
  const [canDownload, setCanDownload] = useState(false)

  const contentUrl = resolveContentUrl(content.shelby_cid)

  useEffect(() => {
    let mounted = true

    const checkRegistered = async () => {
      if (!connected || !account?.address) {
        if (mounted) setCanDownload(false)
        return
      }

      try {
        const profile = await getCreatorProfile(String(account.address))
        if (mounted) setCanDownload(!!profile)
      } catch {
        if (mounted) setCanDownload(false)
      }
    }

    void checkRegistered()
    return () => {
      mounted = false
    }
  }, [connected, account?.address])
  const thumbnailUrl = resolveContentUrl(content.thumbnail_shelby_cid)
  const typeIcon = CONTENT_TYPE_ICONS[content.content_type]
  const typeLabel = CONTENT_TYPE_LABELS[content.content_type]

  async function handleDownload() {
    if (!contentUrl) return
    if (!connected || !account) {
      toast.error('Connect wallet first')
      return
    }
    if (!canDownload) {
      toast.error('Only registered accounts can download content')
      return
    }

    setDownloading(true)
    try {
      await signMessage({
        message: `Authorize download for \"${content.title}\"`,
        nonce: `${content.id}-${Date.now()}`,
        address: true,
        application: true,
        chainId: true,
      })

      const res = await fetch(contentUrl)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const parts = content.shelby_cid.split('::')
      a.download = parts[1] || `content-${content.id}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Download authorized')
    } catch (e) {
      console.error('Download failed:', e)
      toast.error('Download cancelled or failed')
    } finally {
      setDownloading(false)
    }
  }

  function renderPreview() {
    if (!hasAccess) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 16, padding: '60px 32px',
          background: 'var(--bg-3)', borderRadius: 'var(--radius-md)',
          minHeight: 280,
        }}>
          {thumbnailUrl ? (
            <div style={{ position: 'relative', width: '100%' }}>
              <img src={thumbnailUrl} alt="thumbnail"
                style={{ width: '100%', maxHeight: 300, objectFit: 'cover', borderRadius: 'var(--radius-md)', filter: 'blur(12px)', opacity: 0.4 }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <div style={{ fontSize: '2.5rem', fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>🔒</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, color: 'var(--text)' }}>
                  {ACCESS_LEVEL_LABELS[content.access_level]} required
                </div>
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: '3rem', fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>🔒</div>
              <p style={{ color: 'var(--text-2)', textAlign: 'center' }}>
                This content requires {ACCESS_LEVEL_LABELS[content.access_level]} access
              </p>
            </>
          )}
        </div>
      )
    }

    // Video
    if (content.content_type === 0 && contentUrl) {
      return (
        <video
          controls
          autoPlay={false}
          style={{ width: '100%', borderRadius: 'var(--radius-md)', maxHeight: 'min(52vh, 400px)', background: '#000' }}
          poster={thumbnailUrl || undefined}
        >
          <source src={contentUrl} />
          Your browser does not support video playback.
        </video>
      )
    }

    // Image
    if (content.content_type === 1 && contentUrl) {
      return (
        <img
          src={contentUrl}
          alt={content.title}
          style={{ width: '100%', maxHeight: 'min(60vh, 500px)', objectFit: 'contain', borderRadius: 'var(--radius-md)', background: 'var(--bg-3)' }}
        />
      )
    }

    // Audio
    if (content.content_type === 2 && contentUrl) {
      return (
        <div style={{ padding: '32px', background: 'var(--bg-3)', borderRadius: 'var(--radius-md)' }}>
          {thumbnailUrl && (
            <img src={thumbnailUrl} alt="thumbnail"
              style={{ width: '100%', height: 'min(32vh, 200px)', objectFit: 'cover', borderRadius: 'var(--radius-md)', marginBottom: 20 }} />
          )}
          {!thumbnailUrl && (
            <div style={{ textAlign: 'center', fontSize: '4rem', marginBottom: 20, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>♪</div>
          )}
          <audio controls style={{ width: '100%' }}>
            <source src={contentUrl} />
            Your browser does not support audio playback.
          </audio>
        </div>
      )
    }

    // Article / text
    if (content.content_type === 3) {
      return (
        <div style={{ padding: '28px 32px', background: 'var(--bg-3)', borderRadius: 'var(--radius-md)', minHeight: 200 }}>
          <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>
            {content.description || 'No preview available. Download to read the full content.'}
          </p>
          {contentUrl && (
            <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-3)' }}>
              Full content available via download ↓
            </p>
          )}
        </div>
      )
    }

    // Fallback — thumbnail or icon
    return (
      <div style={{ padding: '40px', background: 'var(--bg-3)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="thumbnail"
            style={{ maxWidth: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 'var(--radius-md)' }} />
        ) : (
          <div style={{ fontSize: '4rem', fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{typeIcon}</div>
        )}
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        className="modal"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.25 }}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 720, width: '100%' }}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: 16 }}>{typeIcon}</span>
              <span className="badge">{typeLabel}</span>
              {hasAccess && <span className="badge badge-accent">✓ Unlocked</span>}
            </div>
            <h3 style={{ fontWeight: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {content.title}
            </h3>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* Preview */}
        <div style={{ padding: '0 clamp(16px, 4vw, 32px)' }}>
          {renderPreview()}
        </div>

        {/* Description */}
        {content.description && (
          <div style={{ padding: '20px clamp(16px, 4vw, 32px) 0' }}>
            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>{content.description}</p>
          </div>
        )}

        {/* Meta */}
        <div style={{ padding: '16px clamp(16px, 4vw, 32px) 0', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span className="badge">{ACCESS_LEVEL_LABELS[content.access_level]}</span>
          <span className="badge mono" style={{ fontSize: 10 }}>
            {new Date(content.published_at * 1000).toLocaleDateString()}
          </span>
          {content.purchase_price > 0 && (
            <span className="badge badge-accent">
              ${(content.purchase_price / 100_000_000).toFixed(2)}
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <button className="btn" onClick={onClose}>Close</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {hasAccess && onDelete && (
              <button
                className="btn btn-ghost"
                onClick={onDelete}
                disabled={deleting}
                style={{ color: '#ff8a8a', borderColor: 'rgba(255,138,138,0.25)' }}
              >
                {deleting ? 'Deleting…' : 'Delete Permanently'}
              </button>
            )}
            {hasAccess && contentUrl && canDownload && (
              <button
                className="btn btn-primary"
                onClick={handleDownload}
                disabled={downloading || deleting || !connected}
                title={connected ? 'Sign to authorize download' : 'Connect wallet to download'}
              >
                {downloading ? 'Signing…' : '↓ Download'}
              </button>
            )}
            {hasAccess && contentUrl && connected && !canDownload && (
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Register an account to download
              </span>
            )}
            {!hasAccess && (
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Subscribe or purchase to unlock
              </span>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
