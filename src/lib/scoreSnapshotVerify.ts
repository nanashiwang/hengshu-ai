import { createHash, createPublicKey, verify as edVerify } from 'crypto'
import { canonicalString } from './canonical'

export type PublicKeyInfo = { keyId: string; algorithm: string; publicKey: string } | null

export interface ScoreSnapshotCore {
  skill: string
  localScore: number
  reportCount: number
  signedAt: string
}

export interface ScoreSnapshotVerifyResult {
  core: ScoreSnapshotCore | null
  computedHash: string | null
  hashValid: boolean
  signatureValid: boolean
  keyMatch: boolean
  status: 'valid' | 'unsigned' | 'key_unavailable' | 'tampered'
  reason: string
}

function relationId(v: unknown): string {
  if (!v) return ''
  if (typeof v === 'object' && 'id' in v) return String((v as { id?: unknown }).id || '')
  return String(v)
}

export function scoreSnapshotCore(snapshot: any): ScoreSnapshotCore | null {
  const skill = relationId(snapshot?.skill)
  const signedAt = typeof snapshot?.signedAt === 'string' ? snapshot.signedAt : ''
  const localScore = Number(snapshot?.localScore)
  const reportCount = Number(snapshot?.reportCount)
  if (!skill || !signedAt || !Number.isFinite(localScore) || !Number.isFinite(reportCount)) return null
  return { skill, localScore, reportCount, signedAt }
}

export function scoreSnapshotHash(core: ScoreSnapshotCore): string {
  return createHash('sha256').update(canonicalString(core)).digest('hex')
}

export function verifyScoreSnapshot(snapshot: any, publicKeyInfo: PublicKeyInfo): ScoreSnapshotVerifyResult {
  const core = scoreSnapshotCore(snapshot)
  if (!core) {
    return {
      core: null,
      computedHash: null,
      hashValid: false,
      signatureValid: false,
      keyMatch: false,
      status: 'tampered',
      reason: '快照载荷缺少必要字段',
    }
  }

  const computedHash = scoreSnapshotHash(core)
  const hashValid = computedHash === snapshot?.payloadHash
  if (!hashValid) {
    return {
      core,
      computedHash,
      hashValid: false,
      signatureValid: false,
      keyMatch: false,
      status: 'tampered',
      reason: 'payloadHash 与规范化载荷不一致',
    }
  }

  if (!snapshot?.signature || !snapshot?.keyId) {
    return {
      core,
      computedHash,
      hashValid: true,
      signatureValid: false,
      keyMatch: false,
      status: 'unsigned',
      reason: '快照未签名，仅可验证哈希',
    }
  }

  if (!publicKeyInfo || publicKeyInfo.algorithm !== 'ed25519') {
    return {
      core,
      computedHash,
      hashValid: true,
      signatureValid: false,
      keyMatch: false,
      status: 'key_unavailable',
      reason: '当前站点未公开可用 ed25519 公钥',
    }
  }

  const keyMatch = String(snapshot.keyId) === publicKeyInfo.keyId
  if (!keyMatch) {
    return {
      core,
      computedHash,
      hashValid: true,
      signatureValid: false,
      keyMatch: false,
      status: 'key_unavailable',
      reason: '快照 keyId 与当前公钥不一致',
    }
  }

  try {
    const publicKey = createPublicKey({
      key: Buffer.from(publicKeyInfo.publicKey, 'base64'),
      format: 'der',
      type: 'spki',
    })
    const signatureValid = edVerify(
      null,
      Buffer.from(canonicalString(core), 'utf8'),
      publicKey,
      Buffer.from(String(snapshot.signature), 'base64'),
    )
    return {
      core,
      computedHash,
      hashValid: true,
      signatureValid,
      keyMatch: true,
      status: signatureValid ? 'valid' : 'tampered',
      reason: signatureValid ? '哈希与 ed25519 签名均有效' : '签名校验失败',
    }
  } catch {
    return {
      core,
      computedHash,
      hashValid: true,
      signatureValid: false,
      keyMatch: true,
      status: 'tampered',
      reason: '公钥或签名格式无效',
    }
  }
}
