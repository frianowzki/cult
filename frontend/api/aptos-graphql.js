const APTOS_API_KEY = process.env.APTOS_API_KEY || ''
const APTOS_GRAPHQL_URL = 'https://api.testnet.aptoslabs.com/v1/graphql'

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = req.body || {}
  if (!body.query || typeof body.query !== 'string') {
    return res.status(400).json({ error: 'Missing query' })
  }

  // Cap query size to prevent abuse
  if (body.query.length > 10000) {
    return res.status(400).json({ error: 'Query too large' })
  }

  try {
    const response = await fetch(APTOS_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': APTOS_API_KEY,
      },
      body: JSON.stringify({ query: body.query }),
    })

    const json = await response.json()
    return res.status(response.status).json(json)
  } catch (error) {
    console.error('aptos-graphql proxy error:', error)
    return res.status(500).json({ error: 'GraphQL proxy error' })
  }
}
