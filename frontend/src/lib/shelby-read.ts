export const SHELBY_BASE_URL = 'https://api.testnet.shelby.xyz'

export function parseCid(cid: string): { address: string; blobName: string } | null {
  if (!cid) return null

  const normalized = cid.trim()
  const sep = normalized.indexOf('::')
  if (sep === -1) return null

  const address = normalized.slice(0, sep)
  const blobName = normalized.slice(sep + 2)
  if (!address || !blobName) return null

  return { address, blobName }
}

export function getShelbyPublicUrl(address: string, blobName: string): string {
  if (!address || !blobName) return ''
  return `${SHELBY_BASE_URL}/shelby/v1/blobs/${address}/${encodeURIComponent(blobName)}`
}

export function resolveContentUrl(cidOrUrl?: string | null, uploaderAddress?: string): string {
  if (!cidOrUrl) return ''

  const value = cidOrUrl.trim()
  if (!value) return ''

  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('blob:')) {
    return value
  }

  const parsed = parseCid(value)
  if (parsed) return getShelbyPublicUrl(parsed.address, parsed.blobName)
  if (uploaderAddress) return getShelbyPublicUrl(uploaderAddress, value)

  return ''
}
