import { useState, useEffect } from 'react'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import toast from 'react-hot-toast'
import { isFollowing, buildFollowPayload, buildUnfollowPayload } from '../lib/aptos'

interface Props {
  creatorAddr: string
  size?: 'sm' | 'default'
}

export default function FollowButton({ creatorAddr, size = 'default' }: Props) {
  const { account, connected, signAndSubmitTransaction } = useWallet()
  const [following, setFollowing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (account?.address) {
      checkFollowStatus()
    } else {
      setChecking(false)
    }
  }, [account?.address, creatorAddr])

  async function checkFollowStatus() {
    setChecking(true)
    try {
      const result = await isFollowing(String(account!.address), creatorAddr)
      setFollowing(result)
    } finally {
      setChecking(false)
    }
  }

  async function handleToggle() {
    if (!connected || !account) {
      toast.error('Connect wallet first')
      return
    }

    // Prevent following self
    if (String(account.address) === creatorAddr) {
      toast.error("You can't follow yourself")
      return
    }

    setLoading(true)
    try {
      const payload = following
        ? buildUnfollowPayload(creatorAddr)
        : buildFollowPayload(creatorAddr)

      await signAndSubmitTransaction({ data: payload })
      setFollowing(!following)
      toast.success(following ? 'Unfollowed' : 'Following!')
    } catch (e: any) {
      const msg = String(e?.message || e || '')
      if (msg.includes('cancel') || msg.includes('reject')) {
        toast.error('Transaction cancelled')
      } else {
        toast.error(msg.slice(0, 100) || 'Transaction failed')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!connected) return null
  if (checking) return (
    <button className={`btn ${size === 'sm' ? 'btn-sm' : ''}`} disabled style={{ opacity: 0.5 }}>
      …
    </button>
  )

  return (
    <button
      className={`btn ${size === 'sm' ? 'btn-sm' : ''} ${following ? '' : 'btn-primary'}`}
      onClick={handleToggle}
      disabled={loading}
      style={following ? { borderColor: 'var(--accent-dim)', color: 'var(--accent)' } : {}}
    >
      {loading ? '…' : following ? '✓ Following' : '+ Follow'}
    </button>
  )
}
