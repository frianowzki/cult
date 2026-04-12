import { useState } from 'react'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { buildTipPayload } from '../lib/aptos'
import { useStore } from '../lib/store'

const QUICK_AMOUNTS = [0.5, 1, 2, 5, 10]

interface Props {
  creatorAddr: string
  creatorName: string
  onClose: () => void
}

export default function TipModal({ creatorAddr, creatorName }: Props) {
  const { signAndSubmitTransaction, connected } = useWallet()
  const { closeTipModal } = useStore()
  const [amount, setAmount] = useState('1')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleTip() {
    if (!connected) { toast.error('Connect wallet first'); return }
    const usd = parseFloat(amount)
    if (!usd || usd <= 0) { toast.error('Enter a valid amount'); return }

    setLoading(true)
    try {
      const payload = buildTipPayload(creatorAddr, usd, message)
      await signAndSubmitTransaction({ data: payload })
      toast.success(`Tipped $${usd} to ${creatorName}!`)
      closeTipModal()
    } catch (e: any) {
      toast.error(e?.message || 'Transaction failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={closeTipModal}>
      <motion.div
        className="modal"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.25 }}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 440 }}
      >
        <div className="modal-header">
          <div>
            <div className="section-eyebrow">Support</div>
            <h3 style={{ fontWeight: 300 }}>Tip {creatorName}</h3>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={closeTipModal}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="label">Amount (USD)</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              {QUICK_AMOUNTS.map((a) => (
                <button
                  key={a}
                  className={`btn btn-sm ${parseFloat(amount) === a ? 'btn-primary' : ''}`}
                  onClick={() => setAmount(String(a))}
                >
                  ${a}
                </button>
              ))}
            </div>
            <input
              className="input"
              type="number"
              min="0.01"
              step="0.1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Custom amount"
            />
          </div>

          <div className="form-group">
            <label className="label">Message (optional)</label>
            <textarea
              className="input"
              placeholder="Leave a note for the creator…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>

          <div
            style={{
              padding: '10px 14px',
              background: 'var(--accent-glow)',
              border: '1px solid var(--accent-dim)',
              borderRadius: 'var(--radius)',
              fontSize: 12,
              color: 'var(--text-2)',
            }}
          >
            95% goes directly to the creator · 5% platform fee
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={closeTipModal}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleTip}
            disabled={loading || !amount}
          >
            {loading ? 'Sending…' : `Send $${amount || '0'}`}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
