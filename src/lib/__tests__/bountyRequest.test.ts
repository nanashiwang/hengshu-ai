import { describe, expect, it } from 'vitest'
import {
  MAX_BOUNTY_DESCRIPTION_LENGTH,
  MAX_BOUNTY_REWARD_POINTS,
  MAX_BOUNTY_SKILL_SLUG_LENGTH,
  MAX_BOUNTY_TITLE_LENGTH,
  normalizeBountyCreate,
  normalizeBountySkillSlug,
} from '@/lib/bountyRequest'

describe('bountyRequest — 悬赏请求边界', () => {
  it('归一化合法悬赏发布请求', () => {
    expect(normalizeBountyCreate({
      title: ' 需要一个总结 Skill ',
      description: ' 处理长文 ',
      rewardPoints: '100.9',
      dueAt: '2026-08-01T00:00:00.000Z',
      idempotencyKey: 'bounty-0123456789',
      status: 'completed',
    })).toEqual({
      title: '需要一个总结 Skill',
      description: '处理长文',
      rewardPoints: 100,
      dueAt: '2026-08-01T00:00:00.000Z',
      idempotencyKey: 'bounty-0123456789',
    })
  })

  it('拒绝缺标题、超长标题/说明、非法赏金和非法截止时间', () => {
    expect(normalizeBountyCreate({})).toEqual({ ok: false, status: 400, error: '请填写悬赏标题' })
    expect(normalizeBountyCreate({ title: 'x'.repeat(MAX_BOUNTY_TITLE_LENGTH + 1) })).toEqual({ ok: false, status: 400, error: '悬赏标题过长' })
    expect(normalizeBountyCreate({ title: 't', description: 'x'.repeat(MAX_BOUNTY_DESCRIPTION_LENGTH + 1) })).toEqual({ ok: false, status: 400, error: '悬赏说明过长' })
    expect(normalizeBountyCreate({ title: 't', rewardPoints: MAX_BOUNTY_REWARD_POINTS + 1 })).toEqual({ ok: false, status: 400, error: '悬赏贡献值无效' })
    expect(normalizeBountyCreate({ title: 't', dueAt: 'not-date' })).toEqual({ ok: false, status: 400, error: '截止时间无效' })
  })

  it('归一化交付 Skill slug 并限长', () => {
    expect(normalizeBountySkillSlug(' writer ')).toBe('writer')
    expect(normalizeBountySkillSlug('')).toEqual({ ok: false, status: 400, error: '请提供交付的 Skill slug' })
    expect(normalizeBountySkillSlug('x'.repeat(MAX_BOUNTY_SKILL_SLUG_LENGTH + 1))).toEqual({ ok: false, status: 400, error: 'Skill slug 过长' })
  })
})
