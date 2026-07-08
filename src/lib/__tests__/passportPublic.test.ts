import { describe, expect, it } from 'vitest'
import { publicSkillPassport } from '@/lib/passportPublic'

describe('passportPublic — 公开 Passport 输出', () => {
  it('输出可信摘要和验签入口，不暴露内部字段', () => {
    const row = publicSkillPassport({
      id: 'passport-1',
      status: 'current',
      skillClass: 'verified',
      trustScore: 88,
      signatureStatus: 'signed',
      evidenceHash: 'a'.repeat(64),
      lastVerifiedAt: '2026-07-08T00:00:00.000Z',
      internalNote: 'secret',
      rawReports: [{ input: 'secret' }],
      capabilitySummary: {
        task: 'ok',
        examples: [{ input: 'private input', output: 'private output', inputSchema: { topic: 'string' } }],
      },
    }, { total: 1, passed: 1 }) as any

    expect(row).toMatchObject({
      id: 'passport-1',
      status: 'current',
      benchmarkSummary: { total: 1, passed: 1 },
      evidenceVerifyUrl: '/v1/evidence/verify?targetType=skill_passport&targetId=passport-1',
      evidenceVerifyPageUrl: '/verify?targetType=skill_passport&targetId=passport-1',
      playbook: {
        decision: 'accept',
        reviewChecklist: expect.arrayContaining([expect.stringContaining('Passport 是否为 current')]),
        nextActions: expect.arrayContaining([
          expect.objectContaining({ label: '验签 Passport 证据', href: '/verify?targetType=skill_passport&targetId=passport-1' }),
        ]),
      },
    })
    expect(row.internalNote).toBeUndefined()
    expect(row.rawReports).toBeUndefined()
    expect(row.capabilitySummary).toEqual({
      task: 'ok',
    })
    expect(JSON.stringify(row.playbook)).not.toContain('private input')
  })

  it('带 slug 时输出证书、Contract 和试跑复核入口', () => {
    const row = publicSkillPassport({
      id: 'passport-1',
      status: 'stale',
      trustScore: 61,
      signatureStatus: 'unsigned',
    }, null, { slug: 'writer' }) as any

    expect(row.playbook.decision).toBe('refresh_or_review')
    expect(row.playbook.nextActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: '验签达标证书',
          href: '/verify?certificateUrl=%2Fv1%2Fskills%2Fwriter%2Fcertificate',
        }),
        expect.objectContaining({ label: '查看 Contract', href: '/v1/skills/writer/contract' }),
        expect.objectContaining({ label: '用自己的模型试跑', href: '/skills/writer/run' }),
      ]),
    )
  })
})
