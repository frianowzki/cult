const { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } = require('@aptos-labs/ts-sdk')

const CONTRACT_ADDRESS = process.env.VITE_CONTRACT_ADDRESS
const MODULE_NAME = 'cult'
const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }))

function getSchedulerAccount() {
  const privateKey = process.env.APTOS_SCHEDULER_PRIVATE_KEY
  if (!privateKey) return null
  try {
    return Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(privateKey) })
  } catch {
    return null
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      configured: Boolean(getSchedulerAccount() && CONTRACT_ADDRESS),
      message: getSchedulerAccount() && CONTRACT_ADDRESS
        ? 'Scheduler signer configured'
        : 'Missing APTOS_SCHEDULER_PRIVATE_KEY or VITE_CONTRACT_ADDRESS',
    })
  }

  return res.status(501).json({
    ok: false,
    error: 'Automatic scheduled publishing is not safely enabled yet. It requires a dedicated signer flow or creator delegation model, which is not implemented in this repo.',
  })
}
