import {
  ShelbyClient,
  ShelbyBlobClient,
  createDefaultErasureCodingProvider,
  generateCommitments,
  expectedTotalChunksets,
} from '@shelby-protocol/sdk/browser'
import { Hex, Network } from '@aptos-labs/ts-sdk'
import { SHELBY_API_KEY } from './constants'

export const SHELBY_BASE_URL = 'https://api.testnet.shelby.xyz'
export const SHELBY_RPC_ENDPOINT = 'https://api.testnet.shelby.xyz/shelby'

const SHELBY_DEPLOYER = '0x85fdb9a176ab8ef1d9d9c1b60d60b3924f0800ac1de1cc2085fb0b8bb4988e6a'
const BLOB_EXPIRATION_MS = 1000 * 60 * 60 * 24 * 30
const DEFAULT_ENCODING_ENUM_INDEX = '0'

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

  if (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('blob:')
  ) {
    return value
  }

  const parsed = parseCid(value)
  if (parsed) return getShelbyPublicUrl(parsed.address, parsed.blobName)
  if (uploaderAddress) return getShelbyPublicUrl(uploaderAddress, value)

  return ''
}

export function getShelbyClient() {
  return new ShelbyClient({
    network: Network.TESTNET,
    apiKey: SHELBY_API_KEY || undefined,
  })
}

export interface ShelbyUploadResult {
  blobName: string
  uploaderAddress: string
  size: number
  url: string
}

export type ProgressCallback = (
  step: 'encoding' | 'registering' | 'uploading' | 'done',
  percent: number
) => void

function makeUniqueName(file: File): string {
  const dotIndex = file.name.lastIndexOf('.')
  const base = (dotIndex > 0 ? file.name.slice(0, dotIndex) : file.name)
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'file'
  const ext = dotIndex > 0 ? file.name.slice(dotIndex).toLowerCase() : ''
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return `${base}-${suffix}${ext}`
}

export async function encodeFileAndGetPayload(
  file: File,
  accountAddress: string,
  onProgress?: ProgressCallback,
) {
  onProgress?.('encoding', 10)
  const uniqueName = makeUniqueName(file)

  // Use Uint8Array directly — avoid Buffer which can corrupt binary data in browser
  const arrayBuffer = await file.arrayBuffer()
  const data = new Uint8Array(arrayBuffer)

  const provider = await createDefaultErasureCodingProvider()
  const commitments = await generateCommitments(provider, data)
  onProgress?.('encoding', 40)

  const expirationMicros = (Date.now() + BLOB_EXPIRATION_MS) * 1000
  const numChunksets = expectedTotalChunksets(commitments.raw_data_size)

  const payload = {
    function: `${SHELBY_DEPLOYER}::blob_metadata::register_blob` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [
      uniqueName,
      expirationMicros.toString(),
      Hex.fromHexString(commitments.blob_merkle_root).toUint8Array(),
      numChunksets.toString(),
      commitments.raw_data_size.toString(),
      '0',
      DEFAULT_ENCODING_ENUM_INDEX,
    ],
  }

  return { payload, data, commitments, uniqueName }
}

export async function pushBlobToRpc(
  blobName: string,
  data: Uint8Array,
  accountAddress: string,
  onProgress?: ProgressCallback,
): Promise<ShelbyUploadResult> {
  onProgress?.('uploading', 70)
  const shelbyClient = getShelbyClient()
  await shelbyClient.rpc.putBlob({
    account: accountAddress,
    blobName,
    blobData: data,
  })
  onProgress?.('done', 100)

  return {
    blobName,
    uploaderAddress: accountAddress,
    size: data.length,
    url: getShelbyPublicUrl(accountAddress, blobName),
  }
}

export async function mockUpload(
  file: File,
  onProgress?: ProgressCallback,
): Promise<ShelbyUploadResult> {
  onProgress?.('encoding', 20)
  await new Promise((r) => setTimeout(r, 400))
  onProgress?.('registering', 50)
  await new Promise((r) => setTimeout(r, 500))
  onProgress?.('uploading', 80)
  await new Promise((r) => setTimeout(r, 400))
  onProgress?.('done', 100)

  const uniqueName = makeUniqueName(file)
  return {
    blobName: uniqueName,
    uploaderAddress: '0xmock',
    size: file.size,
    url: URL.createObjectURL(file),
  }
}

export function isShelbyEnabled(): boolean {
  return !!SHELBY_API_KEY
}

export function buildDeleteBlobPayload(blobName: string) {
  return ShelbyBlobClient.createDeleteBlobPayload({
    blobName,
  })
}
