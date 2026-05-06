const { rateLimit } = require('./_rateLimit')
const { verifyWalletSignature } = require('./_auth')

const SHELBY_API_KEY = process.env.SHELBY_API_KEY
const SHELBY_BASE_URL = 'https://api.testnet.shelby.xyz'

function parseCid(cid) {
  if (!cid || !cid.includes('::')) return null
  const idx = cid.indexOf('::')
  return {
    address: cid.slice(0, idx),
    blobName: cid.slice(idx + 2),
  }
}

module.exports = async function handler(req, res) {
  try {
    // Rate limit by IP
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
    try { rateLimit(`delete:${ip}`, 10, 60_000) } catch {
      return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' })
    }
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    if (!SHELBY_API_KEY) {
      console.error('Missing SHELBY_API_KEY')
      return res.status(500).json({ error: 'Missing SHELBY_API_KEY' })
    }

    const body = req.body || {}

    // Verify wallet signature
    let verifiedAddress
    try {
      verifiedAddress = await verifyWalletSignature(body)
    } catch (authError) {
      return res.status(401).json({ error: authError.message })
    }

    const cid = body.cid

    console.log('delete request cid:', cid)

    if (!cid || typeof cid !== 'string') {
      return res.status(400).json({ error: 'Missing cid' })
    }

    const parsed = parseCid(cid)
    if (!parsed) {
      return res.status(400).json({ error: 'Invalid cid format. Expected address::blobName' })
    }

    // The verified address must match the CID's address prefix
    if (parsed.address.toLowerCase() !== verifiedAddress.toLowerCase()) {
      return res.status(403).json({ error: 'Address mismatch: you can only delete your own blobs' })
    }

    const address = parsed.address
    const blobName = parsed.blobName
    const url = `${SHELBY_BASE_URL}/shelby/v1/blobs/${address}/${encodeURIComponent(blobName)}`

    console.log('delete url:', url)

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${SHELBY_API_KEY}`,
      },
    })

    const raw = await response.text()
    console.log('shelby status:', response.status)
    console.log('shelby body:', raw)

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Delete failed' })
    }

    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('delete-shelby-blob fatal:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
