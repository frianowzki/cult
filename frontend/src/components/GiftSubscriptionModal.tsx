import { useMemo, useState } from 'react'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

import {
  aptos,
  buildGiftSubscriptionPayload,
  // NOTE: getCreatorAddressByHandle only resolves creators (not regular users).
  // Gifts to non-creator usernames will fail with "Username not found".
  getCreatorAddressByHandle,
  type Tier,
} from '../lib/aptos'

interface Props {
  creatorAddr: string
  creatorName: string
  tiers: Tier[]
  onClose: () => void
  onSuccess?: () => void
}

export default function GiftSubscriptionModal({ creatorAddr, creatorName, tiers, onClose, onSuccess }: Props) {
  const { connected, signAndSubmitTransaction } = useWallet()
  const [recipientHandle, setRecipientHandle] = useState('')
  const [tierIndex, setTierIndex] = useState(0)
  const [loading, setLoading] = useState(false)

  const selectedTier = useMemo(() => tiers[tierIndex] || tiers[0], [tiers, tierIndex])

  async function handleGift() {
    if (!connected) {
      toast.error('Connect wallet first')
      return
    }

    const normalizedHandle = recipientHandle.trim().toLowerCase().replace(/^@/, '')
    if (!normalizedHandle) {
      toast.error('Recipient username is required')
      return
    }

    setLoading(true)
    try {
      const recipientAddr = await getCreatorAddressByHandle(normalizedHandle)
      if (!recipientAddr) {
        toast.error('Username not found')
        return
      }

      const submitted = await signAndSubmitTransaction({
        data: buildGiftSubscriptionPayload(creatorAddr, recipientAddr, tierIndex),
      })
      await aptos.waitForTransaction({ transactionHash: (submitted as any).hash })

      toast.success(`Gifted ${selectedTier?.name || `Tier ${tierIndex + 1}`} to @${normalizedHandle}`)
      onSuccess?.()
      onClose()
    } catch (error: any) {
      const message = String(error?.message || error || '')
      if (message.includes('ALREADY_SUBSCRIBED') || message.includes('6')) {
        toast.error('Recipient already has an active subscription')
      } else if (message.includes('HANDLE_NOT_FOUND') || message.includes('27')) {
        toast.error('Username not found')
      } else if (!(message.includes('cancel') || message.includes('reject'))) {
        toast.error(message.slice(0, 140) || 'Gift transaction failed')
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
        style={{ maxWidth: 460, width: '100%' }}
      >
        <div className="modal-header">
          <div>
            <div className="section-eyebrow">Gift membership</div>
            <h3 style={{ fontWeight: 300 }}>Gift {creatorName} Membership</h3>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={loading}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="label">Recipient username</label>
            <input
              className="input"
              value={recipientHandle}
              onChange={(e) => setRecipientHandle(e.target.value.replace(/[^a-zA-Z0-9_@]/g, ''))}
              placeholder="@username"
            />
          </div>

          <div className="form-group">
            <label className="label">Tier</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tiers.map((tier, index) => (
                <button
                  key={`${tier.name}-${index}`}
                  className={`btn btn-sm ${tierIndex === index ? 'btn-primary' : ''}`}
                  onClick={() => setTierIndex(index)}
                  style={{ justifyContent: 'space-between' }}
                >
                  <span>{tier.name}</span>
                  <span>${(tier.price_per_month / 100_000_000).toFixed(2)}/mo</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding: '12px', background: 'var(--accent-glow)', border: '1px solid var(--accent-dim)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text-2)' }}>
            95% goes directly to the creator, 5% platform fee. Recipient must already have a CULT fan profile username.
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-primary" onClick={handleGift} disabled={loading || !recipientHandle.trim() || !selectedTier}>
            {loading ? 'Gifting…' : `Gift ${selectedTier ? `$${(selectedTier.price_per_month / 100_000_000).toFixed(2)}` : ''}`}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
