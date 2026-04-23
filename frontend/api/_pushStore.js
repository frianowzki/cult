const fs = require('fs')
const path = require('path')

const DATA_DIR = '/tmp/cult-push'
const SUBS_FILE = path.join(DATA_DIR, 'subscriptions.json')
const NOTIFS_FILE = path.join(DATA_DIR, 'notifications.json')
const STATE_FILE = path.join(DATA_DIR, 'state.json')

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function ensureFile(file, fallback) {
  ensureDir()
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(fallback, null, 2), 'utf8')
}

function readJson(file, fallback) {
  ensureFile(file, fallback)
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJson(file, value) {
  ensureDir()
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8')
}

function readSubscriptions() {
  return readJson(SUBS_FILE, [])
}

function writeSubscriptions(items) {
  writeJson(SUBS_FILE, items)
}

function readNotifications() {
  return readJson(NOTIFS_FILE, [])
}

function writeNotifications(items) {
  writeJson(NOTIFS_FILE, items)
}

function readState() {
  return readJson(STATE_FILE, { lastRunAt: 0, sentIds: [] })
}

function writeState(state) {
  writeJson(STATE_FILE, state)
}

module.exports = {
  readSubscriptions,
  writeSubscriptions,
  readNotifications,
  writeNotifications,
  readState,
  writeState,
}
