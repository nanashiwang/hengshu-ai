import { createHash } from 'crypto'
import { verifyEvidenceAnchorManifest, type EvidenceAnchorManifest } from './evidenceAnchor'
import { verifyScoreAnchorManifest, type ScoreAnchorManifest } from './scoreAnchor'

type PublicKeyInfo = { keyId: string; algorithm: string; publicKey: string } | null | undefined
export type AnchorVerifyKind = 'score' | 'evidence'
export type TrustedAnchorPublisher = { target?: string; urlPrefix?: string }
export const MAX_ANCHOR_VERIFY_LINES = 5000
export const MAX_ANCHOR_VERIFY_BYTES = 2_000_000

function approxBytes(value: unknown): number {
  if (typeof value === 'string') return Buffer.byteLength(value, 'utf8')
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + approxBytes(item), 0)
  if (value == null) return 0
  return Buffer.byteLength(JSON.stringify(value), 'utf8')
}

export function normalizeAnchorLines(input: unknown): string[] {
  if (Array.isArray(input)) return input.map((line) => String(line).trim()).filter(Boolean)
  return String(input || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

export function verifyAnchorManifestBundle(args: {
  kind: AnchorVerifyKind
  jsonl: unknown
  manifest: unknown
  publicKeyInfo?: PublicKeyInfo
  trustedPublishers?: TrustedAnchorPublisher[]
  externalTimestampReceipt?: unknown
}): {
  ok: boolean
  reason: string
  chainHead: string | null
  entries: number
  trustedPublication?: AnchorTrustedPublicationResult
  externalTimestampReceipt?: AnchorReceiptVerifyResult
  assurance: AnchorAssuranceResult
} {
  const inputBytes = approxBytes(args.jsonl) + approxBytes(args.manifest) + approxBytes(args.externalTimestampReceipt)
  if (inputBytes > MAX_ANCHOR_VERIFY_BYTES) {
    return {
      ok: false,
      reason: '外锚校验输入过大',
      chainHead: null,
      entries: 0,
      assurance: { level: 'invalid', passed: false, reason: '外锚校验输入过大' },
    }
  }
  const lines = normalizeAnchorLines(args.jsonl)
  if (lines.length > MAX_ANCHOR_VERIFY_LINES) {
    return {
      ok: false,
      reason: '外锚 JSONL 行数超过公开校验上限',
      chainHead: null,
      entries: lines.length,
      assurance: { level: 'invalid', passed: false, reason: '外锚 JSONL 行数超过公开校验上限' },
    }
  }
  const manifest = typeof args.manifest === 'string' ? JSON.parse(args.manifest) : args.manifest
  const result = args.kind === 'score'
    ? verifyScoreAnchorManifest(lines, manifest as ScoreAnchorManifest, args.publicKeyInfo)
    : verifyEvidenceAnchorManifest(lines, manifest as EvidenceAnchorManifest, args.publicKeyInfo)
  const trustedPublication = evaluateTrustedAnchorPublication(manifest, args.trustedPublishers)
  const externalTimestampReceipt = evaluateExternalTimestampReceipt(manifest, args.externalTimestampReceipt)
  return {
    ...result,
    entries: lines.length,
    trustedPublication,
    externalTimestampReceipt,
    assurance: evaluateAnchorAssurance(result, manifest, trustedPublication, externalTimestampReceipt),
  }
}

export type AnchorTrustedPublicationResult =
  | { status: 'not_declared'; reason: string }
  | { status: 'unconfigured'; reason: string }
  | { status: 'trusted'; reason: string; match: TrustedAnchorPublisher }
  | { status: 'untrusted'; reason: string }

export function parseTrustedAnchorPublishers(value?: string | null): TrustedAnchorPublisher[] {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      if (item.includes('|')) {
        const [target, urlPrefix] = item.split('|').map((x) => x.trim())
        return { target: target || undefined, urlPrefix: urlPrefix || undefined }
      }
      return item.startsWith('http://') || item.startsWith('https://') ? { urlPrefix: item } : { target: item }
    })
}

export function evaluateTrustedAnchorPublication(
  manifest: any,
  trustedPublishers: TrustedAnchorPublisher[] = [],
): AnchorTrustedPublicationResult {
  const publications = Array.isArray(manifest?.publishedTo) ? manifest.publishedTo : []
  if (!publications.length) return { status: 'not_declared', reason: 'manifest 未声明 publishedTo' }
  if (!trustedPublishers.length) return { status: 'unconfigured', reason: '未配置可信发布目标' }
  for (const pub of publications) {
    const target = String(pub?.target || '')
    const url = String(pub?.url || '')
    const match = trustedPublishers.find((trusted) => {
      const targetOk = !trusted.target || trusted.target === target
      const urlOk = !trusted.urlPrefix || url.startsWith(trusted.urlPrefix)
      return targetOk && urlOk
    })
    if (match) return { status: 'trusted', reason: '命中可信发布目标', match }
  }
  return { status: 'untrusted', reason: 'publishedTo 未命中可信发布目标' }
}

export type AnchorReceiptVerifyResult =
  | { status: 'not_declared'; reason: string }
  | { status: 'not_provided'; reason: string }
  | { status: 'valid'; reason: string; receiptHash: string }
  | { status: 'mismatch'; reason: string; expected: string; actual: string }

export type AnchorAssuranceLevel = 'invalid' | 'chain_only' | 'self_signed' | 'trusted_published' | 'external_timestamped'

export type AnchorAssuranceResult = {
  level: AnchorAssuranceLevel
  passed: boolean
  reason: string
}

export function evaluateAnchorAssurance(
  manifestResult: { ok: boolean; reason: string },
  manifest: any,
  trustedPublication: AnchorTrustedPublicationResult,
  receipt: AnchorReceiptVerifyResult,
): AnchorAssuranceResult {
  if (!manifestResult.ok) return { level: 'invalid', passed: false, reason: manifestResult.reason }
  if (receipt.status === 'valid') return { level: 'external_timestamped', passed: true, reason: '外锚链、manifest、可信时间戳 receipt 均有效' }
  if (trustedPublication.status === 'trusted') return { level: 'trusted_published', passed: true, reason: '外锚链、manifest 有效，且命中可信发布目标' }
  if (manifest?.manifestSignature?.signature) return { level: 'self_signed', passed: true, reason: '外锚链、manifest 和站点自签名有效' }
  return { level: 'chain_only', passed: true, reason: '外锚链和 manifest 有效，但未形成可信发布或外部时间戳证明' }
}

function receiptText(value: unknown): string {
  if (typeof value === 'string') return value
  if (value == null) return ''
  return JSON.stringify(value)
}

export function evaluateExternalTimestampReceipt(manifest: any, receipt: unknown): AnchorReceiptVerifyResult {
  const expected = String(manifest?.externalTimestamp?.receiptHash || '').trim().toLowerCase()
  if (!expected) return { status: 'not_declared', reason: 'manifest 未声明 externalTimestamp.receiptHash' }
  const text = receiptText(receipt)
  if (!text) return { status: 'not_provided', reason: '未提供外部时间戳 receipt 内容' }
  const actual = createHash('sha256').update(text).digest('hex')
  if (actual !== expected) return { status: 'mismatch', reason: '外部时间戳 receiptHash 不匹配', expected, actual }
  return { status: 'valid', reason: '外部时间戳 receiptHash 匹配', receiptHash: actual }
}
