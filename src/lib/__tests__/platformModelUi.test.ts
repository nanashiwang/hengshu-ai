import { describe, expect, it } from 'vitest'
import { modelPaymentMeta } from '@/lib/platformModelUi'

describe('platformModelUi — 在线运行模型付费边界', () => {
  const platform = ['deepseek-chat', 'qwen-plus']

  it('平台白名单模型可代付', () => {
    const meta = modelPaymentMeta('deepseek-chat', platform, false)
    expect(meta.kind).toBe('platform')
    expect(meta.disabled).toBe(false)
  })

  it('非白名单模型在未绑定 BYOK 时禁选', () => {
    const meta = modelPaymentMeta('claude-sonnet-4-6', platform, false)
    expect(meta.kind).toBe('requires_byok')
    expect(meta.disabled).toBe(true)
  })

  it('绑定 BYOK 后可选非白名单模型但明确标记 BYOK', () => {
    const meta = modelPaymentMeta('claude-sonnet-4-6', platform, true)
    expect(meta.kind).toBe('byok')
    expect(meta.disabled).toBe(false)
  })
})
