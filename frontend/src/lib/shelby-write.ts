import { Hex } from '@aptos-labs/ts-sdk'
import { SHELBY_API_KEY } from './constants'
import { getShelbyPublicUrl } from './shelby-read'

export const SHELBY_RPC_ENDPOINT = 'https://api.testnet.shelby.xyz/shelby'
const SHELBY_DEPLOYER = '0x85fdb9a176ab8ef1d9d9c1b60d60b3924f0800ac1de1cc2085fb0b8bb4988e6a'
const BLOB_EXPIRATION_MS = 1000 * 60 * 60 * 24 * 30
const DEFAULT_ENCODING_ENUM_INDEX = '0'
const DEFAULT_PART_SIZE = 5 * 1024 * 1024
export const SHELBY_REGISTER_BLOB_MAX_GAS = 20000
export const SHELBY_REGISTER_BLOB_GAS_UNIT_PRICE = 100

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

async function getCommitmentTools() {
  return import('@shelby-protocol/sdk/browser')
}

export async function encodeFileAndGetPayload(file: File, accountAddress: string, onProgress?: ProgressCallback) {
  onProgress?.('encoding', 10)
  const uniqueName = makeUniqueName(file)
  const arrayBuffer = await file.arrayBuffer()
  const data = new Uint8Array(arrayBuffer.slice(0))

  const {
    createDefaultErasureCodingProvider,
    generateCommitments,
    expectedTotalChunksets,
  } = await getCommitmentTools()

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

  return { payload, data, commitments, uniqueName, accountAddress }
}

async function uploadPart(uploadId: string, partIdx: number, partData: Uint8Array<ArrayBuffer>) {
  const partUrl = `${SHELBY_RPC_ENDPOINT}/v1/multipart-uploads/${uploadId}/parts/${partIdx}`
  let lastError: unknown
  let lastStatusText = ''

  for (let i = 0; i < 5; i++) {
    try {
      const response = await fetch(partUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream',
          ...(SHELBY_API_KEY ? { Authorization: `Bearer ${SHELBY_API_KEY}` } : {}),
        },
        body: new Blob([partData]),
      })

      if (response.ok) return
      lastStatusText = await response.text().catch(() => '')
    } catch (error) {
      lastError = error
    }

    if (i < 4) {
      await new Promise((resolve) => setTimeout(resolve, 2 ** i * 100))
    }
  }

  if (lastError) {
    throw new Error(`Failed to upload part ${partIdx}: ${String(lastError)}`)
  }

  throw new Error(`Failed to upload part ${partIdx}: ${lastStatusText || 'unknown error'}`)
}

export async function pushBlobToRpc(blobName: string, data: Uint8Array, accountAddress: string, onProgress?: ProgressCallback): Promise<ShelbyUploadResult> {
  onProgress?.('uploading', 70)

  const startResponse = await fetch(`${SHELBY_RPC_ENDPOINT}/v1/multipart-uploads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(SHELBY_API_KEY ? { Authorization: `Bearer ${SHELBY_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      rawAccount: accountAddress,
      rawBlobName: blobName,
      rawPartSize: DEFAULT_PART_SIZE,
    }),
  })

  if (!startResponse.ok) {
    throw new Error(`Failed to start multipart upload: ${await startResponse.text()}`)
  }

  const { uploadId } = await startResponse.json() as { uploadId: string }
  const totalParts = Math.ceil(data.length / DEFAULT_PART_SIZE)

  for (let partIdx = 0; partIdx < totalParts; partIdx++) {
    const start = partIdx * DEFAULT_PART_SIZE
    const end = Math.min(start + DEFAULT_PART_SIZE, data.length)
    const partBytes = Array.from(data.subarray(start, end))
    await uploadPart(uploadId, partIdx, new Uint8Array(partBytes))
    const uploadedBytes = end
    const percent = 70 + Math.round((uploadedBytes / data.length) * 28)
    onProgress?.('uploading', Math.min(percent, 98))
  }

  const completeResponse = await fetch(`${SHELBY_RPC_ENDPOINT}/v1/multipart-uploads/${uploadId}/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(SHELBY_API_KEY ? { Authorization: `Bearer ${SHELBY_API_KEY}` } : {}),
    },
  })

  if (!completeResponse.ok) {
    throw new Error(`Failed to complete multipart upload: ${await completeResponse.text()}`)
  }

  onProgress?.('done', 100)

  return {
    blobName,
    uploaderAddress: accountAddress,
    size: data.length,
    url: getShelbyPublicUrl(accountAddress, blobName),
  }
}

export async function mockUpload(file: File, onProgress?: ProgressCallback): Promise<ShelbyUploadResult> {
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
  return {
    function: `${SHELBY_DEPLOYER}::blob_metadata::delete_blob` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [blobName],
  }
}
