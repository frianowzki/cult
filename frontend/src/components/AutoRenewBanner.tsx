import toast from 'react-hot-toast'
import { useState } from 'react'
import { useWallet } from '@aptos-labs/wallet-adapter-react'

import { aptos, buildRenewSubscriptionPayload } from '../lib/aptos'

interface Props {
  creatorAddr: string
  expiresAt: number
  onRenewed?: () => Promise<void> | void
}

const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60

export default function AutoRenewBanner({ creatorAddr, expiresAt, onRenewed }: Props) {
  const { signAndSubmitTransaction } = useWallet()
  const [renewing, setRenewing] = useState(false)

  const now = Math.floor(Date.now() / 1000)
  const secondsLeft = expiresAt - now

  if (expiresAt <= 0 || secondsLeft > SEVEN_DAYS_IN_SECONDS) return null

  const daysLeft = Math.max(0, Math.ceil(secondsLeft / (24 * 60 * 60)))
  const label = secondsLeft <= 0
    ? 'Your subscription has expired.'
    : daysLeft <= 1
      ? 'Your subscription expires within 24 hours.'
      : `Your subscription expires in ${daysLeft} days.`

  async function handleRenew() {
    setRenewing(true)
    try {
      const submitted = await signAndSubmitTransaction({ data: buildRenewSubscriptionPayload(creatorAddr) })
      await aptos.waitForTransaction({ transactionHash: (submitted as any).hash })
      toast.success('Subscription renewed')
      await onRenewed?.()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to renew subscription')
    } finally {
      setRenewing(false)
    }
  }

  return (
    <div
      className="card"
      style={{
        marginBottom: 20,
        padding: '16px 18px',
        borderColor: 'rgba(200,169,110,0.35)',
        background: 'linear-gradient(180deg, color-mix(in srgb, var(--accent) 7%, var(--bg-2)) 0%, var(--bg-2) 100%)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div className="section-eyebrow">Renewal reminder</div>
          <div style={{ fontSize: 14, color: 'var(--text-2)' }}>{label}</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleRenew} disabled={renewing}>
          {renewing ? 'Renewing…' : 'Renew now'}
        </button>
      </div>
    </div>
  )
}
