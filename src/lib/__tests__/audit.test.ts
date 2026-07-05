import { describe, expect, it } from 'vitest'
import { sanitizeAuditMetadata } from '@/lib/audit'

describe('audit — 审计元数据脱敏', () => {
  it('按 key 名和文本模式脱敏，不落 token/key 明文', () => {
    const sanitized = sanitizeAuditMetadata({
      newapiKey: 'sk-1234567890SECRET',
      header: 'Bearer abcdefghijklmnop',
      nested: { accessToken: 'runner-token-secret', note: 'plain' },
    }) as any
    expect(sanitized.newapiKey).toBe('<redacted>')
    expect(sanitized.header).toBe('<redacted>')
    expect(sanitized.nested.accessToken).toBe('<redacted>')
    expect(sanitized.nested.note).toBe('plain')
  })
})
