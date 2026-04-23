const webpush = require('web-push')
const { readSubscriptions, readNotifications, writeNotifications, readState, writeState, writeSubscriptions } = require('./_pushStore')
const { collectRecentActivity } = require('./_pushActivity')

const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY
const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY
const subject = process.env.WEB_PUSH_VAPID_SUBJECT || 'mailto:friokurniawan@gmail.com'

if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey)
}

function buildPayload(item) {
  const title = 'CULT activity'
  switch (item.kind) {
    case 'new_subscriber':
      return { title, body: 'You got a new subscriber.', url: '/#/notifications' }
    case 'new_purchase':
      return { title, body: 'You got a new paid unlock.', url: '/#/notifications' }
    case 'new_follower':
      return { title, body: 'You got a new follower.', url: '/#/notifications' }
    case 'new_comment':
      return { title, body: 'Someone commented on your post.', url: '/#/notifications' }
    case 'new_love':
      return { title, body: 'Someone loved your post.', url: '/#/notifications' }
    default:
      return { title, body: 'New CULT activity.', url: '/#/notifications' }
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  if (!publicKey || !privateKey) {
    return res.status(501).json({ ok: false, error: 'Missing WEB_PUSH_VAPID_PUBLIC_KEY or WEB_PUSH_VAPID_PRIVATE_KEY' })
  }

  const state = readState()
  const subscriptions = readSubscriptions()
  const notifications = readNotifications()
  const recent = await collectRecentActivity()
  const unsent = recent.filter((item) => !state.sentIds.includes(item.id)).slice(0, 20)

  if (!unsent.length) {
    return res.status(200).json({ ok: true, sent: 0, message: 'No new push activity to deliver.' })
  }

  const nextNotifications = [...notifications]
  const nextSentIds = [...state.sentIds]
  let activeSubscriptions = [...subscriptions]
  let sent = 0

  for (const item of unsent) {
    const payload = JSON.stringify(buildPayload(item))
    const matchingSubs = activeSubscriptions.filter((sub) => sub.walletAddress === String(item.creatorAddr).toLowerCase())

    for (const sub of matchingSubs) {
      try {
        await webpush.sendNotification(sub.subscription, payload)
        sent += 1
      } catch (error) {
        const statusCode = error?.statusCode || error?.status
        if (statusCode === 404 || statusCode === 410) {
          activeSubscriptions = activeSubscriptions.filter((entry) => entry.endpoint !== sub.endpoint)
        }
      }
    }

    nextNotifications.unshift(item)
    nextSentIds.push(item.id)
  }

  writeNotifications(nextNotifications.slice(0, 500))
  writeState({ lastRunAt: Date.now(), sentIds: nextSentIds.slice(-2000) })
  writeSubscriptions(activeSubscriptions)

  return res.status(200).json({
    ok: true,
    sent,
    processed: unsent.length,
    activeSubscriptions: activeSubscriptions.length,
    message: 'Push delivery run completed. For realtime behavior, trigger this endpoint on a schedule.',
  })
}
