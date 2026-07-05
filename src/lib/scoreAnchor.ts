import { createHash } from 'crypto'
import { canonicalString } from './canonical'

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
}

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

export function verifyScoreAnchorLines(lines: string[]): { ok: boolean; reason: string; chainHead: string | null } {
  let previous: string | null = null
  for (let i = 0; i < lines.length; i++) {
    const parsed = JSON.parse(lines[i]) as ScoreAnchorEntry
    const { entryHash, previousChainHash, chainHash, ...base } = parsed
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
): { ok: boolean; reason: string; chainHead: string | null } {
  const chain = verifyScoreAnchorLines(lines)
  if (!chain.ok) return chain
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
