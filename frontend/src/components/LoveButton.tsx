import { useEffect, useState } from 'react'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import toast from 'react-hot-toast'
import { buildLoveContentPayload, hasLovedContent } from '../lib/aptos'
import { ACCESS_LEVELS } from '../lib/constants'

interface Props {
  creatorAddr: string
  contentId: number
  accessLevel: number   // 0=free, 1/2/3=tier, 4=purchase
  hasAccess: boolean    // already computed by parent (canAccessContent)
}

export default function LoveButton({ creatorAddr, contentId, accessLevel, hasAccess }: Props) {
  const { connected, account, signAndSubmitTransaction } = useWallet()
  const [loved, setLoved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checked, setChecked] = useState(false)

  // check on-chain whether this user already loved it
  useEffect(() => {
    if (!connected || !account?.address) {
      setLoved(false)
      setChecked(true)
      return
    }
    hasLovedContent(String(account.address), contentId)
      .then((v) => { setLoved(v); setChecked(true) })
  }, [account?.address, connected, contentId])

  async function handleLove() {
    if (!connected || !account?.address) {
      toast.error('Connect your wallet first')
      return
    }

    // gate check — free content anyone can love
    if (accessLevel !== ACCESS_LEVELS.FREE && !hasAccess) {
      toast.error('Subscribe or purchase this content to react')
      return
    }

    if (loved) return  // already loved, no toggle (contract doesn't support unlove)

    setLoading(true)
    // optimistic
    setLoved(true)

    try {
      const payload = buildLoveContentPayload(creatorAddr, contentId)
      await signAndSubmitTransaction({ data: payload })
      toast.success('Loved ♥')
    } catch (e: unknown) {
      // revert optimistic update
      setLoved(false)
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('ALREADY_LOVED') || msg.includes('19')) {
        // already loved on-chain, keep loved=true
        setLoved(true)
        toast('Already loved', { icon: '♥' })
      } else if (msg.includes('NO_ACCESS') || msg.includes('21')) {
        toast.error('You need access to react to this content')
      } else if (msg.includes('rejected') || msg.includes('cancel')) {
        // user cancelled — silent
      } else {
        toast.error('Failed to love content')
        console.error(e)
      }
    } finally {
      setLoading(false)
    }
  }

  if (!checked) return null  // avoid flicker while checking on-chain state

  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={handleLove}
      disabled={loading}
      title={
        !connected
          ? 'Connect wallet to react'
          : accessLevel !== ACCESS_LEVELS.FREE && !hasAccess
          ? 'Subscribe or purchase to react'
          : loved
          ? 'You loved this'
          : 'Love this content'
      }
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        fontSize: 12,
        minHeight: 30,
        padding: '6px 12px',
        color: loved ? 'var(--accent)' : 'var(--text-2)',
        borderColor: loved ? 'var(--accent-dim)' : 'transparent',
        background: loved ? 'var(--accent-glow)' : 'transparent',
        cursor: loved || loading ? 'default' : 'pointer',
        opacity: loading ? 0.6 : 1,
      }}
    >
      <span style={{ fontSize: 12, lineHeight: 1 }}>{loved ? '♥' : '♡'}</span>
      <span>{loved ? 'Loved' : 'Love'}</span>
    </button>
  )
}
