const webpush = require('web-push')
const { readSubscriptions } = require('./_pushStore')

const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY
const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY
const subject = process.env.WEB_PUSH_VAPID_SUBJECT || 'mailto:friokurniawan@gmail.com'

if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey)
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  if (!publicKey || !privateKey) {
    return res.status(501).json({ ok: false, error: 'Missing WEB_PUSH_VAPID_PUBLIC_KEY or WEB_PUSH_VAPID_PRIVATE_KEY' })
  }

  const walletAddress = String(req.query.walletAddress || req.body?.walletAddress || '').toLowerCase()
  const subscriptions = readSubscriptions().filter((sub) => !walletAddress || sub.walletAddress === walletAddress)

  if (!subscriptions.length) {
    return res.status(404).json({ ok: false, error: 'No matching push subscriptions found' })
  }

  let sent = 0
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(sub.subscription, JSON.stringify({
        title: 'CULT test push',
        body: 'Push delivery is wired. This is a sample notification.',
        url: '/#/notifications',
      }))
      sent += 1
    } catch (error) {
      console.error('push test failed', error)
    }
  }

  return res.status(200).json({ ok: true, sent, matched: subscriptions.length })
}
