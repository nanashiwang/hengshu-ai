import { describe, expect, it } from 'vitest'
import {
  MAX_RUNNER_CHECK_ITEMS,
  MAX_RUNNER_CHECKSUM_LENGTH,
  MAX_RUNNER_SLUG_LENGTH,
  normalizeRunnerCheckItems,
  normalizeRunnerSlug,
} from '@/lib/runnerCommandRequest'

describe('runnerCommandRequest — Runner 命令请求边界', () => {
  it('归一化 slug，并拒绝空值/超长值', () => {
    expect(normalizeRunnerSlug(' Writer.Skill_v1 ')).toBe('writer.skill_v1')
    expect(normalizeRunnerSlug('中文-skill')).toBe('中文-skill')
    expect(normalizeRunnerSlug('')).toEqual({ ok: false, status: 400, error: '缺少 slug' })
    expect(normalizeRunnerSlug('x'.repeat(MAX_RUNNER_SLUG_LENGTH + 1))).toEqual({
      ok: false,
      status: 400,
      error: 'slug 过长',
    })
  })

  it.each(['.', '..', '../..', '..\\..', '/tmp/x', 'C:\\tmp', 'writer/evil', 'writer\\evil', 'CON', 'com1.txt']) (
    '拒绝路径、绝对地址和系统保留名：%s',
    (slug) => {
      expect(normalizeRunnerSlug(slug)).toEqual({ ok: false, status: 400, error: 'slug 格式非法' })
    },
  )

  it('归一化 check items，并限制数量', () => {
    expect(normalizeRunnerCheckItems([
      { slug: ' writer ', checksum: ' sha256:abc ' },
      null,
      { slug: 'other' },
    ])).toEqual([
      { slug: 'writer', checksum: 'sha256:abc' },
      { slug: 'other', checksum: undefined },
    ])
    expect(normalizeRunnerCheckItems(Array.from({ length: MAX_RUNNER_CHECK_ITEMS + 1 }, (_, i) => ({ slug: `s-${i}` })))).toEqual({
      ok: false,
      status: 413,
      error: '检查项过多',
    })
  })

  it('拒绝 check item 中的超长 slug / checksum', () => {
    expect(normalizeRunnerCheckItems([{ slug: 'x'.repeat(MAX_RUNNER_SLUG_LENGTH + 1) }])).toEqual({
      ok: false,
      status: 400,
      error: 'slug 过长',
    })
    expect(normalizeRunnerCheckItems([{ slug: 'writer', checksum: 'x'.repeat(MAX_RUNNER_CHECKSUM_LENGTH + 1) }])).toEqual({
      ok: false,
      status: 400,
      error: 'checksum 过长',
    })
  })
})
