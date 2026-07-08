import { describe, expect, it } from 'vitest'
import { runnerUpdatePlaybook } from '@/lib/runnerUpdatePlaybook'

describe('runnerUpdatePlaybook — Runner 更新复验指引', () => {
  it('有过期安装时要求先更新再回流', () => {
    const playbook = runnerUpdatePlaybook([
      { slug: 'writer', available: true, outdated: true, checksum: 'sha256:new' },
      { slug: 'summary', available: true, outdated: false },
    ])

    expect(playbook).toMatchObject({
      customerValue: expect.stringContaining('可回流状态'),
      decision: 'update_before_report',
      summary: { checked: 2, available: 2, outdated: 1, missing: 0 },
      nextActions: expect.arrayContaining([
        expect.objectContaining({ label: '先更新过期 Skill', slugs: ['writer'] }),
        expect.objectContaining({ label: '重新验签 manifest', href: '/v1/keys' }),
        expect.objectContaining({ label: '回流前复验', href: '/v1/runner/report' }),
      ]),
    })
  })

  it('不可用项进入 review_missing，且不泄漏 token/key', () => {
    const playbook = runnerUpdatePlaybook([{ slug: 'gone', available: false }])
    const text = JSON.stringify(playbook)

    expect(playbook.decision).toBe('review_missing')
    expect(playbook.summary).toMatchObject({ checked: 1, missing: 1 })
    expect(playbook.nextActions).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: '处理不可用项', slugs: ['gone'] })]),
    )
    expect(text).not.toMatch(/runner-token|access_token|sk-/i)
  })
})
