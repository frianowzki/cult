import { useState } from 'react'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'

import { buildRegisterCreatorPayload, aptos } from '../lib/aptos'
import {
  mockUpload,
  encodeFileAndGetPayload,
  pushBlobToRpc,
  isShelbyEnabled,
  SHELBY_REGISTER_BLOB_MAX_GAS,
  SHELBY_REGISTER_BLOB_GAS_UNIT_PRICE,
} from '../lib/shelby'
import { useStore } from '../lib/store'
import { DEFAULT_TIER_NAMES } from '../lib/constants'

interface Props {
  onSuccess?: () => void
}

export default function RegisterCreatorModal({ onSuccess }: Props) {
  const { account, signAndSubmitTransaction } = useWallet()
  const { setRegisterModalOpen } = useStore()

  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [handle, setHandle] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [bannerPreview, setBannerPreview] = useState('')
  const [tierCount, setTierCount] = useState(2)
  const [tiers, setTiers] = useState([
    { name: DEFAULT_TIER_NAMES[0], price: '1', description: 'Access to all free content and community' },
    { name: DEFAULT_TIER_NAMES[1], price: '5', description: 'Exclusive posts and member-only content' },
    { name: DEFAULT_TIER_NAMES[2], price: '15', description: 'Direct access and inner circle perks' },
  ])

  function close() {
    if (!loading) setRegisterModalOpen(false)
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  function handleBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBannerFile(file)
    setBannerPreview(URL.createObjectURL(file))
  }

  function updateTier(i: number, field: 'name' | 'price' | 'description', value: string) {
    setTiers((prev) => prev.map((t, ti) => ti === i ? { ...t, [field]: value } : t))
  }

  async function uploadFileToShelby(file: File): Promise<string> {
    const addr = String(account!.address)

    if (!isShelbyEnabled()) {
      const result = await mockUpload(file)
      return `${result.uploaderAddress}::${result.blobName}`
    }

    // Step 1: encode + get on-chain registration payload
    const { payload, data, uniqueName } = await encodeFileAndGetPayload(file, addr)

    // Step 2: register on-chain
    const submitted = await signAndSubmitTransaction({
      data: payload,
      options: {
        maxGasAmount: SHELBY_REGISTER_BLOB_MAX_GAS,
        gasUnitPrice: SHELBY_REGISTER_BLOB_GAS_UNIT_PRICE,
      },
    })
    await aptos.waitForTransaction({ transactionHash: (submitted as any).hash })

    // Step 3: push bytes to Shelby RPC using uniqueName (string), not file object
    const result = await pushBlobToRpc(uniqueName, data, addr)
    return `${result.uploaderAddress}::${result.blobName}`
  }

  async function handleSubmit() {
    if (!handle || !displayName) { toast.error('Handle and display name are required'); return }
    if (!account) { toast.error('Wallet not connected'); return }

    setLoading(true)
    try {
      let avatarCid = ''
      if (avatarFile) {
        avatarCid = await uploadFileToShelby(avatarFile)
      }

      let bannerCid = ''
      if (bannerFile) {
        bannerCid = await uploadFileToShelby(bannerFile)
      }

      const payload = buildRegisterCreatorPayload({
        handle,
        displayName,
        bio,
        avatarCid,
        bannerCid,
        tiers: tiers.slice(0, tierCount).map((t) => ({
          name: t.name,
          priceUsd: parseFloat(t.price) || 0,
          description: t.description,
        })),
      })

      const submitted = await signAndSubmitTransaction({ data: payload })
      await aptos.waitForTransaction({ transactionHash: (submitted as any).hash })
      toast.success('Creator profile registered!')
      setRegisterModalOpen(false)
      onSuccess?.()
    } catch (e: any) {
      console.error('Registration error:', e)
      const msg = String(e?.message || e || '')
      if (msg.includes('cancel') || msg.includes('reject')) {
        toast.error('Transaction cancelled')
      } else if (msg.includes('insufficient') || msg.includes('INSUFFICIENT')) {
        toast.error('Insufficient Shelby USD for payment or APT for gas')
      } else if (msg.includes('already') || msg.includes('ALREADY')) {
        toast.error('Creator profile already exists for this wallet')
      } else if (msg.includes('invalid_type') || msg.includes('Expected string')) {
        toast.error('Shelby upload error — check your API key in .env')
      } else {
        toast.error(msg.slice(0, 140) || 'Transaction failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={close}>
      <motion.div
        className="modal"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.25 }}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 600, width: '100%' }}
      >
        <div className="modal-header">
          <div>
            <div className="section-eyebrow">Setup</div>
            <h3 style={{ fontWeight: 300 }}>
              {step === 1 ? 'Create your profile' : 'Configure your tiers'}
            </h3>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>Step {step}/2</span>
            <button className="btn btn-ghost btn-sm" onClick={close} disabled={loading}>✕</button>
          </div>
        </div>

        <div className="modal-body">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div key="step1" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
                <div className="form-group">
                  <label className="label">Avatar</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{
                      width: 64, height: 64, borderRadius: '50%',
                      background: avatarPreview ? `url(${avatarPreview}) center/cover` : 'var(--bg-3)',
                      border: '1px solid var(--border)', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.5rem', color: 'var(--text-3)',
                    }}>
                      {!avatarPreview && '✦'}
                    </div>
                    <label className="btn btn-sm" style={{ cursor: 'pointer' }}>
                      Choose file
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
                    </label>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Stored on Shelby</span>
                  </div>
                </div>
                <div className="form-group">
                  <label className="label">Banner</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{
                      width: '100%', height: 120, borderRadius: 'var(--radius-md)',
                      background: bannerPreview ? `url(${bannerPreview}) center/cover` : 'var(--bg-3)',
                      border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.2rem', color: 'var(--text-3)', overflow: 'hidden'
                    }}>
                      {!bannerPreview && 'Banner preview'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <label className="btn btn-sm" style={{ cursor: 'pointer' }}>
                        Choose banner
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBannerChange} />
                      </label>
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Wide image stored on Shelby</span>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="label">Handle *</label>
                  <input className="input" placeholder="your_handle" value={handle}
                    onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/\s/g, '_'))} />
                </div>
                <div className="form-group">
                  <label className="label">Display Name *</label>
                  <input className="input" placeholder="Your Creator Name" value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="label">Bio</label>
                  <textarea className="input" placeholder="Tell your audience who you are…"
                    value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
                </div>
              </motion.div>
            ) : (
              <motion.div key="step2" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.2 }}>
                <div className="form-group">
                  <label className="label">Number of tiers</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[1, 2, 3].map((n) => (
                      <button key={n} className={`btn btn-sm ${tierCount === n ? 'btn-primary' : ''}`} onClick={() => setTierCount(n)}>
                        {n} tier{n > 1 ? 's' : ''}
                      </button>
                    ))}
                  </div>
                </div>
                {tiers.slice(0, tierCount).map((tier, i) => (
                  <div key={i} style={{ padding: '16px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginBottom: 12 }}>
                    <div style={{ marginBottom: 12 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', padding: '2px 8px', border: '1px solid var(--accent-dim)', borderRadius: 100 }}>
                        Tier {i + 1}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: 10, marginBottom: 10 }}>
                      <div>
                        <label className="label">Tier name</label>
                        <input className="input" value={tier.name} onChange={(e) => updateTier(i, 'name', e.target.value)} />
                      </div>
                      <div>
                        <label className="label">Price (USD/mo)</label>
                        <input className="input" type="number" min="0" step="0.01" value={tier.price}
                          onChange={(e) => updateTier(i, 'price', e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label className="label">Description</label>
                      <input className="input" placeholder="What do members get?" value={tier.description}
                        onChange={(e) => updateTier(i, 'description', e.target.value)} />
                    </div>
                  </div>
                ))}
                <div style={{ padding: '12px', background: 'var(--accent-glow)', border: '1px solid var(--accent-dim)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text-2)' }}>
                  ✦ Platform fee: 5% · You keep 95% of all revenue
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="modal-footer">
          {step === 2 && <button className="btn" onClick={() => setStep(1)} disabled={loading}>← Back</button>}
          {step === 1 ? (
            <button className="btn btn-primary" onClick={() => setStep(2)} disabled={!handle || !displayName}>Next →</button>
          ) : (
            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Registering…' : 'Register on Aptos'}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}
