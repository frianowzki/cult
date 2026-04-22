import { useState } from 'react'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

import { aptos, buildDeleteCreatorPayload, buildUpdateTiersPayload, type CreatorProfile } from '../lib/aptos'
import {
  encodeFileAndGetPayload,
  pushBlobToRpc,
  mockUpload,
  isShelbyEnabled,
  SHELBY_REGISTER_BLOB_MAX_GAS,
  SHELBY_REGISTER_BLOB_GAS_UNIT_PRICE,
  buildDeleteBlobPayload,
  parseCid,
  resolveContentUrl,
} from '../lib/shelby'
import { CONTRACT_ADDRESS, MODULE_NAME } from '../lib/constants'

interface Props {
  profile: CreatorProfile
  onSuccess: () => void
  onClose: () => void
}

export default function EditProfileModal({ profile, onSuccess, onClose }: Props) {
  const { account, signAndSubmitTransaction } = useWallet()

  const [loading, setLoading] = useState(false)
  const [deletingCreator, setDeletingCreator] = useState(false)
  const [displayName, setDisplayName] = useState(profile.display_name)
  const [bio, setBio] = useState(profile.bio)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [bannerPreview, setBannerPreview] = useState('')
  const [removeBanner, setRemoveBanner] = useState(false)
  const [tierCount, setTierCount] = useState(profile.tiers.length || 1)
  const [tiers, setTiers] = useState([
    {
      name: profile.tiers[0]?.name || 'Fan',
      price: profile.tiers[0] ? String(profile.tiers[0].price_per_month / 100_000_000) : '1',
      description: profile.tiers[0]?.description || '',
    },
    {
      name: profile.tiers[1]?.name || 'Member',
      price: profile.tiers[1] ? String(profile.tiers[1].price_per_month / 100_000_000) : '5',
      description: profile.tiers[1]?.description || '',
    },
    {
      name: profile.tiers[2]?.name || 'Inner Circle',
      price: profile.tiers[2] ? String(profile.tiers[2].price_per_month / 100_000_000) : '15',
      description: profile.tiers[2]?.description || '',
    },
  ])

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
    setRemoveBanner(false)
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
    const { payload, data, uniqueName } = await encodeFileAndGetPayload(file, addr)
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

  async function handleDeleteCreator() {
    if (!account) { toast.error('Wallet not connected'); return }

    const ok = window.confirm('Delete your creator profile from CULT? This will remove your profile and content entries from the platform.')
    if (!ok) return

    setDeletingCreator(true)
    try {
      const submitted = await signAndSubmitTransaction({ data: buildDeleteCreatorPayload() })
      await aptos.waitForTransaction({ transactionHash: (submitted as any).hash })
      toast.success('Creator profile deleted')
      onSuccess()
      onClose()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete creator')
    } finally {
      setDeletingCreator(false)
    }
  }

  async function handleSubmit() {
    if (!displayName) { toast.error('Display name is required'); return }
    if (!account) { toast.error('Wallet not connected'); return }

    setLoading(true)
    try {
      let avatarCid = profile.avatar_shelby_cid
      if (avatarFile) {
        toast('Uploading avatar to Shelby…', { icon: '◌' })
        avatarCid = await uploadFileToShelby(avatarFile)
      }

      let bannerCid = removeBanner ? '' : profile.banner_shelby_cid
      if (bannerFile) {
        toast('Uploading banner to Shelby…', { icon: '◌' })
        bannerCid = await uploadFileToShelby(bannerFile)
      }

      if (removeBanner && profile.banner_shelby_cid) {
        const parsed = parseCid(profile.banner_shelby_cid)
        if (parsed) {
          const deleteTx = await signAndSubmitTransaction({ data: buildDeleteBlobPayload(parsed.blobName) })
          await aptos.waitForTransaction({ transactionHash: (deleteTx as any).hash })
        }
      }

      const payload = {
        function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::update_profile` as `${string}::${string}::${string}`,
        typeArguments: [] as [],
        functionArguments: [
          displayName,
          bio,
          avatarCid,
          bannerCid,
        ],
      }

      await signAndSubmitTransaction({ data: payload })

      const tierPayload = buildUpdateTiersPayload({
        tiers: tiers.slice(0, tierCount).map((t) => ({
          name: t.name,
          priceUsd: parseFloat(t.price) || 0,
          description: t.description,
        })),
      })

      await signAndSubmitTransaction({ data: tierPayload })
      toast.success('Profile and tiers updated!')
      onSuccess()
      onClose()
    } catch (e: any) {
      console.error(e)
      const msg = String(e?.message || e || '')
      if (msg.includes('cancel') || msg.includes('reject')) {
        toast.error('Transaction cancelled')
      } else {
        toast.error(msg.slice(0, 140) || 'Update failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={() => !loading && onClose()}>
      <motion.div
        className="modal"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.25 }}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 520, width: '100%' }}
      >
        <div className="modal-header">
          <div>
            <div className="section-eyebrow">Edit</div>
            <h3 style={{ fontWeight: 300 }}>Update profile</h3>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => !loading && onClose()} disabled={loading}>✕</button>
        </div>

        <div className="modal-body">
          {/* Avatar */}
          <div className="form-group">
            <label className="label">Avatar</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: avatarPreview
                  ? `url(${avatarPreview}) center/cover`
                  : profile.avatar_shelby_cid
                  ? `url(https://api.testnet.shelby.xyz/shelby/v1/blobs/${profile.avatar_shelby_cid.split('::')[0]}/${profile.avatar_shelby_cid.split('::')[1]}) center/cover`
                  : 'var(--bg-3)',
                border: '1px solid var(--border)', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.5rem', color: 'var(--text-3)',
              }}>
                {!avatarPreview && !profile.avatar_shelby_cid && '✦'}
              </div>
              <label className="btn btn-sm" style={{ cursor: 'pointer' }}>
                Change avatar
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
              </label>
              {avatarFile && (
                <span style={{ fontSize: 12, color: 'var(--accent)' }}>New avatar selected</span>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="label">Banner</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{
                width: '100%', height: 120, borderRadius: 'var(--radius-md)',
                background: bannerPreview
                  ? `url(${bannerPreview}) center/cover`
                  : (!removeBanner && profile.banner_shelby_cid)
                  ? `url(${resolveContentUrl(profile.banner_shelby_cid)}) center/cover`
                  : 'var(--bg-3)',
                border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.2rem', color: 'var(--text-3)', overflow: 'hidden'
              }}>
                {!bannerPreview && !profile.banner_shelby_cid && !removeBanner && 'Banner preview'}
                {removeBanner && 'Banner will be removed'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <label className="btn btn-sm" style={{ cursor: 'pointer' }}>
                  Change banner
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBannerChange} />
                </label>
                {(profile.banner_shelby_cid || bannerPreview) && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setBannerFile(null)
                      setBannerPreview('')
                      setRemoveBanner(true)
                    }}
                    style={{ color: 'var(--red)', borderColor: 'color-mix(in srgb, var(--red) 25%, var(--border))' }}
                  >
                    Remove banner
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Display name */}
          <div className="form-group">
            <label className="label">Display Name *</label>
            <input
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your Creator Name"
            />
          </div>

          {/* Bio */}
          <div className="form-group">
            <label className="label">Bio</label>
            <textarea
              className="input"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell your audience who you are…"
              rows={4}
            />
          </div>

          {/* Handle (read-only) */}
          <div className="form-group">
            <label className="label">Handle (cannot be changed)</label>
            <input
              className="input"
              value={`@${profile.handle}`}
              disabled
              style={{ opacity: 0.5, cursor: 'not-allowed' }}
            />
          </div>

          <div className="divider" style={{ margin: '24px 0' }} />

          <div className="form-group">
            <label className="label">Number of tiers</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`btn btn-sm ${tierCount === n ? 'btn-primary' : ''}`}
                  onClick={() => setTierCount(n)}
                >
                  {n} tier{n > 1 ? 's' : ''}
                </button>
              ))}
            </div>
          </div>

          {tiers.slice(0, tierCount).map((tier, i) => (
            <div
              key={i}
              style={{
                padding: '16px',
                background: 'var(--bg-3)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 12,
              }}
            >
              <div style={{ marginBottom: 12 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--accent)',
                    padding: '2px 8px',
                    border: '1px solid var(--accent-dim)',
                    borderRadius: 100,
                  }}
                >
                  Tier {i + 1}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: 10, marginBottom: 10 }}>
                <div>
                  <label className="label">Tier name</label>
                  <input
                    className="input"
                    value={tier.name}
                    onChange={(e) => updateTier(i, 'name', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Price (USD/mo)</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.1"
                    value={tier.price}
                    onChange={(e) => updateTier(i, 'price', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="label">Description</label>
                <input
                  className="input"
                  value={tier.description}
                  onChange={(e) => updateTier(i, 'description', e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
          <button
            className="btn btn-ghost"
            onClick={handleDeleteCreator}
            disabled={loading || deletingCreator}
            style={{ color: '#ff8a8a', borderColor: 'rgba(255,138,138,0.25)' }}
          >
            {deletingCreator ? 'Deleting Creator…' : 'Delete Creator'}
          </button>
          <button className="btn" onClick={() => !loading && !deletingCreator && onClose()} disabled={loading || deletingCreator}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || deletingCreator || !displayName}>
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
