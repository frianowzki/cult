import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

import { buildPublishContentPayload, aptos } from '../lib/aptos'
import {
  encodeFileAndGetPayload,
  pushBlobToRpc,
  mockUpload,
  isShelbyEnabled,
  SHELBY_REGISTER_BLOB_MAX_GAS,
  SHELBY_REGISTER_BLOB_GAS_UNIT_PRICE,
  type ProgressCallback,
  type ShelbyUploadResult,
} from '../lib/shelby'
import { useStore } from '../lib/store'
import { CONTENT_TYPES, CONTENT_TYPE_ICONS, ACCESS_LEVELS, ACCESS_LEVEL_LABELS } from '../lib/constants'

interface Props {
  onSuccess?: () => void
}

const ACCEPTED_TYPES: Record<string, string[]> = {
  'video/*': ['.mp4', '.mov', '.webm'],
  'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  'audio/*': ['.mp3', '.wav', '.flac', '.ogg'],
  'text/*': ['.txt', '.md'],
}

function detectContentType(file: File): number {
  if (file.type.startsWith('video')) return CONTENT_TYPES.VIDEO
  if (file.type.startsWith('image')) return CONTENT_TYPES.IMAGE
  if (file.type.startsWith('audio')) return CONTENT_TYPES.AUDIO
  return CONTENT_TYPES.ARTICLE
}

const STEP_LABELS: Record<string, string> = {
  encoding: 'Encoding file…',
  registering: 'Registering on Aptos…',
  uploading: 'Uploading to Shelby…',
  done: 'Upload complete!',
}

export default function UploadContentModal({ onSuccess }: Props) {
  const { signAndSubmitTransaction, account } = useWallet()
  const { setUploadModalOpen } = useStore()

  const [file, setFile] = useState<File | null>(null)
  const [thumbnail, setThumbnail] = useState<File | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [accessLevel, setAccessLevel] = useState<number>(ACCESS_LEVELS.FREE)
  const [purchasePrice, setPurchasePrice] = useState('1')
  const [uploadStep, setUploadStep] = useState<string>('')
  const [uploadPercent, setUploadPercent] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) setFile(accepted[0])
  }, [])

  const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE,
  })

  function handleThumbnailChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setThumbnail(f)
    setThumbnailPreview(URL.createObjectURL(f))
  }

  function handleRemoveThumbnail() {
    setThumbnail(null)
    setThumbnailPreview('')
  }

  const onProgress: ProgressCallback = (step, percent) => {
    setUploadStep(step)
    setUploadPercent(percent)
  }

  async function uploadSingleFile(f: File): Promise<ShelbyUploadResult> {
    const addr = String(account!.address)

    if (!isShelbyEnabled()) {
      return mockUpload(f, onProgress)
    }

    // Step 1: encode + build on-chain registration payload
    const { payload, data, uniqueName } = await encodeFileAndGetPayload(f, addr, onProgress)

    // Step 2: register blob on-chain via Petra
    setUploadStep('registering')
    setUploadPercent(50)
    const submitted = await signAndSubmitTransaction({
      data: payload,
      options: {
        maxGasAmount: SHELBY_REGISTER_BLOB_MAX_GAS,
        gasUnitPrice: SHELBY_REGISTER_BLOB_GAS_UNIT_PRICE,
      },
    })
    await aptos.waitForTransaction({ transactionHash: (submitted as any).hash })
    setUploadPercent(65)

    // Step 3: push actual file bytes to Shelby RPC
    return pushBlobToRpc(uniqueName, data, addr, onProgress)
  }

  async function handleSubmit() {
    if (!file || !title) { toast.error('File and title are required'); return }
    if (!account?.address) { toast.error('Wallet not connected'); return }

    setUploading(true)
    setUploadStep('encoding')
    setUploadPercent(0)

    let shelbyCid = ''
    let thumbnailCid = ''

    try {
      const result = await uploadSingleFile(file)
      // Store as "address::blobName" — used to reconstruct the URL on the frontend
      shelbyCid = `${result.uploaderAddress}::${result.blobName}`

      if (thumbnail) {
        const thumbResult = await uploadSingleFile(thumbnail)
        thumbnailCid = `${thumbResult.uploaderAddress}::${thumbResult.blobName}`
      }
    } catch (e: any) {
      console.error('Upload error:', e)
      const message = e?.message || String(e)
      if (message.includes('multipart upload') || message.includes('status: 500') || message.includes('Internal Server Error')) {
        toast.error('Shelby upload failed on the server side. Please retry in a moment or try a smaller file.')
      } else {
        toast.error('Upload failed: ' + message)
      }
      setUploading(false)
      return
    }

    setUploading(false)
    setSubmitting(true)

    try {
      const payload = buildPublishContentPayload({
        contentType: detectContentType(file),
        title,
        description,
        shelbyCid,
        thumbnailCid,
        accessLevel,
        purchasePriceUsd: accessLevel === ACCESS_LEVELS.PURCHASE ? parseFloat(purchasePrice) || 0 : 0,
      })

      await signAndSubmitTransaction({ data: payload })
      toast.success('Content published on-chain!')
      setUploadModalOpen(false)
      onSuccess?.()
    } catch (e: any) {
      toast.error(e?.message || 'Transaction failed')
    } finally {
      setSubmitting(false)
    }
  }

  const isLoading = uploading || submitting
  const accessGuidance = accessLevel === ACCESS_LEVELS.FREE
    ? 'Use free posts for reach. Best for discovery, samples, and warming up new fans.'
    : accessLevel === ACCESS_LEVELS.PURCHASE
      ? 'Use one-time paid posts for clear standalone value, like a flagship drop or premium file.'
      : `Use ${ACCESS_LEVEL_LABELS[accessLevel]} when this should pull fans toward ongoing membership, not just a one-off buy.`
  const pricingGuidance = (() => {
    const price = parseFloat(purchasePrice) || 0
    if (accessLevel !== ACCESS_LEVELS.PURCHASE) return ''
    if (price <= 0) return 'Set a real price. Zero-value paid posts kill trust.'
    if (price < 1) return 'Very cheap. Good for low-friction sampling, weak for premium positioning.'
    if (price <= 5) return 'Solid entry price for a first paid unlock.'
    return 'Premium-priced. Make sure the title and description justify it clearly.'
  })()

  return (
    <div className="modal-overlay" onClick={() => !isLoading && setUploadModalOpen(false)}>
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
            <div className="section-eyebrow">Publish</div>
            <h3 style={{ fontWeight: 300 }}>Upload content</h3>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => !isLoading && setUploadModalOpen(false)}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="label">Content file *</label>
            <div
              {...getRootProps()}
              style={{
                border: `2px dashed ${isDragActive ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)',
                padding: '32px',
                textAlign: 'center',
                cursor: 'pointer',
                background: isDragActive ? 'var(--accent-glow)' : 'var(--bg-3)',
                transition: 'var(--transition)',
              }}
            >
              <input {...getInputProps()} />
              {file ? (
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', color: 'var(--accent)', marginBottom: 8 }}>
                    {CONTENT_TYPE_ICONS[detectContentType(file)]}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{file.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB · Click to change
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '2rem', marginBottom: 8, color: 'var(--text-3)' }}>◌</div>
                  <div style={{ fontSize: 14, marginBottom: 4 }}>
                    {isDragActive ? 'Drop it here' : 'Drag & drop or click to upload'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    Video, image, audio, or text · Stored on Shelby
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="label">Thumbnail (optional)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {thumbnailPreview && (
                <img src={thumbnailPreview} alt="thumbnail"
                  style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }} />
              )}
              <label className="btn btn-sm" style={{ cursor: 'pointer' }}>
                {thumbnailPreview ? 'Change image' : 'Choose image'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleThumbnailChange} />
              </label>
              {thumbnailPreview && (
                <button type="button" className="btn btn-sm" onClick={handleRemoveThumbnail}>
                  Remove thumbnail
                </button>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="label">Title *</label>
            <input className="input" placeholder="Content title…" value={title}
              onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="label">Description</label>
            <textarea className="input" placeholder="Describe your content…"
              value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>

          <div className="form-group">
            <label className="label">Access level</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(ACCESS_LEVEL_LABELS).map(([level, label]) => (
                <button key={level}
                  className={`btn btn-sm ${accessLevel === Number(level) ? 'btn-primary' : ''}`}
                  onClick={() => setAccessLevel(Number(level))}>
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
              <input className="input" type="number" min="0" step="0.1"
                value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)}
                style={{ maxWidth: 200 }} />
              <div style={{ marginTop: 10, padding: '10px 12px', border: '1px solid var(--border)', background: 'var(--bg-3)', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55 }}>
                {pricingGuidance}
              </div>
            </div>
          )}

          {!uploading && !submitting && (
            <div style={{ marginTop: 4, padding: '12px 14px', border: '1px solid var(--border)', background: 'var(--bg-3)', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55 }}>
              <div className="section-eyebrow" style={{ marginBottom: 8 }}>Publishing advice</div>
              <div>• Free post for discovery, paid post for a clean first conversion, member post for recurring value.</div>
              <div>• Strong title first. If the title is weak, pricing confidence usually collapses.</div>
              <div>• If you charge more, make the description specific about what fans get.</div>
            </div>
          )}

          {uploading && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>
                <span>{STEP_LABELS[uploadStep] || 'Processing…'}</span>
                <span className="mono">{uploadPercent}%</span>
              </div>
              <div style={{ height: 3, background: 'var(--bg-4)', borderRadius: 2, overflow: 'hidden' }}>
                <motion.div
                  style={{ height: '100%', background: 'var(--accent)' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadPercent}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                {(['encoding', 'registering', 'uploading', 'done'] as const).map((step) => {
                  const steps = ['encoding', 'registering', 'uploading', 'done']
                  const currentIdx = steps.indexOf(uploadStep)
                  const stepIdx = steps.indexOf(step)
                  const isDone = currentIdx > stepIdx
                  const isActive = uploadStep === step
                  return (
                    <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: isDone ? 'var(--green)' : isActive ? 'var(--accent)' : 'var(--border-light)',
                        transition: 'background 0.3s',
                      }} />
                      <span style={{ fontSize: 10, color: isActive ? 'var(--text)' : 'var(--text-3)', textTransform: 'capitalize' }}>
                        {step}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {submitting && (
            <p style={{ fontSize: 12, color: 'var(--text-2)', textAlign: 'center', marginTop: 8 }}>
              Publishing on Aptos…
            </p>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={() => !isLoading && setUploadModalOpen(false)} disabled={isLoading}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={isLoading || !file || !title}>
            {uploading ? (STEP_LABELS[uploadStep] || '…') : submitting ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
