import { createHash, createPublicKey, verify as edVerify } from 'crypto'
import { canonicalString } from './canonical'
import { getSigningKeyId, signCanonical } from './signing'

export interface ScoreAnchorBase {
  snapshotId: string
  createdAt?: string
  skill: string
  localScore: number
  reportCount: number
  signedAt: string
  payloadHash?: string | null
  computedHash: string
  keyId?: string | null
  signature?: string | null
  verifyStatus: string
}

export interface ScoreAnchorEntry extends ScoreAnchorBase {
  entryHash: string
  previousChainHash: string | null
  chainHash: string
}

export interface ScoreAnchorManifest {
  version: 1
  generatedAt: string
  entries: number
  chainHead: string | null
  fileHash: string
  manifestSignature?: ScoreAnchorManifestSignature
}

export interface ScoreAnchorManifestSignature {
  algorithm: 'ed25519'
  keyId: string
  signedAt: string
  signature: string
}

type PublicKeyInfo = { keyId: string; algorithm: string; publicKey: string } | null | undefined

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function buildScoreAnchorEntry(base: ScoreAnchorBase, previousChainHash: string | null): ScoreAnchorEntry {
  const entryHash = sha256Hex(canonicalString(base))
  const chainHash = sha256Hex(`${previousChainHash || 'GENESIS'}:${entryHash}`)
  return { ...base, entryHash, previousChainHash, chainHash }
}

export function buildScoreAnchorManifest(lines: string[], generatedAt: string): ScoreAnchorManifest {
  const entries = lines.length
  const chainHead = entries > 0 ? JSON.parse(lines[entries - 1]).chainHash || null : null
  const file = lines.length ? `${lines.join('\n')}\n` : ''
  return {
    version: 1,
    generatedAt,
    entries,
    chainHead,
    fileHash: sha256Hex(file),
  }
}

function scoreAnchorManifestSigningCore(manifest: ScoreAnchorManifest) {
  const { manifestSignature, ...core } = manifest
  return core
}

export function signScoreAnchorManifest(
  manifest: ScoreAnchorManifest,
  env: Record<string, string | undefined> = process.env,
): ScoreAnchorManifest {
  const signature = signCanonical(scoreAnchorManifestSigningCore(manifest), env)
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

export function verifyScoreAnchorManifestSignature(
  manifest: ScoreAnchorManifest,
  publicKeyInfo: PublicKeyInfo,
): { ok: true } | { ok: false; reason: string } {
  const sig = manifest.manifestSignature
  if (!sig) return { ok: true }
  if (sig.algorithm !== 'ed25519') return { ok: false, reason: 'manifestSignature algorithm 不支持' }
  if (!String(sig.keyId || '').trim() || !String(sig.signature || '').trim() || !String(sig.signedAt || '').trim()) {
    return { ok: false, reason: 'manifestSignature 缺少 keyId/signature/signedAt' }
  }
  if (!publicKeyInfo || publicKeyInfo.algorithm !== 'ed25519') return { ok: false, reason: 'manifest 签名公钥不可用' }
  if (sig.keyId !== publicKeyInfo.keyId) return { ok: false, reason: 'manifest 签名 keyId 与当前公钥不一致' }
  try {
    const publicKey = createPublicKey({ key: Buffer.from(publicKeyInfo.publicKey, 'base64'), format: 'der', type: 'spki' })
    const ok = edVerify(
      null,
      Buffer.from(canonicalString(scoreAnchorManifestSigningCore(manifest)), 'utf8'),
      publicKey,
      Buffer.from(sig.signature, 'base64'),
    )
    return ok ? { ok: true } : { ok: false, reason: 'manifest 签名校验失败' }
  } catch {
    return { ok: false, reason: 'manifest 签名校验失败' }
  }
}

export function verifyScoreAnchorLines(lines: string[]): { ok: boolean; reason: string; chainHead: string | null } {
  let previous: string | null = null
  for (let i = 0; i < lines.length; i++) {
    const parsed = JSON.parse(lines[i]) as ScoreAnchorEntry
    const { entryHash, previousChainHash, chainHash, ...base } = parsed
    if (base.verifyStatus !== 'valid') {
      return { ok: false, reason: `第 ${i + 1} 行分数快照验签状态不是 valid`, chainHead: previous }
    }
    if (previousChainHash !== previous) {
      return { ok: false, reason: `第 ${i + 1} 行 previousChainHash 不连续`, chainHead: previous }
    }
    const expectedEntryHash = sha256Hex(canonicalString(base))
    if (entryHash !== expectedEntryHash) {
      return { ok: false, reason: `第 ${i + 1} 行 entryHash 不匹配`, chainHead: previous }
    }
    const expectedChainHash = sha256Hex(`${previous || 'GENESIS'}:${entryHash}`)
    if (chainHash !== expectedChainHash) {
      return { ok: false, reason: `第 ${i + 1} 行 chainHash 不匹配`, chainHead: previous }
    }
    previous = chainHash
  }
  return { ok: true, reason: '外锚链有效', chainHead: previous }
}

export function verifyScoreAnchorManifest(
  lines: string[],
  manifest: ScoreAnchorManifest,
  publicKeyInfo?: PublicKeyInfo,
): { ok: boolean; reason: string; chainHead: string | null } {
  const chain = verifyScoreAnchorLines(lines)
  if (!chain.ok) return chain
  const signature = verifyScoreAnchorManifestSignature(manifest, publicKeyInfo)
  if (!signature.ok) return { ...signature, chainHead: chain.chainHead }
  const expected = buildScoreAnchorManifest(lines, manifest.generatedAt)
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
  return { ok: true, reason: '外锚链与 manifest 均有效', chainHead: chain.chainHead }
}
