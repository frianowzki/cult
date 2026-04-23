const fs = require('fs')
const path = require('path')

const DATA_DIR = '/tmp/cult-push'
const SUBS_FILE = path.join(DATA_DIR, 'subscriptions.json')

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(SUBS_FILE)) fs.writeFileSync(SUBS_FILE, '[]', 'utf8')
}

function readSubscriptions() {
  ensureStore()
  try {
    return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8'))
  } catch {
    return []
  }
}

function writeSubscriptions(items) {
  ensureStore()
  fs.writeFileSync(SUBS_FILE, JSON.stringify(items, null, 2), 'utf8')
}

module.exports = async function handler(req, res) {
  const vapidPublicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY || ''

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      configured: Boolean(vapidPublicKey),
      vapidPublicKey: vapidPublicKey || null,
      mode: 'foundation-only',
      message: vapidPublicKey
        ? 'Push subscription endpoint is configured. Automated delivery still needs a scheduled poller or worker.'
        : 'Missing WEB_PUSH_VAPID_PUBLIC_KEY. Push registration cannot complete yet.',
    })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const { walletAddress, subscription } = req.body || {}
  if (!walletAddress || !subscription?.endpoint) {
    return res.status(400).json({ ok: false, error: 'walletAddress and subscription are required' })
  }

  const existing = readSubscriptions()
  const deduped = existing.filter((item) => item.endpoint !== subscription.endpoint)
  deduped.push({
    walletAddress: String(walletAddress).toLowerCase(),
    endpoint: subscription.endpoint,
    subscription,
    createdAt: Date.now(),
  })
  writeSubscriptions(deduped)

  return res.status(200).json({
    ok: true,
    stored: true,
    count: deduped.length,
    message: 'Push subscription saved. Automated delivery still needs a poller/cron worker.',
  })
}
