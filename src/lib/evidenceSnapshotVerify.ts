import { createHash, createPublicKey, verify as edVerify } from 'crypto'
import { canonicalString } from './canonical'
import type { EvidenceTargetType } from './evidenceSnapshot'

export type PublicKeyInfo = { keyId: string; algorithm: string; publicKey: string } | null

export interface EvidenceSnapshotCore {
  targetType: EvidenceTargetType
  targetId: string
  evidenceHash: string
  signedAt: string
  targetSummary?: Record<string, unknown>
}

export interface EvidenceSnapshotVerifyResult {
  core: EvidenceSnapshotCore | null
  computedHash: string | null
  hashValid: boolean
  signatureValid: boolean
  keyMatch: boolean
  status: 'valid' | 'unsigned' | 'key_unavailable' | 'tampered'
  reason: string
}

export function evidenceSnapshotCoreFromDoc(snapshot: any): EvidenceSnapshotCore | null {
  const targetType = String(snapshot?.targetType || '') as EvidenceTargetType
  const targetId = String(snapshot?.targetId || '')
  const evidenceHash = String(snapshot?.evidenceHash || '')
  const signedAt = String(snapshot?.signedAt || '')
  if (!targetType || !targetId || !evidenceHash || !signedAt) return null
  if (!['skill_passport', 'failure_case', 'adapter_profile'].includes(targetType)) return null
  const core: EvidenceSnapshotCore = { targetType, targetId, evidenceHash, signedAt }
  if (snapshot?.targetSummary && typeof snapshot.targetSummary === 'object' && !Array.isArray(snapshot.targetSummary)) {
    core.targetSummary = snapshot.targetSummary
  }
  return core
}

export function evidenceSnapshotHash(core: EvidenceSnapshotCore): string {
  return createHash('sha256').update(canonicalString(core)).digest('hex')
}

export function verifyEvidenceSnapshot(snapshot: any, publicKeyInfo: PublicKeyInfo): EvidenceSnapshotVerifyResult {
  const core = evidenceSnapshotCoreFromDoc(snapshot)
  if (!core) {
    return {
      core: null,
      computedHash: null,
      hashValid: false,
      signatureValid: false,
      keyMatch: false,
      status: 'tampered',
      reason: '证据快照缺少必要字段',
    }
  }

  const computedHash = evidenceSnapshotHash(core)
  const hashValid = computedHash === snapshot?.payloadHash
  if (!hashValid) {
    return {
      core,
      computedHash,
      hashValid: false,
      signatureValid: false,
      keyMatch: false,
      status: 'tampered',
      reason: 'payloadHash 与规范化证据载荷不一致',
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
      reason: '证据快照未签名，仅可验证哈希',
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
      reason: '证据快照 keyId 与当前公钥不一致',
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
      reason: signatureValid ? '证据哈希与 ed25519 签名均有效' : '证据快照签名校验失败',
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
