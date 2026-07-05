import { createHash, createPublicKey, generateKeyPairSync, sign as edSign } from 'crypto'
import { describe, expect, it } from 'vitest'
import { canonicalString } from '@/lib/canonical'
import {
  scoreSnapshotCore,
  scoreSnapshotHash,
  verifyScoreSnapshot,
  type PublicKeyInfo,
  type ScoreSnapshotCore,
} from '@/lib/scoreSnapshotVerify'

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

function signedSnapshot(core: ScoreSnapshotCore, privateKey: any, keyId: string) {
  return {
    id: 'snap-1',
    ...core,
    payloadHash: scoreSnapshotHash(core),
    keyId,
    signature: edSign(null, Buffer.from(canonicalString(core), 'utf8'), privateKey).toString('base64'),
  }
}

describe('scoreSnapshotVerify — 分数快照公开验签', () => {
  it('从 relationship 对象中还原签名 core，字段顺序稳定', () => {
    expect(
      scoreSnapshotCore({
        skill: { id: 'skill-1', title: 'demo' },
        localScore: 88,
        reportCount: 9,
        signedAt: '2026-07-03T00:00:00.000Z',
      }),
    ).toEqual({
      skill: 'skill-1',
      localScore: 88,
      reportCount: 9,
      signedAt: '2026-07-03T00:00:00.000Z',
    })
  })

  it('哈希与 ed25519 签名都正确时 valid', () => {
    const { privateKey, info } = keyInfo()
    const core = { skill: 'skill-1', localScore: 91, reportCount: 12, signedAt: '2026-07-03T00:00:00.000Z' }
    const snap = signedSnapshot(core, privateKey, info!.keyId)

    expect(verifyScoreSnapshot(snap, info)).toMatchObject({
      status: 'valid',
      hashValid: true,
      signatureValid: true,
      keyMatch: true,
    })
  })

  it('篡改分数会被 payloadHash 拦下', () => {
    const { privateKey, info } = keyInfo()
    const core = { skill: 'skill-1', localScore: 91, reportCount: 12, signedAt: '2026-07-03T00:00:00.000Z' }
    const snap = { ...signedSnapshot(core, privateKey, info!.keyId), localScore: 92 }

    expect(verifyScoreSnapshot(snap, info)).toMatchObject({
      status: 'tampered',
      hashValid: false,
      signatureValid: false,
    })
  })

  it('无签名快照只能通过哈希，状态为 unsigned', () => {
    const core = { skill: 'skill-1', localScore: 91, reportCount: 12, signedAt: '2026-07-03T00:00:00.000Z' }
    expect(verifyScoreSnapshot({ ...core, payloadHash: scoreSnapshotHash(core) }, null)).toMatchObject({
      status: 'unsigned',
      hashValid: true,
      signatureValid: false,
    })
  })
})
