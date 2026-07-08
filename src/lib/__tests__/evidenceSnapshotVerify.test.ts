import { createHash, generateKeyPairSync, sign as edSign } from 'crypto'
import { describe, expect, it } from 'vitest'
import { canonicalString } from '@/lib/canonical'
import {
  evidenceSnapshotCoreFromDoc,
  evidenceSnapshotHash,
  verifyEvidenceSnapshot,
  type EvidenceSnapshotCore,
  type PublicKeyInfo,
} from '@/lib/evidenceSnapshotVerify'

function keyInfo(): { privateKey: any; info: PublicKeyInfo } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const pubDer = publicKey.export({ format: 'der', type: 'spki' }) as Buffer
  return {
    privateKey,
    info: {
      keyId: createHash('sha256').update(pubDer).digest('hex').slice(0, 12),
      algorithm: 'ed25519',
      publicKey: pubDer.toString('base64'),
    },
  }
}

function signedSnapshot(core: EvidenceSnapshotCore, privateKey: any, keyId: string) {
  return {
    id: 'evidence-1',
    ...core,
    payloadHash: evidenceSnapshotHash(core),
    keyId,
    signature: edSign(null, Buffer.from(canonicalString(core), 'utf8'), privateKey).toString('base64'),
  }
}

describe('evidenceSnapshotVerify — 证据快照公开验签', () => {
  it('还原证据快照 core', () => {
    expect(
      evidenceSnapshotCoreFromDoc({
        targetType: 'skill_passport',
      targetId: 'passport-1',
      evidenceHash: 'hash-1',
      targetSummary: { modelName: 'qwen-plus', modelVersion: '2026-07-01' },
      signedAt: '2026-07-08T00:00:00.000Z',
    }),
    ).toEqual({
      targetType: 'skill_passport',
      targetId: 'passport-1',
      evidenceHash: 'hash-1',
      targetSummary: { modelName: 'qwen-plus', modelVersion: '2026-07-01' },
      signedAt: '2026-07-08T00:00:00.000Z',
    })
  })

  it('哈希与 ed25519 签名都正确时 valid', () => {
    const { privateKey, info } = keyInfo()
    const core: EvidenceSnapshotCore = {
      targetType: 'failure_case',
      targetId: 'case-1',
      evidenceHash: 'hash-1',
      targetSummary: { modelName: 'qwen-plus', primaryModelVersion: '2026-07-01' },
      signedAt: '2026-07-08T00:00:00.000Z',
    }
    const snap = signedSnapshot(core, privateKey, info!.keyId)

    expect(verifyEvidenceSnapshot(snap, info)).toMatchObject({
      status: 'valid',
      hashValid: true,
      signatureValid: true,
      keyMatch: true,
    })
  })

  it('篡改 evidenceHash 会被 payloadHash 拦下', () => {
    const { privateKey, info } = keyInfo()
    const core: EvidenceSnapshotCore = {
      targetType: 'adapter_profile',
      targetId: 'adapter-1',
      evidenceHash: 'hash-1',
      signedAt: '2026-07-08T00:00:00.000Z',
    }
    const snap = { ...signedSnapshot(core, privateKey, info!.keyId), evidenceHash: 'hash-2' }

    expect(verifyEvidenceSnapshot(snap, info)).toMatchObject({
      status: 'tampered',
      hashValid: false,
      signatureValid: false,
    })
  })

  it('无签名快照只能通过哈希，状态为 unsigned', () => {
    const core: EvidenceSnapshotCore = {
      targetType: 'skill_passport',
      targetId: 'passport-1',
      evidenceHash: 'hash-1',
      signedAt: '2026-07-08T00:00:00.000Z',
    }

    expect(verifyEvidenceSnapshot({ ...core, payloadHash: evidenceSnapshotHash(core) }, null)).toMatchObject({
      status: 'unsigned',
      hashValid: true,
      signatureValid: false,
    })
  })
})
