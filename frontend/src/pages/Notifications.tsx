import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { motion } from 'framer-motion'

import { getRecentNotifications, getLastNotificationsSeenAt, markNotificationsSeen, type NotificationItem, unitsToUsd } from '../lib/aptos'
import { ACCESS_LEVEL_LABELS } from '../lib/constants'
import { resolveContentUrl } from '../lib/shelby'

function getNotificationCopy(item: NotificationItem) {
  switch (item.kind) {
    case 'new_subscriber':
      return {
        label: 'New subscriber',
        body: `${item.actorName || item.actorAddr?.slice(0, 6) || 'Someone'} joined${typeof item.tierIndex === 'number' ? ` Tier ${item.tierIndex + 1}` : ''}.`,
        meta: item.amountPaid ? `${unitsToUsd(item.amountPaid)} USD` : null,
      }
    case 'new_purchase':
      return {
        label: 'New purchase',
        body: `${item.actorName || item.actorAddr?.slice(0, 6) || 'Someone'} unlocked ${item.contentTitle || 'a post'}.`,
        meta: item.amountPaid ? `${unitsToUsd(item.amountPaid)} USD` : null,
      }
    case 'new_follower':
      return {
        label: 'New follower',
        body: `${item.actorName || item.actorAddr?.slice(0, 6) || 'Someone'} followed you.`,
        meta: null,
      }
    case 'new_comment':
      return {
        label: 'New comment',
        body: `${item.actorName || item.actorAddr?.slice(0, 6) || 'Someone'} commented on ${item.contentTitle || 'your post'}.`,
        meta: item.commentText ? `“${item.commentText.slice(0, 120)}${item.commentText.length > 120 ? '…' : ''}”` : null,
      }
    case 'new_post':
    default:
      return {
        label: 'New post',
        body: `${item.creatorName} published ${item.contentTitle || 'new content'}.`,
        meta: typeof item.accessLevel === 'number' ? ACCESS_LEVEL_LABELS[item.accessLevel] : null,
      }
  }
}

export default function Notifications() {
  const { connected, account } = useWallet()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void loadNotifications()
  }, [account?.address])

  async function loadNotifications() {
    if (!connected || !account?.address) {
      setItems([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const lastSeen = getLastNotificationsSeenAt(String(account.address))
      const data = await getRecentNotifications(String(account.address), 80)
      setItems(data.map((item) => ({ ...item, isRead: item.createdAt * 1000 <= lastSeen })))
    } catch (e) {
      console.error(e)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (connected && account?.address) {
      markNotificationsSeen(String(account.address))
    }
  }, [connected, account?.address])

  if (!connected) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '80px 16px', textAlign: 'center' }}>
        <div className="section-eyebrow">Notifications</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 300, marginBottom: 12 }}>
          Connect wallet to view notifications
        </h2>
        <p style={{ color: 'var(--text-2)' }}>
          Follow creators and publish as a creator, then activity will appear here.
        </p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="section-eyebrow">Notifications</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 300, marginBottom: 6 }}>
            Notifications that matter
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>Posts, followers, subscribers, purchases, and comments in one feed.</p>
        </div>
        {!loading && items.length > 0 && (
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {items.filter((item) => !item.isRead).length} new · {items.length} updates
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="card" style={{ padding: 20 }}>
              <div className="skeleton" style={{ height: 16, width: '40%', marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 12, width: '100%', marginBottom: 6 }} />
              <div className="skeleton" style={{ height: 12, width: '70%' }} />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '56px 24px', borderStyle: 'dashed' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.2rem', color: 'var(--text-3)', marginBottom: 12 }}>
            ◌
          </div>
          <p style={{ marginBottom: 18 }}>No notifications yet.</p>
          <Link to="/explore" className="btn btn-primary">Explore creators</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((item, index) => {
            const copy = getNotificationCopy(item)
            const avatarUrl = resolveContentUrl(item.kind === 'new_post' ? item.creatorAvatarCid : item.actorAvatarCid || item.creatorAvatarCid)

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="card"
                style={{ padding: '16px 18px', background: item.isRead ? undefined : 'rgba(254,119,201,0.04)' }}
              >
                <Link
                  to={`/u/${item.creatorHandle}`}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 12, textDecoration: 'none', color: 'inherit' }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: '50%',
                      background: avatarUrl ? `url(${avatarUrl}) center/cover no-repeat` : 'var(--bg-3)',
                      border: '1px solid var(--border-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--accent)',
                      flexShrink: 0,
                    }}
                  >
                    {!avatarUrl && (item.kind === 'new_post' ? '✦' : '•')}
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                      <span className="badge" style={{ fontSize: 10 }}>{copy.label}</span>
                      <span style={{ fontWeight: 700 }}>{item.creatorName}</span>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>
                        @{item.creatorHandle}
                      </span>
                      {!item.isRead && <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 11 }}>• new</span>}
                    </div>

                    <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, marginBottom: 8 }}>
                      {copy.body}
                    </p>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {copy.meta ? <span className="badge">{copy.meta}</span> : null}
                      {item.kind === 'new_post' && typeof item.accessLevel === 'number' ? <span className="badge">{ACCESS_LEVEL_LABELS[item.accessLevel]}</span> : null}
                      <span className="badge mono" style={{ fontSize: 10 }}>
                        {new Date(item.createdAt * 1000).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
