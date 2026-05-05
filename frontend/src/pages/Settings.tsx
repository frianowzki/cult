import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

import { aptos, buildDeleteCreatorPayload, buildUpdateTiersPayload, getCreatorProfile, type CreatorProfile, type Tier } from '../lib/aptos'
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
import { useStore } from '../lib/store'

export default function Settings() {
  const navigate = useNavigate()
  const { account, signAndSubmitTransaction } = useWallet()
  const setCurrentCreator = useStore((s) => s.setCurrentCreator)

  const [profile, setProfile] = useState<CreatorProfile | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [loading, setLoading] = useState(false)
  const [deletingCreator, setDeletingCreator] = useState(false)

  // Profile fields
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [bannerPreview, setBannerPreview] = useState('')
  const [removeBanner, setRemoveBanner] = useState(false)

  // Tier fields
  const [tierCount, setTierCount] = useState(1)
  const [tiers, setTiers] = useState([
    { name: 'Fan', price: '1', description: '' },
    { name: 'Member', price: '5', description: '' },
    { name: 'Inner Circle', price: '15', description: '' },
  ])

  const fetchProfile = useCallback(async () => {
    if (!account?.address) return
    setLoadingProfile(true)
    try {
      const p = await getCreatorProfile(String(account.address))
      if (!p) {
        toast.error('Creator profile not found')
        navigate('/')
        return
      }
      setProfile(p)
      setDisplayName(p.display_name)
      setBio(p.bio)
      setTierCount(p.tiers.length || 1)
      setTiers([
        {
          name: p.tiers[0]?.name || 'Fan',
          price: p.tiers[0] ? String(p.tiers[0].price_per_month / 100_000_000) : '1',
          description: p.tiers[0]?.description || '',
        },
        {
          name: p.tiers[1]?.name || 'Member',
          price: p.tiers[1] ? String(p.tiers[1].price_per_month / 100_000_000) : '5',
          description: p.tiers[1]?.description || '',
        },
        {
          name: p.tiers[2]?.name || 'Inner Circle',
          price: p.tiers[2] ? String(p.tiers[2].price_per_month / 100_000_000) : '15',
          description: p.tiers[2]?.description || '',
        },
      ])
    } catch (e: any) {
      toast.error('Failed to load profile')
      console.error(e)
    } finally {
      setLoadingProfile(false)
    }
  }, [account?.address, navigate])

  useEffect(() => {
    void fetchProfile()
  }, [fetchProfile])

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
      setCurrentCreator(null)
      navigate('/')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete creator')
    } finally {
      setDeletingCreator(false)
    }
  }

  async function handleSaveProfile() {
    if (!displayName) { toast.error('Display name is required'); return }
    if (!account || !profile) { toast.error('Wallet not connected'); return }

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
        functionArguments: [displayName, bio, avatarCid, bannerCid],
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

      // Refresh local profile
      const updated = await getCreatorProfile(String(account.address))
      if (updated) {
        setProfile(updated)
        setCurrentCreator(updated)
      }

      // Clear file states
      setAvatarFile(null)
      setAvatarPreview('')
      setBannerFile(null)
      setBannerPreview('')
      setRemoveBanner(false)
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

  if (loadingProfile) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px' }}>
        <div className="skeleton" style={{ height: 32, width: 200, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 200, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    )
  }

  if (!profile) return null

  const avatarUrl = avatarPreview || (profile.avatar_shelby_cid ? resolveContentUrl(profile.avatar_shelby_cid) : '')
  const bannerUrl = bannerPreview || (!removeBanner && profile.banner_shelby_cid ? resolveContentUrl(profile.banner_shelby_cid) : '')

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px 80px' }}
    >
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div className="section-eyebrow">Settings</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 300, fontSize: '1.8rem', color: 'var(--text)', margin: 0 }}>
          Creator settings
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>
          Manage your profile, tiers, and creator account.
        </p>
      </div>

      {/* Profile Section */}
      <section className="card" style={{ padding: 24, marginBottom: 24, background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
        <div className="section-eyebrow" style={{ marginBottom: 16 }}>Profile</div>

        {/* Avatar */}
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="label">Avatar</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: avatarUrl ? `url(${avatarUrl}) center/cover` : 'var(--bg-3)',
              border: '1px solid var(--border)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.5rem', color: 'var(--text-3)',
            }}>
              {!avatarUrl && '✦'}
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

        {/* Banner */}
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="label">Banner</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
              width: '100%', height: 120, borderRadius: 'var(--radius-md)',
              background: bannerUrl ? `url(${bannerUrl}) center/cover` : 'var(--bg-3)',
              border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.2rem', color: 'var(--text-3)', overflow: 'hidden',
            }}>
              {!bannerUrl && !removeBanner && 'Banner preview'}
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
                  style={{ color: 'var(--red, #ff8a8a)', borderColor: 'rgba(255,138,138,0.25)' }}
                >
                  Remove banner
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Display name */}
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="label">Display Name *</label>
          <input
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your Creator Name"
          />
        </div>

        {/* Bio */}
        <div className="form-group" style={{ marginBottom: 20 }}>
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
      </section>

      {/* Tier Management Section */}
      <section className="card" style={{ padding: 24, marginBottom: 24, background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
        <div className="section-eyebrow" style={{ marginBottom: 16 }}>Tiers</div>

        <div className="form-group" style={{ marginBottom: 16 }}>
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
                  border: '1px solid var(--accent, rgba(254,119,201,0.3))',
                  borderRadius: 100,
                }}
              >
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
                <input className="input" type="number" min="0" step="0.1" value={tier.price} onChange={(e) => updateTier(i, 'price', e.target.value)} />
              </div>
            </div>

            <div>
              <label className="label">Description</label>
              <input className="input" value={tier.description} onChange={(e) => updateTier(i, 'description', e.target.value)} />
            </div>
          </div>
        ))}
      </section>

      {/* Save button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 40 }}>
        <button className="btn btn-primary" onClick={handleSaveProfile} disabled={loading || deletingCreator || !displayName}>
          {loading ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      {/* Danger Zone */}
      <section
        className="card"
        style={{
          padding: 24,
          background: 'var(--bg-2)',
          border: '1px solid rgba(255,138,138,0.2)',
        }}
      >
        <div
          className="section-eyebrow"
          style={{ marginBottom: 12, color: 'var(--red, #ff8a8a)' }}
        >
          Danger zone
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.6 }}>
          Deleting your creator profile is permanent. Your on-chain profile, content entries, and tier configuration will be removed from the platform. This action cannot be undone.
        </p>
        <button
          className="btn btn-ghost"
          onClick={handleDeleteCreator}
          disabled={loading || deletingCreator}
          style={{ color: '#ff8a8a', borderColor: 'rgba(255,138,138,0.25)' }}
        >
          {deletingCreator ? 'Deleting…' : 'Delete creator profile'}
        </button>
      </section>
    </motion.div>
  )
}
