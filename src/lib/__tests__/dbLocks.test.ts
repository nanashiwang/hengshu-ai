import { describe, expect, it, vi } from 'vitest'
import { acquireInviteCodeLock, acquireUserLedgerLock, advisoryHashKey, LEDGER_LOCK_NAMESPACES } from '@/lib/dbLocks'

describe('dbLocks — 用户账本咨询锁', () => {
  it('advisoryHashKey 稳定且落在 signed int 正数范围', () => {
    const a = advisoryHashKey('user-1')
    const b = advisoryHashKey('user-1')
    expect(a).toBe(b)
    expect(a).toBeGreaterThanOrEqual(0)
    expect(a).toBeLessThan(2 ** 31)
  })

  it('acquireUserLedgerLock 只拼接数字 key，不泄露/拼接原始 userId', async () => {
    const execute = vi.fn(async (_arg: any) => undefined)
    const payload = {
      db: {
        sessions: { tx1: { db: 'session-db' } },
        execute,
      },
    } as any

    await acquireUserLedgerLock(payload, 'tx1', 'credit', "u1'); DROP TABLE users; --")

    expect(execute).toHaveBeenCalledWith({
      db: 'session-db',
      raw: expect.stringMatching(
        new RegExp(`^SELECT pg_advisory_xact_lock\\(${LEDGER_LOCK_NAMESPACES.credit}, \\d+\\)$`),
      ),
    })
    const firstCall = execute.mock.calls[0]?.[0] as { raw: string } | undefined
    expect(firstCall?.raw).not.toContain('DROP TABLE')
  })

  it('无事务会话时 fail-closed', async () => {
    const payload = { db: { sessions: {}, execute: vi.fn() } } as any
    await expect(acquireUserLedgerLock(payload, 'missing', 'contribution', 'u1')).rejects.toThrow(
      '事务会话不可用',
    )
  })

  it('acquireInviteCodeLock 规范化邀请码并只拼接数字 key', async () => {
    const execute = vi.fn(async (_arg: any) => undefined)
    const payload = {
      db: {
        sessions: { tx1: { db: 'session-db' } },
        execute,
      },
    } as any

    await acquireInviteCodeLock(payload, 'tx1', " abc123'); DROP TABLE invite_codes; --")

    expect(execute).toHaveBeenCalledWith({
      db: 'session-db',
      raw: expect.stringMatching(
        new RegExp(`^SELECT pg_advisory_xact_lock\\(${LEDGER_LOCK_NAMESPACES.inviteCode}, \\d+\\)$`),
      ),
    })
    const firstCall = execute.mock.calls[0]?.[0] as { raw: string } | undefined
    expect(firstCall?.raw).not.toContain('DROP TABLE')
  })
})
