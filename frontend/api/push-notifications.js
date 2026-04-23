const fs = require('fs')
const path = require('path')

const DATA_DIR = '/tmp/cult-push'
const NOTIFS_FILE = path.join(DATA_DIR, 'notifications.json')

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(NOTIFS_FILE)) fs.writeFileSync(NOTIFS_FILE, '[]', 'utf8')
}

function readNotifications() {
  ensureStore()
  try {
    return JSON.parse(fs.readFileSync(NOTIFS_FILE, 'utf8'))
  } catch {
    return []
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  return res.status(200).json({
    ok: true,
    mode: 'foundation-only',
    notifications: readNotifications(),
    message: 'Stored notification records are available. Automatic polling/delivery worker is not wired yet.',
  })
}
