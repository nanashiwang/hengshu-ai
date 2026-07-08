import { describe, expect, it } from 'vitest'
import { refreshSkillPassport } from '@/lib/passportRefresh'

describe('passportRefresh — 回流后刷新 Skill Passport', () => {
  it('从当前 Skill/版本/制品/兼容报告生成 Passport 并写证据快照', async () => {
    const creates: any[] = []
    const payload = {
      findByID: async (args: any) => {
        if (args.collection === 'skills') {
          return {
            id: 'skill-1',
            title: 'JSON Skill',
            status: 'published',
            visibility: 'public',
            currentVersion: { id: 'version-1', skill: 'skill-1', permissions: {}, inputSchema: {}, outputSchema: {} },
          }
        }
        return null
      },
      find: async (args: any) => {
        if (args.collection === 'skill-artifacts') {
          return { docs: [{ id: 'artifact-1', checksum: 'sha256:abc', manifest: 'signature: abc' }] }
        }
        if (args.collection === 'compat-reports') {
          return {
            docs: [
              {
                modelName: 'qwen-plus',
                success: true,
                formatValid: true,
                latencyMs: 100,
                source: 'benchmark',
                createdAt: new Date().toISOString(),
              },
            ],
            hasNextPage: false,
          }
        }
        if (args.collection === 'skill-passports') return { docs: [] }
        return { docs: [] }
      },
      findGlobal: async () => ({}),
      count: async () => ({ totalDocs: 0 }),
      create: async (args: any) => {
        creates.push(args)
        return { id: args.collection === 'skill-passports' ? 'passport-1' : 'snapshot-1', ...args.data }
      },
      logger: { warn: () => undefined, error: () => undefined },
    }

    await refreshSkillPassport(payload as any, 'skill-1')

    expect(creates[0]).toMatchObject({
      collection: 'skill-passports',
      data: { skill: 'skill-1', skillVersion: 'version-1', skillClass: 'verified', evidenceHash: expect.any(String) },
    })
    expect(creates[1]).toMatchObject({
      collection: 'evidence-snapshots',
      data: { targetType: 'skill_passport', targetId: 'passport-1', evidenceHash: creates[0].data.evidenceHash },
    })
  })

  it('当前版本不属于该 Skill 或已废弃时不刷新 Passport', async () => {
    const creates: any[] = []
    const payload = {
      findByID: async (args: any) => {
        if (args.collection === 'skills') {
          return {
            id: 'skill-1',
            title: 'JSON Skill',
            status: 'published',
            visibility: 'public',
            currentVersion: 'version-1',
          }
        }
        if (args.collection === 'skill-versions') {
          return { id: 'version-1', skill: 'skill-2', status: 'deprecated' }
        }
        return null
      },
      find: async () => ({ docs: [], hasNextPage: false }),
      findGlobal: async () => ({}),
      count: async () => ({ totalDocs: 0 }),
      create: async (args: any) => {
        creates.push(args)
        return { id: 'created-1', ...args.data }
      },
      logger: { warn: () => undefined, error: () => undefined },
    }

    await expect(refreshSkillPassport(payload as any, 'skill-1')).resolves.toBeNull()
    expect(creates).toEqual([])
  })
})
