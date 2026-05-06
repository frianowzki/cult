const { Aptos, AptosConfig, Network } = require('@aptos-labs/ts-sdk')

const CONTRACT_ADDRESS = process.env.VITE_CONTRACT_ADDRESS
const MODULE_NAME = 'cult'
const GRAPHQL_URL = 'https://api.testnet.aptoslabs.com/v1/graphql'
const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }))

function sanitizeAddr(addr) {
  const cleaned = addr.trim().toLowerCase()
  if (!/^0x[0-9a-f]{1,64}$/.test(cleaned)) {
    throw new Error(`Invalid address: ${addr}`)
  }
  return cleaned
}

async function graphql(query) {
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.APTOS_API_KEY || '',
    },
    body: JSON.stringify({ query }),
  })
  const json = await response.json()
  return json?.data || {}
}

async function getAllCreators() {
  if (!CONTRACT_ADDRESS) return []
  const result = await aptos.view({
    payload: {
      function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::get_all_creators`,
      typeArguments: [],
      functionArguments: [],
    },
  })
  return (result?.[0] || []).filter(Boolean)
}

async function collectRecentActivity() {
  const creators = await getAllCreators()
  const all = []

  for (const creatorAddr of creators) {
    const data = await graphql(`
      query GetPushActivity {
        subscriptions: events(
          where: {
            type: { _eq: "${CONTRACT_ADDRESS}::${MODULE_NAME}::SubscribeEvent" }
            data: { _contains: { creator_addr: "${sanitizeAddr(creatorAddr)}" } }
          }
          order_by: { transaction_version: desc }
          limit: 8
        ) { data event_index transaction_version }
        purchases: events(
          where: {
            type: { _eq: "${CONTRACT_ADDRESS}::${MODULE_NAME}::PurchaseEvent" }
            data: { _contains: { creator_addr: "${sanitizeAddr(creatorAddr)}" } }
          }
          order_by: { transaction_version: desc }
          limit: 8
        ) { data event_index transaction_version }
        follows: events(
          where: {
            type: { _eq: "${CONTRACT_ADDRESS}::${MODULE_NAME}::FollowEvent" }
            data: { _contains: { creator_addr: "${sanitizeAddr(creatorAddr)}" } }
          }
          order_by: { transaction_version: desc }
          limit: 8
        ) { data event_index transaction_version }
        comments: events(
          where: {
            type: { _eq: "${CONTRACT_ADDRESS}::${MODULE_NAME}::CommentEvent" }
            data: { _contains: { creator_addr: "${sanitizeAddr(creatorAddr)}" } }
          }
          order_by: { transaction_version: desc }
          limit: 8
        ) { data event_index transaction_version }
        loves: events(
          where: {
            type: { _eq: "${CONTRACT_ADDRESS}::${MODULE_NAME}::LoveEvent" }
            data: { _contains: { creator_addr: "${sanitizeAddr(creatorAddr)}" } }
          }
          order_by: { transaction_version: desc }
          limit: 8
        ) { data event_index transaction_version }
      }
    `)

    const mapKind = (kind, rows = []) => rows.map((event) => ({
      id: `${kind}-${event.transaction_version}-${event.event_index}`,
      kind,
      creatorAddr,
      actorAddr: event.data?.fan_addr || '',
      contentId: Number(event.data?.content_id ?? 0),
      text: event.data?.text || event.data?.comment || '',
      amountPaid: Number(event.data?.amount_paid ?? 0),
      createdAt: Number(event.transaction_version || 0),
    }))

    all.push(
      ...mapKind('new_subscriber', data.subscriptions),
      ...mapKind('new_purchase', data.purchases),
      ...mapKind('new_follower', data.follows),
      ...mapKind('new_comment', data.comments),
      ...mapKind('new_love', data.loves),
    )
  }

  return all.sort((a, b) => b.createdAt - a.createdAt)
}

module.exports = { collectRecentActivity }
