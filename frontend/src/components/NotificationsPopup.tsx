import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWallet } from '@aptos-labs/wallet-adapter-react'

import { getRecentNotifications, markNotificationsSeen, type NotificationItem } from '../lib/aptos'
import { resolveContentUrl } from '../lib/shelby'
import { ACCESS_LEVEL_LABELS } from '../lib/constants'

interface Props {
  onClose: () => void
  onUnreadCount?: (n: number) => void
}

export default function NotificationsPopup({ onClose, onUnreadCount }: Props) {
  const { account, connected } = useWallet()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!connected || !account?.address) {
      setNotifications([])
      setLoading(false)
      return
    }

    const load = async () => {
      setLoading(true)
      const data = await getRecentNotifications(String(account.address), 8)
      setNotifications(data)
      onUnreadCount?.(data.filter((item) => !item.isRead).length)
      setLoading(false)
    }

    load()
  }, [account?.address, connected])

  if (!connected) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-3)' }}>
        Connect wallet to see notifications
      </div>
    )
  }

  function handleMarkAllRead() {
    if (!account?.address) return
    markNotificationsSeen(String(account.address))
    const next = notifications.map((item) => ({ ...item, isRead: true }))
    setNotifications(next)
    onUnreadCount?.(0)
  }

  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--text-3)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span>Recent activity</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {!loading && notifications.some((item) => !item.isRead) && (
            <button className="btn btn-ghost btn-sm" style={{ padding: 0, fontSize: 10 }} onClick={handleMarkAllRead}>
              Mark all read
            </button>
          )}
          {!loading && notifications.length > 0 && (
            <span className="mono" style={{ fontSize: 10, color: 'var(--accent)' }}>{notifications.filter((item) => !item.isRead).length} new</span>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-3)' }}>Loading…</div>
      ) : notifications.length === 0 ? (
        <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-3)' }}>
          No notifications yet
        </div>
      ) : (
        <div style={{ maxHeight: 340, overflowY: 'auto' }}>
          {notifications.map((item) => {
            const avatarUrl = resolveContentUrl(item.creatorAvatarCid)
            return (
              <Link
                key={item.id}
                to={`/u/${item.creatorHandle}`}
                onClick={onClose}
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: '12px 16px',
                  textDecoration: 'none',
                  color: 'inherit',
                  borderBottom: '1px solid var(--border)',
                  background: item.isRead ? 'transparent' : 'color-mix(in srgb, var(--accent) 6%, transparent)',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: avatarUrl ? `url(${avatarUrl}) center/cover` : 'var(--bg-3)',
                    flexShrink: 0,
                    border: '1px solid var(--border-light)',
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{item.creatorName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>
                    published new content {!item.isRead && <span style={{ color: 'var(--accent)', fontWeight: 700 }}>• new</span>}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span>{item.contentTitle}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-3)' }}>→</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{new Date(item.publishedAt * 1000).toLocaleString()}</div>
                </div>
                <div className="badge" style={{ alignSelf: 'flex-start', fontSize: 9 }}>
                  {ACCESS_LEVEL_LABELS[item.accessLevel]}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        <Link
          to="/notifications"
          onClick={onClose}
          className="btn btn-ghost btn-sm"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          Show all notifications
        </Link>
      </div>
    </div>
  )
}
