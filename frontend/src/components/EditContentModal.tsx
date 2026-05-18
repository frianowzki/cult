import { useState } from 'react'
import { motion } from 'framer-motion'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import toast from 'react-hot-toast'

import { aptos, buildEditContentPayload, type Content } from '../lib/aptos'
import {
  encodeFileAndGetPayload,
  pushBlobToRpc,
  mockUpload,
  isShelbyEnabled,
  buildDeleteBlobPayload,
  parseCid,
  resolveContentUrl,
  SHELBY_REGISTER_BLOB_MAX_GAS,
  SHELBY_REGISTER_BLOB_GAS_UNIT_PRICE,
  SHELBY_EXPIRATION_OPTIONS,
  DEFAULT_BLOB_EXPIRATION_MS,
} from '../lib/shelby'
import { ACCESS_LEVELS, ACCESS_LEVEL_LABELS } from '../lib/constants'

interface Props {
  content: Content
  onSuccess: () => void
  onClose: () => void
}

export default function EditContentModal({ content, onSuccess, onClose }: Props) {
  const { account, signAndSubmitTransaction } = useWallet()
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState(content.title)
  const [description, setDescription] = useState(content.description)
  const [accessLevel, setAccessLevel] = useState<number>(content.access_level)
  const [purchasePrice, setPurchasePrice] = useState(
    content.purchase_price > 0 ? String(content.purchase_price / 100_000_000) : '1'
  )
  const [replacementFile, setReplacementFile] = useState<File | null>(null)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState('')
  const [removeThumbnail, setRemoveThumbnail] = useState(false)
  const [expirationMs, setExpirationMs] = useState<number>(DEFAULT_BLOB_EXPIRATION_MS)

  async function uploadFileToShelby(file: File): Promise<string> {
    const addr = String(account!.address)
    if (!isShelbyEnabled()) {
      const result = await mockUpload(file)
      return `${result.uploaderAddress}::${result.blobName}`
    }
    const { payload, data, uniqueName } = await encodeFileAndGetPayload(file, addr, undefined, expirationMs)
    const submitted = await signAndSubmitTransaction({
      data: payload,
      options: {
        maxGasAmount: SHELBY_REGISTER_BLOB_MAX_GAS,
        gasUnitPrice: SHELBY_REGISTER_BLOB_GAS_UNIT_PRICE,
      },
    })
    await aptos.waitForTransaction({ transactionHash: (submitted as any).hash })
    const result = await pushBlobToRpc(uniqueName, data, addr)
    return `${result.uploaderAddress}::${result.blobName}`
  }

  function handleReplacementChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setReplacementFile(file)
  }

  function handleThumbnailChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setThumbnailFile(file)
    setThumbnailPreview(URL.createObjectURL(file))
    setRemoveThumbnail(false)
  }

  async function deleteOldBlob(cid: string | undefined) {
    if (!cid) return
    const parsed = parseCid(cid)
    if (!parsed) return
    const tx = await signAndSubmitTransaction({ data: buildDeleteBlobPayload(parsed.blobName) })
    await aptos.waitForTransaction({ transactionHash: (tx as any).hash })
  }

  async function handleSubmit() {
    if (!account) { toast.error('Wallet not connected'); return }
    if (!title.trim()) { toast.error('Title is required'); return }

    if (accessLevel === ACCESS_LEVELS.PURCHASE && parseFloat(purchasePrice) > 10000) {
      toast.error('Purchase price cannot exceed $10,000'); return
    }

    setLoading(true)
    try {
      let shelbyCid = content.shelby_cid
      let thumbnailCid = removeThumbnail ? '' : content.thumbnail_shelby_cid

      const blobsToDeleteAfterSuccess: string[] = []

      if (replacementFile) {
        toast('Uploading replacement content…', { icon: '◌' })
        const newCid = await uploadFileToShelby(replacementFile)
        if (content.shelby_cid) blobsToDeleteAfterSuccess.push(content.shelby_cid)
        shelbyCid = newCid
      }

      if (thumbnailFile) {
        toast('Uploading new thumbnail…', { icon: '◌' })
        const newThumbCid = await uploadFileToShelby(thumbnailFile)
        if (content.thumbnail_shelby_cid) {
          blobsToDeleteAfterSuccess.push(content.thumbnail_shelby_cid)
        }
        thumbnailCid = newThumbCid
      } else if (removeThumbnail && content.thumbnail_shelby_cid) {
        blobsToDeleteAfterSuccess.push(content.thumbnail_shelby_cid)
      }

      const payload = buildEditContentPayload({
        contentId: content.id,
        title: title.trim(),
        description,
        shelbyCid,
        thumbnailCid,
        accessLevel,
        purchasePriceUsd: accessLevel === ACCESS_LEVELS.PURCHASE ? parseFloat(purchasePrice) || 0 : 0,
      })

      const submitted = await signAndSubmitTransaction({ data: payload })
      await aptos.waitForTransaction({ transactionHash: (submitted as any).hash })

      for (const cid of blobsToDeleteAfterSuccess) {
        try {
          await deleteOldBlob(cid)
        } catch (deleteError) {
          console.warn('Failed to delete old Shelby blob after successful edit:', cid, deleteError)
        }
      }

      toast.success('Content updated')
      onSuccess()
      onClose()
    } catch (e: any) {
      console.error(e)
      toast.error(e?.message || 'Failed to update content')
    } finally {
      setLoading(false)
    }
  }

  const currentThumbUrl = thumbnailPreview || resolveContentUrl(content.thumbnail_shelby_cid)
  const accessGuidance = accessLevel === ACCESS_LEVELS.FREE
    ? 'Use free when this post should pull in reach, sharing, and discovery.'
    : accessLevel === ACCESS_LEVELS.PURCHASE
      ? 'Use one-time paid access for a clear standalone premium post, not for ongoing membership value.'
      : `Use ${ACCESS_LEVEL_LABELS[accessLevel]} when this post should strengthen recurring subscription value.`
  const pricingGuidance = (() => {
    const price = parseFloat(purchasePrice) || 0
    if (accessLevel !== ACCESS_LEVELS.PURCHASE) return ''
    if (price <= 0) return 'Set a real price. Free-looking paid posts create friction with no upside.'
    if (price < 1) return 'Very cheap. Good for low-friction sampling, weak for premium positioning.'
    if (price <= 5) return 'Solid entry price for a first or impulse unlock.'
    return 'Premium-priced. Make sure the title and description justify that price clearly.'
  })()

  return (
    <div className="modal-overlay" onClick={() => !loading && onClose()}>
      <motion.div
        className="modal"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.25 }}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 600, width: '100%' }}
      >
        <div className="modal-header">
          <div>
            <div className="section-eyebrow">Edit</div>
            <h3 style={{ fontWeight: 300 }}>Update content</h3>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => !loading && onClose()}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="label">Replace uploaded file</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <label className="btn btn-sm" style={{ cursor: 'pointer' }}>
                Choose file
                <input type="file" style={{ display: 'none' }} onChange={handleReplacementChange} />
              </label>
              <span style={{ fontSize: 12, color: replacementFile ? 'var(--accent)' : 'var(--text-3)' }}>
                {replacementFile ? replacementFile.name : 'Keep current uploaded content'}
              </span>
            </div>
          </div>

          <div className="form-group">
            <label className="label">Thumbnail</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{
                width: 120,
                height: 80,
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                background: currentThumbUrl && !removeThumbnail
                  ? `url(${currentThumbUrl}) center/cover`
                  : 'var(--bg-3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-3)',
              }}>
                {!currentThumbUrl || removeThumbnail ? 'No thumbnail' : ''}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <label className="btn btn-sm" style={{ cursor: 'pointer' }}>
                  Choose image
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleThumbnailChange} />
                </label>
                {(content.thumbnail_shelby_cid || thumbnailPreview) && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setThumbnailFile(null)
                      setThumbnailPreview('')
                      setRemoveThumbnail(true)
                    }}
                    style={{ color: '#ff8a8a', borderColor: 'rgba(255,138,138,0.25)' }}
                  >
                    Remove thumbnail
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="label">Shelby expiration for new files</label>
            <select
              className="input"
              value={expirationMs}
              onChange={(e) => setExpirationMs(Number(e.target.value))}
              disabled={loading}
              style={{ maxWidth: 220 }}
            >
              {SHELBY_EXPIRATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
              Applies only when replacing the content file or thumbnail. Existing Shelby blobs keep their original expiration.
            </div>
          </div>

          <div className="form-group">
            <label className="label">Title *</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </div>

          <div className="form-group">
            <label className="label">Description</label>
            <textarea className="input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
          </div>

          <div className="form-group">
            <label className="label">Access level</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(ACCESS_LEVEL_LABELS).map(([level, label]) => (
                <button
                  key={level}
                  className={`btn btn-sm ${accessLevel === Number(level) ? 'btn-primary' : ''}`}
                  onClick={() => setAccessLevel(Number(level))}
                >
                  {label}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 10, padding: '10px 12px', border: '1px solid rgba(254,119,201,0.14)', background: 'rgba(254,119,201,0.04)', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55 }}>
              {accessGuidance}
            </div>
          </div>

          {accessLevel === ACCESS_LEVELS.PURCHASE && (
            <div className="form-group">
              <label className="label">Purchase price (USD)</label>
              <input
                className="input"
                type="number"
                min="0"
                max="10000"
                step="0.1"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                style={{ maxWidth: 220 }}
              />
              <div style={{ marginTop: 10, padding: '10px 12px', border: '1px solid var(--border)', background: 'var(--bg-3)', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55 }}>
                {pricingGuidance}
              </div>
            </div>
          )}
          <div style={{ marginTop: 4, padding: '12px 14px', border: '1px solid var(--border)', background: 'var(--bg-3)', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55 }}>
            <div className="section-eyebrow" style={{ marginBottom: 8 }}>Editing advice</div>
            <div>• Tighten the title before raising price. Better positioning beats random price inflation.</div>
            <div>• Free posts drive reach, paid posts drive first conversion, member posts drive recurring value.</div>
            <div>• If this is a premium post, make the description more specific, not more vague.</div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={() => !loading && onClose()} disabled={loading}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || !title.trim()}>
            {loading ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
