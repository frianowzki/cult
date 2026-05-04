const buckets = new Map()

function rateLimit(key, maxRequests = 10, windowMs = 60_000) {
  const now = Date.now()
  const entry = buckets.get(key)
  if (!entry || now - entry.start > windowMs) {
    buckets.set(key, { start: now, count: 1 })
    return
  }
  entry.count += 1
  if (entry.count > maxRequests) {
    throw new Error('Rate limit exceeded. Try again later.')
  }
}

// Prune stale entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of buckets) {
    if (now - entry.start > 120_000) buckets.delete(key)
  }
}, 60_000).unref()

module.exports = { rateLimit }
