import { createHash, createPublicKey, verify as edVerify } from 'crypto'
import { canonicalString } from './canonical'
import { getSigningKeyId, signCanonical } from './signing'
import type { EvidenceTargetType } from './evidenceSnapshot'

export interface EvidenceAnchorBase {
  snapshotId: string
  createdAt?: string
  targetType: EvidenceTargetType
  targetId: string
  evidenceHash: string
  targetSummary?: Record<string, unknown> | null
  signedAt: string
  payloadHash?: string | null
  computedHash: string
  keyId?: string | null
  signature?: string | null
  verifyStatus: string
}

export interface EvidenceAnchorEntry extends EvidenceAnchorBase {
  entryHash: string
  previousChainHash: string | null
  chainHash: string
}

export interface EvidenceAnchorManifest {
  version: 1
  generatedAt: string
  entries: number
  chainHead: string | null
  fileHash: string
  publishedTo?: EvidenceAnchorPublication[]
  externalTimestamp?: EvidenceAnchorExternalTimestamp
  manifestSignature?: EvidenceAnchorManifestSignature
}

export interface EvidenceAnchorPublication {
  target: string
  url?: string
  publishedAt?: string
}

export interface EvidenceAnchorExternalTimestamp {
  provider: string
  timestamp?: string
  receiptUrl?: string
  receiptHash?: string
}

export interface EvidenceAnchorManifestSignature {
  algorithm: 'ed25519'
  keyId: string
  signedAt: string
  signature: string
}

export interface EvidenceAnchorManifestOptions {
  publishedTo?: EvidenceAnchorPublication[]
  externalTimestamp?: EvidenceAnchorExternalTimestamp
}

type PublicKeyInfo = { keyId: string; algorithm: string; publicKey: string } | null | undefined

export function evidenceAnchorSha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function buildEvidenceAnchorEntry(base: EvidenceAnchorBase, previousChainHash: string | null): EvidenceAnchorEntry {
  const entryHash = evidenceAnchorSha256(canonicalString(base))
  const chainHash = evidenceAnchorSha256(`${previousChainHash || 'GENESIS'}:${entryHash}`)
  return { ...base, entryHash, previousChainHash, chainHash }
}

export function buildEvidenceAnchorManifest(
  lines: string[],
  generatedAt: string,
  options: EvidenceAnchorManifestOptions = {},
): EvidenceAnchorManifest {
  const entries = lines.length
  const chainHead = entries > 0 ? JSON.parse(lines[entries - 1]).chainHash || null : null
  const file = lines.length ? `${lines.join('\n')}\n` : ''
  const manifest: EvidenceAnchorManifest = {
    version: 1,
    generatedAt,
    entries,
    chainHead,
    fileHash: evidenceAnchorSha256(file),
  }
  if (options.publishedTo?.length) manifest.publishedTo = options.publishedTo
  if (options.externalTimestamp?.provider) manifest.externalTimestamp = options.externalTimestamp
  return manifest
}

function evidenceAnchorManifestSigningCore(manifest: EvidenceAnchorManifest) {
  const { manifestSignature, ...core } = manifest
  return core
}

export function signEvidenceAnchorManifest(
  manifest: EvidenceAnchorManifest,
  env: Record<string, string | undefined> = process.env,
): EvidenceAnchorManifest {
  const signature = signCanonical(evidenceAnchorManifestSigningCore(manifest), env)
  const keyId = getSigningKeyId(env)
  if (!signature || !keyId) return manifest
  return {
    ...manifest,
    manifestSignature: {
      algorithm: 'ed25519',
      keyId,
      signedAt: new Date().toISOString(),
      signature,
    },
  }
}

function validateEvidenceAnchorManifestMetadata(
  manifest: EvidenceAnchorManifest,
): { ok: true } | { ok: false; reason: string } {
  if (manifest.publishedTo != null) {
    if (!Array.isArray(manifest.publishedTo)) return { ok: false, reason: 'manifest publishedTo 格式无效' }
    for (const item of manifest.publishedTo) {
      if (!item || typeof item !== 'object' || !String(item.target || '').trim()) {
        return { ok: false, reason: 'manifest publishedTo 缺少 target' }
      }
    }
  }
  if (manifest.externalTimestamp != null) {
    const ts = manifest.externalTimestamp
    if (!ts || typeof ts !== 'object' || !String(ts.provider || '').trim()) {
      return { ok: false, reason: 'manifest externalTimestamp 缺少 provider' }
    }
    if (ts.receiptHash && !/^[a-f0-9]{64}$/i.test(ts.receiptHash)) {
      return { ok: false, reason: 'manifest externalTimestamp.receiptHash 不是 sha256' }
    }
  }
  if (manifest.manifestSignature != null) {
    const sig = manifest.manifestSignature
    if (!sig || typeof sig !== 'object') return { ok: false, reason: 'manifestSignature 格式无效' }
    if (sig.algorithm !== 'ed25519') return { ok: false, reason: 'manifestSignature algorithm 不支持' }
    if (!String(sig.keyId || '').trim() || !String(sig.signature || '').trim() || !String(sig.signedAt || '').trim()) {
      return { ok: false, reason: 'manifestSignature 缺少 keyId/signature/signedAt' }
    }
  }
  return { ok: true }
}

