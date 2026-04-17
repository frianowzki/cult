import { useState } from 'react'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

import {
  aptos,
  buildRegisterUserProfilePayload,
  buildUpdateUserProfilePayload,
  type UserProfile,
} from '../lib/aptos'
import {
  mockUpload,
  encodeFileAndGetPayload,
  pushBlobToRpc,
  isShelbyEnabled,
  SHELBY_REGISTER_BLOB_MAX_GAS,
  SHELBY_REGISTER_BLOB_GAS_UNIT_PRICE,
  resolveContentUrl,
} from '../lib/shelby'

interface Props {
  profile: UserProfile | null
  onSuccess: () => void
  onClose: () => void
}

export default function UserProfileModal({ profile, onSuccess, onClose }: Props) {
  const { account, signAndSubmitTransaction } = useWallet()
  const [loading, setLoading] = useState(false)
  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')

  const isEditing = !!profile

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
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

  async function handleSubmit() {
    if (!displayName.trim()) {
      toast.error('Display name is required')
      return
    }
    if (!account) {
      toast.error('Wallet not connected')
      return
    }

    setLoading(true)
    try {
      let avatarCid = profile?.avatar_shelby_cid || ''
      if (avatarFile) {
        avatarCid = await uploadFileToShelby(avatarFile)
      }

      const payload = isEditing
        ? buildUpdateUserProfilePayload({ displayName: displayName.trim(), bio: bio.trim(), avatarCid })
        : buildRegisterUserProfilePayload({ displayName: displayName.trim(), bio: bio.trim(), avatarCid })

      const submitted = await signAndSubmitTransaction({ data: payload })
      await aptos.waitForTransaction({ transactionHash: (submitted as any).hash })

      toast.success(isEditing ? 'Profile updated' : 'Profile created')
      onSuccess()
      onClose()
    } catch (e: any) {
      const msg = String(e?.message || e || '')
      if (msg.includes('cancel') || msg.includes('reject')) {
        toast.error('Transaction cancelled')
      } else {
        toast.error(msg.slice(0, 140) || 'Failed to save profile')
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
        style={{ maxWidth: 480, width: '100%' }}
      >
        <div className="modal-header">
          <div>
            <div className="section-eyebrow">Fan Profile</div>
            <h3 style={{ fontWeight: 300 }}>{isEditing ? 'Edit your profile' : 'Create your profile'}</h3>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => !loading && onClose()} disabled={loading}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="label">Avatar</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: avatarPreview
                  ? `url(${avatarPreview}) center/cover`
                  : profile?.avatar_shelby_cid
                  ? `url(${resolveContentUrl(profile.avatar_shelby_cid)}) center/cover`
                  : 'var(--bg-3)',
                border: '1px solid var(--border)',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                color: 'var(--text-3)',
              }}>
                {!avatarPreview && !profile?.avatar_shelby_cid && '◌'}
              </div>
              <label className="btn btn-sm" style={{ cursor: 'pointer' }}>
                {profile?.avatar_shelby_cid ? 'Change avatar' : 'Choose avatar'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
              </label>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Stored on Shelby</span>
            </div>
          </div>

          <div className="form-group">
            <label className="label">Display Name *</label>
            <input
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="form-group">
            <label className="label">Bio</label>
            <textarea
              className="input"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Say something about yourself…"
              rows={4}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || !displayName.trim()}>
            {loading ? 'Saving…' : isEditing ? 'Save Profile' : 'Create Profile'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
