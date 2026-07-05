import { describe, expect, it } from 'vitest'
import { SEED_SKILLS } from '@/seed/skills'
import { approvedPlatformModels } from '@/lib/constants'

describe('seed skills — 冷启动供给与平台代付合规', () => {
  it('官方种子不少于 20 个，覆盖冷启动最小供给面', () => {
    expect(SEED_SKILLS.length).toBeGreaterThanOrEqual(20)
  })

  it('官方种子的云端推荐和 routePolicy 只使用平台代付白名单模型', () => {
    const approved = approvedPlatformModels()
    const used = new Set<string>()
    for (const skill of SEED_SKILLS) {
      for (const model of skill.recommendedModels.cloud) used.add(model)
      for (const list of Object.values(skill.routePolicy.strategies)) {
        for (const model of list) used.add(model)
      }
    }
    expect([...used].filter((model) => !approved.has(model))).toEqual([])
  })
})
