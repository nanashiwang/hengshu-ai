import { describe, expect, it } from 'vitest'
import { SkillVersions } from '@/collections/SkillVersions'
import {
  contractStatusFor,
  isBreakingContractChange,
  skillContractHash,
} from '@/lib/skillContract'

const baseVersion = {
  systemPrompt: '你是合规审核员',
  promptTemplate: '审核 {{content}}',
  inputSchema: { content: { required: true, type: 'string' } },
  outputSchema: { result: { type: 'string' } },
  recommendedModels: { cloud: ['qwen-plus'] },
  routePolicy: { default: 'balanced' },
  permissions: { network: false, fileRead: false, fileWrite: false, shell: false },
  minRunnerVersion: '0.2.0',
}

describe('skillContract — Skill Contract hash 与变更分级', () => {
  it('对象 key 顺序不同，contract hash 仍稳定', () => {
    const reordered = {
      ...baseVersion,
      inputSchema: { content: { type: 'string', required: true } },
      routePolicy: { default: 'balanced' },
    }

    expect(skillContractHash(baseVersion)).toBe(skillContractHash(reordered))
    expect(skillContractHash(baseVersion)).toHaveLength(64)
  })

  it('只改 prompt 属于兼容变更', () => {
    const previous = { ...baseVersion, contractHash: skillContractHash(baseVersion) }
    const next = { ...baseVersion, promptTemplate: '请严格审核 {{content}}' }

    expect(isBreakingContractChange(previous, next)).toBe(false)
    expect(contractStatusFor(previous, next)).toBe('compatible_change')
  })

  it('输入/输出 schema、权限或最低 Runner 变化属于破坏性变更', () => {
    const previous = { ...baseVersion, contractHash: skillContractHash(baseVersion) }

    expect(contractStatusFor(previous, { ...baseVersion, inputSchema: { topic: { type: 'string' } } })).toBe(
      'breaking_change',
    )
    expect(contractStatusFor(previous, { ...baseVersion, outputSchema: { ok: { type: 'boolean' } } })).toBe(
      'breaking_change',
    )
    expect(
      contractStatusFor(previous, {
        ...baseVersion,
        permissions: { ...baseVersion.permissions, network: true },
      }),
    ).toBe('breaking_change')
    expect(contractStatusFor(previous, { ...baseVersion, minRunnerVersion: '0.3.0' })).toBe('breaking_change')
  })

  it('SkillVersions beforeChange 自动写入 contractHash 与 contractStatus', () => {
    const hook = SkillVersions.hooks?.beforeChange?.[0]
    expect(hook).toBeTypeOf('function')

    const createData = hook!({
      data: { ...baseVersion },
      operation: 'create',
      req: {},
    } as any) as any

    expect(createData.contractHash).toBe(skillContractHash(baseVersion))
    expect(createData.contractStatus).toBe('initial')

    const updateData = hook!({
      data: { inputSchema: { topic: { type: 'string' } } },
      originalDoc: { ...baseVersion, contractHash: skillContractHash(baseVersion) },
      operation: 'update',
      req: {},
    } as any) as any

    expect(updateData.contractHash).toBe(skillContractHash({ ...baseVersion, inputSchema: { topic: { type: 'string' } } }))
    expect(updateData.contractStatus).toBe('breaking_change')
  })
})
