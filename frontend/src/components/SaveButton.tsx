import { useEffect, useState } from 'react'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import toast from 'react-hot-toast'
import { buildSaveContentPayload, buildUnsaveContentPayload, hasSavedContent } from '../lib/aptos'

interface Props {
  creatorAddr: string
  contentId: number
}

export default function SaveButton({ creatorAddr, contentId }: Props) {
  const { connected, account, signAndSubmitTransaction } = useWallet()
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!connected || !account?.address) {
      setSaved(false)
      setChecked(true)
      return
    }

    hasSavedContent(String(account.address), creatorAddr, contentId)
      .then((value) => {
        setSaved(value)
        setChecked(true)
      })
      .catch(() => setChecked(true))
  }, [account?.address, connected, creatorAddr, contentId])

  async function handleSave() {
    if (!connected || !account?.address) {
      toast.error('Connect wallet first')
      return
    }

    setLoading(true)
    const nextSaved = !saved
    setSaved(nextSaved)

    try {
      const payload = saved
        ? buildUnsaveContentPayload(creatorAddr, contentId)
        : buildSaveContentPayload(creatorAddr, contentId)
      await signAndSubmitTransaction({ data: payload })
      toast.success(saved ? 'Removed from saved' : 'Saved for later')
    } catch (error) {
      setSaved(saved)
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('ALREADY_SAVED') || message.includes('24')) {
        setSaved(true)
        toast('Already saved', { icon: '🔖' })
      } else if (message.includes('NOT_SAVED') || message.includes('25')) {
        setSaved(false)
      } else if (!(message.includes('rejected') || message.includes('cancel'))) {
        toast.error('Failed to update saved content')
        console.error(error)
      }
    } finally {
      setLoading(false)
    }
  }

  if (!checked) return null

  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={handleSave}
      disabled={loading}
      title={!connected ? 'Connect wallet to save' : saved ? 'Remove from saved' : 'Save for later'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        fontSize: 12,
        minHeight: 30,
        padding: '6px 12px',
        color: saved ? 'var(--accent)' : 'var(--text-2)',
        borderColor: saved ? 'var(--accent-dim)' : 'transparent',
        background: saved ? 'var(--accent-glow)' : 'transparent',
        opacity: loading ? 0.6 : 1,
      }}
    >
      <span style={{ fontSize: 12, lineHeight: 1 }}>{saved ? '🔖' : '⌑'}</span>
      <span>{saved ? 'Saved' : 'Save'}</span>
    </button>
  )
}
