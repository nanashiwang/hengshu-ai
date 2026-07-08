import { describe, expect, it } from 'vitest'
import { buildSkillPassportData } from '@/lib/passport'

describe('passport — Skill Passport 初稿生成', () => {
  it('有签名制品和兼容证据时生成 verified passport', () => {
    const data = buildSkillPassportData({
      skill: { id: 's1', title: '标题生成', status: 'published', visibility: 'public', successRate: 0.9 },
      version: { id: 'v1', version: '1.0.0', permissions: { network: false, shell: false } },
      artifact: { checksum: 'sha256:abc', manifest: 'signature: abc' },
      compat: [
        {
          modelName: 'qwen-plus',
          modelProfile: 'profile-1',
          modelVersion: '2026-07-01',
          reports: 5,
          verified: 1,
          successRate: 0.9,
          formatRate: 0.8,
          avgLatencyMs: 1000,
          lowSample: false,
          effectiveSamples: 3.5,
          sourceSummary: [{ source: 'verified', count: 1, weight: 1 }],
        },
      ],
      trustedCompatibleRunCount: 3,
      now: new Date('2026-07-08T00:00:00.000Z'),
    })

    expect(data).toMatchObject({
      title: '标题生成 Passport',
      skill: 's1',
      skillVersion: 'v1',
      status: 'current',
      skillClass: 'verified',
      signatureStatus: 'signed',
      manifestChecksum: 'sha256:abc',
      lastVerifiedAt: '2026-07-08T00:00:00.000Z',
    })
    expect(data.evidenceHash).toHaveLength(64)
    expect(data.trustScore).toBeGreaterThan(50)
    expect(data.evidenceSummary).toMatchObject({ evidenceCount: 5, verifiedCount: 1, trustedCompatibleRunCount: 3 })
    expect(data.reliabilitySummary).toMatchObject({ trustedCompatibleRunCount: 3 })
    expect(data.compatibilitySummary).toMatchObject({
      bestModel: { modelName: 'qwen-plus', modelVersion: '2026-07-01' },
      models: [
        {
          modelName: 'qwen-plus',
          modelProfile: 'profile-1',
          modelVersion: '2026-07-01',
          effectiveSamples: 3.5,
          sourceSummary: [{ source: 'verified', count: 1, weight: 1 }],
        },
      ],
    })
  })

  it('高风险权限会降级为 high_risk 并要求人工审核', () => {
    const data = buildSkillPassportData({
      skill: { id: 's2', title: '脚本 Skill', status: 'published' },
      version: { id: 'v2', permissions: { shell: true } },
      artifact: { checksum: 'sha256:def', manifest: 'signature: abc' },
      compat: [],
    })

    expect(data.skillClass).toBe('high_risk')
    expect(data.safetySummary).toMatchObject({ riskyPermissions: ['shell'], requiresHumanReview: true })
  })

  it('JSON manifest 中的 signature 也会识别为 signed', () => {
    const data = buildSkillPassportData({
      skill: { id: 's3', title: 'JSON Skill', status: 'published', visibility: 'public' },
      version: { id: 'v3', permissions: {} },
      artifact: { checksum: 'sha256:json', manifest: '{"integrity":{"signature":"abc"}}' },
      compat: [],
    })

    expect(data.signatureStatus).toBe('signed')
    expect(data.skillClass).toBe('verified')
  })

})