export function verifyEvidenceAnchorManifestSignature(
  manifest: EvidenceAnchorManifest,
  publicKeyInfo: PublicKeyInfo,
): { ok: true } | { ok: false; reason: string } {
  const sig = manifest.manifestSignature
  if (!sig) return { ok: true }
  if (!publicKeyInfo || publicKeyInfo.algorithm !== 'ed25519') return { ok: false, reason: 'manifest 签名公钥不可用' }
  if (sig.keyId !== publicKeyInfo.keyId) return { ok: false, reason: 'manifest 签名 keyId 与当前公钥不一致' }
  try {
    const publicKey = createPublicKey({ key: Buffer.from(publicKeyInfo.publicKey, 'base64'), format: 'der', type: 'spki' })
    const ok = edVerify(
      null,
      Buffer.from(canonicalString(evidenceAnchorManifestSigningCore(manifest)), 'utf8'),
      publicKey,
      Buffer.from(sig.signature, 'base64'),
    )
    return ok ? { ok: true } : { ok: false, reason: 'manifest 签名校验失败' }
  } catch {
    return { ok: false, reason: 'manifest 签名校验失败' }
  }
}

export function verifyEvidenceAnchorLines(lines: string[]): { ok: boolean; reason: string; chainHead: string | null } {
  let previous: string | null = null
  for (let i = 0; i < lines.length; i++) {
    const parsed = JSON.parse(lines[i]) as EvidenceAnchorEntry
    const { entryHash, previousChainHash, chainHash, ...base } = parsed
    if (base.verifyStatus !== 'valid') {
      return { ok: false, reason: `第 ${i + 1} 行证据快照验签状态不是 valid`, chainHead: previous }
    }
    if (previousChainHash !== previous) {
      return { ok: false, reason: `第 ${i + 1} 行 previousChainHash 不连续`, chainHead: previous }
    }
    const expectedEntryHash = evidenceAnchorSha256(canonicalString(base))
    if (entryHash !== expectedEntryHash) {
      return { ok: false, reason: `第 ${i + 1} 行 entryHash 不匹配`, chainHead: previous }
    }
    const expectedChainHash = evidenceAnchorSha256(`${previous || 'GENESIS'}:${entryHash}`)
    if (chainHash !== expectedChainHash) {
      return { ok: false, reason: `第 ${i + 1} 行 chainHash 不匹配`, chainHead: previous }
    }
    previous = chainHash
  }
  return { ok: true, reason: '证据外锚链有效', chainHead: previous }
}

export function verifyEvidenceAnchorManifest(
  lines: string[],
  manifest: EvidenceAnchorManifest,
  publicKeyInfo?: PublicKeyInfo,
): { ok: boolean; reason: string; chainHead: string | null } {
  const chain = verifyEvidenceAnchorLines(lines)
  if (!chain.ok) return chain
  const metadata = validateEvidenceAnchorManifestMetadata(manifest)
  if (!metadata.ok) return { ...metadata, chainHead: chain.chainHead }
  const signature = verifyEvidenceAnchorManifestSignature(manifest, publicKeyInfo)
  if (!signature.ok) return { ...signature, chainHead: chain.chainHead }
  const expected = buildEvidenceAnchorManifest(lines, manifest.generatedAt)
  if (manifest.version !== 1) return { ok: false, reason: 'manifest version 不支持', chainHead: chain.chainHead }
  if (manifest.entries !== expected.entries) {
    return { ok: false, reason: 'manifest entries 与 JSONL 行数不一致', chainHead: chain.chainHead }
  }
  if (manifest.chainHead !== expected.chainHead) {
    return { ok: false, reason: 'manifest chainHead 与 JSONL 链头不一致', chainHead: chain.chainHead }
  }
  if (manifest.fileHash !== expected.fileHash) {
    return { ok: false, reason: 'manifest fileHash 与 JSONL 文件哈希不一致', chainHead: chain.chainHead }
  }
  return { ok: true, reason: '证据外锚链与 manifest 均有效', chainHead: chain.chainHead }
}
