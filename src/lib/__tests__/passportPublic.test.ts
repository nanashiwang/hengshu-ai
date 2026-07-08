import { describe, expect, it } from 'vitest'
import { publicSkillPassport } from '@/lib/passportPublic'

describe('passportPublic — 公开 Passport 输出', () => {
  it('输出可信摘要和验签入口，不暴露内部字段', () => {
    const row = publicSkillPassport({
      id: 'passport-1',
      status: 'current',
      skillClass: 'verified',
      trustScore: 88,
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
    })
    expect(row.internalNote).toBeUndefined()
    expect(row.rawReports).toBeUndefined()
    expect(row.capabilitySummary).toEqual({
      task: 'ok',
    })
  })
})
