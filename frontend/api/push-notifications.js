const { requireCronSecret } = require('./_auth')
const { readNotifications, readState } = require('./_pushStore')

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  try {
    requireCronSecret(req)
  } catch (authError) {
    return res.status(401).json({ ok: false, error: authError.message })
  }

  return res.status(200).json({
    ok: true,
    mode: 'delivery-ready',
    notifications: readNotifications(),
    state: readState(),
    message: 'Stored notification records are available. Trigger /api/push-deliver on a schedule for automated delivery.',
  })
}
