import { describe, expect, it } from 'vitest'
import { buildAdapterProfileWhere, isPublicAdapterProfile, publicAdapterProfile } from '@/lib/adapterProfilePublic'

describe('adapterProfilePublic — 公开 Adapter 效果摘要', () => {
  it('构造公开 Adapter 筛选条件，默认只读 active', () => {
    const params = new URLSearchParams({
      skillId: 'skill-1',
      modelName: 'qwen-plus',
      modelVersion: '2026-07-01',
      failureType: 'json_parse_error',
      failureId: 'failure-1',
      modelProfile: 'profile-1',
    })
    expect(buildAdapterProfileWhere(params)).toEqual({
      and: [
        { status: { equals: 'active' } },
        { 'skill.status': { equals: 'published' } },
        { 'skill.visibility': { equals: 'public' } },
        { skill: { equals: 'skill-1' } },
        { modelName: { equals: 'qwen-plus' } },
        {
          or: [
            { modelVersion: { equals: '2026-07-01' } },
            { 'modelProfile.modelVersion': { equals: '2026-07-01' } },
          ],
        },
        { failureTypes: { contains: 'json_parse_error' } },
        { sourceFailureCase: { equals: 'failure-1' } },
        { modelProfile: { equals: 'profile-1' } },
      ],
    })
    expect(buildAdapterProfileWhere(new URLSearchParams({ status: 'all' }))).toEqual({
      and: [
        { status: { equals: 'active' } },
        { 'skill.status': { equals: 'published' } },
        { 'skill.visibility': { equals: 'public' } },
      ],
    })
    expect(buildAdapterProfileWhere(new URLSearchParams({ status: 'disabled' }))).toEqual({
      and: [
        { status: { equals: 'active' } },
        { 'skill.status': { equals: 'published' } },
        { 'skill.visibility': { equals: 'public' } },
      ],
    })
  })

  it('输出 lift/证据摘要，不暴露补丁正文', () => {
    const row = publicAdapterProfile({
      id: 'adapter-1',
      title: 'JSON 修复',
      skill: { id: 'skill-1', slug: 'writer', title: 'Writer', status: 'published', visibility: 'public' },
      modelName: 'qwen-plus',
      modelVersion: '2026-07-01',
      modelProfile: { id: 'profile-1', modelName: 'qwen-plus', modelVersion: '2026-07-01', provider: 'qwen' },
      status: 'active',
      failureTypes: ['json_parse_error'],
      liftScore: 12.5,
      beforeMetrics: { samples: 10, successRate: 0.6, newapiLogId: 'log-secret' },
      afterMetrics: { samples: 8, successRate: 0.85, platformMargin: 12 },
      evidenceHash: 'a'.repeat(64),
      systemPromptAppend: 'secret patch',
      outputSchemaPatch: { secret: true },
      decodingPatch: { temperature: 0.1 },
    }) as any

    expect(row).toMatchObject({
      id: 'adapter-1',
      modelName: 'qwen-plus',
      modelVersion: '2026-07-01',
      modelProfile: { id: 'profile-1', title: 'qwen-plus', modelVersion: '2026-07-01', provider: 'qwen' },
      liftScore: 12.5,
      evidenceVerifyUrl: '/v1/evidence/verify?targetType=adapter_profile&targetId=adapter-1',
      evidenceVerifyPageUrl: '/verify?targetType=adapter_profile&targetId=adapter-1',
    })
    expect(row.systemPromptAppend).toBeUndefined()
    expect(row.outputSchemaPatch).toBeUndefined()
    expect(row.decodingPatch).toBeUndefined()
    expect(row.beforeMetrics).toEqual({ samples: 10, successRate: 0.6 })
    expect(row.afterMetrics).toEqual({ samples: 8, successRate: 0.85 })
  })

  it('截断公开 Adapter 筛选中的超长字符串', () => {
    const where = buildAdapterProfileWhere(new URLSearchParams({
      skillId: 's'.repeat(200),
      modelName: 'm'.repeat(200),
      modelVersion: 'v'.repeat(200),
      failureType: 'f'.repeat(100),
    })) as any
    expect(where.and).toContainEqual({ skill: { equals: 's'.repeat(160) } })
    expect(where.and).toContainEqual({ modelName: { equals: 'm'.repeat(160) } })
    expect(where.and).toContainEqual({
      or: [
        { modelVersion: { equals: 'v'.repeat(160) } },
        { 'modelProfile.modelVersion': { equals: 'v'.repeat(160) } },
      ],
    })
    expect(where.and).toContainEqual({ failureTypes: { contains: 'f'.repeat(80) } })
  })

  it('私有 Skill 关联的 Adapter 不进入公开列表，也不暴露 Skill 摘要', () => {
    const adapter = {
      id: 'adapter-private',
      status: 'active',
      skill: { id: 'skill-private', slug: 'secret', title: 'Secret', status: 'published', visibility: 'private' },
    }

    expect(isPublicAdapterProfile(adapter)).toBe(false)
    expect(publicAdapterProfile(adapter).skill).toBeNull()
  })
})
