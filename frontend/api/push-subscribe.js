const { rateLimit } = require('./_rateLimit')
const { verifyWalletSignature } = require('./_auth')
const { readSubscriptions, writeSubscriptions } = require('./_pushStore')

module.exports = async function handler(req, res) {
  const vapidPublicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY || ''

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      configured: Boolean(vapidPublicKey),
      vapidPublicKey: vapidPublicKey || null,
      mode: 'delivery-ready',
      message: vapidPublicKey
        ? 'Push subscription endpoint is configured. Automated delivery works when /api/push-deliver is triggered on a schedule.'
        : 'Missing WEB_PUSH_VAPID_PUBLIC_KEY. Push registration cannot complete yet.',
    })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  // Rate limit by IP
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
  try { rateLimit(`subscribe:${ip}`, 10, 60_000) } catch {
    return res.status(429).json({ ok: false, error: 'Rate limit exceeded. Try again later.' })
  }
  const body = req.body || {}

  // Verify wallet signature
  let verifiedAddress
  try {
    verifiedAddress = await verifyWalletSignature(body)
  } catch (authError) {
    return res.status(401).json({ ok: false, error: authError.message })
  }

  const { walletAddress, subscription } = body
  if (!walletAddress || !subscription?.endpoint) {
    return res.status(400).json({ ok: false, error: 'walletAddress and subscription are required' })
  }

  // Verified address must match the walletAddress in the body
  if (walletAddress.toLowerCase() !== verifiedAddress.toLowerCase()) {
    return res.status(403).json({ ok: false, error: 'Address mismatch: signed address does not match walletAddress' })
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
    message: 'Push subscription saved. Trigger /api/push-deliver on a schedule to send automated notifications.',
  })
}
