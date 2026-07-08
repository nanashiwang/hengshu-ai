import { describe, expect, it } from 'vitest'
import { publicSkillContract } from '@/lib/skillContractPublic'

describe('skillContractPublic — 公开 Skill Contract 摘要', () => {
  it('输出 contract hash 和 prompt hash，不暴露 prompt 正文', () => {
    const row = publicSkillContract({
      id: 'v1',
      skill: 'skill-1',
      version: '1.0.0',
      systemPrompt: 'secret system prompt',
      promptTemplate: 'secret user prompt {{input}}',
      inputSchema: { input: { type: 'text' } },
      outputSchema: { result: { type: 'text' } },
      permissions: { network: false },
      contractStatus: 'breaking_change',
      routePolicy: {
        default: 'balanced',
        rawPrompt: 'secret',
        fallback: ['qwen-plus'],
        dataDriven: {
          cheap: ['real-cheap-model'],
          recomputedAt: '2026-07-08T00:00:00.000Z',
        },
      },
      changelog: 'secret prompt detail',
      examples: [{ input: 'a' }, { input: 'b' }],
    }) as any

    expect(row.contractHash).toHaveLength(64)
    expect(row.systemPromptHash).toHaveLength(64)
    expect(row.promptTemplateHash).toHaveLength(64)
    expect(row.examplesCount).toBe(2)
    expect(row.changelogHash).toHaveLength(64)
    expect(row.routePolicy).toEqual({ default: 'balanced', fallback: ['qwen-plus'] })
    expect(row.playbook).toMatchObject({
      customerValue: expect.stringContaining('可复核能力契约'),
      decision: 'review_before_upgrade',
      reviewChecklist: expect.arrayContaining([expect.stringContaining('输入 schema')]),
      nextActions: expect.arrayContaining([
        expect.objectContaining({ label: '核对契约 Hash' }),
        expect.objectContaining({ label: '检查破坏性变更' }),
      ]),
    })
    expect(row.routePolicy.dataDriven).toBeUndefined()
    expect(row.systemPrompt).toBeUndefined()
    expect(row.promptTemplate).toBeUndefined()
    expect(row.changelog).toBeUndefined()
    expect(JSON.stringify(row.playbook)).not.toContain('secret')
  })

  it('带 slug 时输出证书验签与试跑入口', () => {
    const row = publicSkillContract({ id: 'v1', version: '1.0.0', contractStatus: 'compatible_change' }, { slug: 'writer' }) as any

    expect(row.playbook.decision).toBe('safe_to_trial')
    expect(row.playbook.nextActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '核对契约 Hash', href: '/v1/skills/writer/contract' }),
        expect.objectContaining({
          label: '验签达标证书',
          href: '/verify?certificateUrl=%2Fv1%2Fskills%2Fwriter%2Fcertificate',
        }),
        expect.objectContaining({ label: '试跑或重跑', href: '/skills/writer/run' }),
      ]),
    )
  })
})
