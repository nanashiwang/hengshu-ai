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
    expect(row.routePolicy.dataDriven).toBeUndefined()
    expect(row.systemPrompt).toBeUndefined()
    expect(row.promptTemplate).toBeUndefined()
    expect(row.changelog).toBeUndefined()
  })
})
