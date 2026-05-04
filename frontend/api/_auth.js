const { Aptos, AptosConfig, Network, AccountAddress } = require('@aptos-labs/ts-sdk')

const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }))

/**
 * Verify an Aptos wallet signature.
 * Expects body to contain: { message, signature, publicKey }
 * Returns the verified address or throws.
 */
async function verifyWalletSignature(body) {
  const { message, signature, publicKey } = body || {}
  if (!message || !signature || !publicKey) {
    throw new Error('Missing auth: message, signature, and publicKey required')
  }

  const isValid = await aptos.ed25519.verifySignature({
    message,
    signature,
    publicKey,
  })

  if (!isValid) {
    throw new Error('Invalid wallet signature')
  }

  return AccountAddress.fromPublicKey(publicKey).toString()
}

function requireCronSecret(req) {
  const secret = process.env.CRON_SECRET
  if (!secret) return // no secret configured, skip check (dev mode)
  const provided = req.headers['x-cron-secret'] || ''
  if (provided !== secret) {
    throw new Error('Unauthorized: invalid cron secret')
  }
}

module.exports = { verifyWalletSignature, requireCronSecret }
