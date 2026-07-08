import { describe, expect, it } from 'vitest'
import { configuredEssentialStarterPack, resolveEssentialStarterPack, starterPackMetaBySkillId } from '@/lib/essentialStarterPack'

describe('essentialStarterPack — 后台必备 Skill 包', () => {
  it('后台配置优先，并按 order 排序、过滤非公开 Skill', async () => {
    const payload = {
      findGlobal: async () => ({
        essentialStarterPack: [
          { skill: { id: 's2', title: 'B', status: 'published', visibility: 'public' }, order: 2, reason: '第二个', starterExample: { text: 'demo' } },
          { skill: { id: 's1', title: 'A', status: 'published', visibility: 'public' }, order: 1, reason: '第一个' },
          { skill: { id: 'hidden', title: 'Hidden', status: 'draft', visibility: 'public' }, order: 0 },
        ],
      }),
    }

    const entries = await configuredEssentialStarterPack(payload as any)
    expect(entries.map((entry) => entry.skill.id)).toEqual(['s1', 's2'])
    expect(entries[1]).toMatchObject({ reason: '第二个', starterExample: { text: 'demo' }, order: 2 })
    expect(starterPackMetaBySkillId(entries).get('s1')?.reason).toBe('第一个')
  })

  it('无后台配置时回退 Skill isEssential', async () => {
    const payload = {
      findGlobal: async () => ({ essentialStarterPack: [] }),
      find: async (args: any) => ({
        totalDocs: 1,
        page: args.page,
        totalPages: 1,
        docs: [{ id: 's1', title: 'A', status: 'published', visibility: 'public', isEssential: true, essentialReason: '字段理由' }],
      }),
    }

    const pack = await resolveEssentialStarterPack(payload as any, { limit: 10, page: 1 })
    expect(pack).toMatchObject({
      configured: false,
      totalDocs: 1,
      entries: [{ skill: { id: 's1' }, reason: '字段理由' }],
    })
  })

  it('后台配置支持关键词和分类过滤', async () => {
    const payload = {
      findGlobal: async () => ({
        essentialStarterPack: [
          { skill: { id: 's1', title: '会议纪要', description: '办公', status: 'published', visibility: 'public', category: 'office' }, order: 1 },
          { skill: { id: 's2', title: '代码解释', description: '开发', status: 'published', visibility: 'public', category: 'dev' }, order: 2 },
        ],
      }),
    }

    const pack = await resolveEssentialStarterPack(payload as any, { q: '会议', categoryId: 'office', limit: 10 })
    expect(pack.configured).toBe(true)
    expect(pack.entries.map((entry) => entry.skill.id)).toEqual(['s1'])
  })
})
