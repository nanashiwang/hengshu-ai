import { describe, expect, it, vi } from 'vitest'
import { applyCredit, normalizeCreditAmount, validateCreditTxAmount } from '@/lib/credit'
import { awardContribution } from '@/lib/contribution'
import { LEDGER_LOCK_NAMESPACES } from '@/lib/dbLocks'

type LedgerState = {
  users: Record<string, { id: string; creditBalance: number; contributionScore: number }>
  creditLogs: any[]
  contributionLogs: any[]
}

function ledgerPayload(seed: Partial<LedgerState> = {}) {
  const state: LedgerState = {
    users: {
      u1: { id: 'u1', creditBalance: 0, contributionScore: 0 },
      ...(seed.users || {}),
    },
    creditLogs: seed.creditLogs || [],
    contributionLogs: seed.contributionLogs || [],
  }
  let txSeq = 0
  const payload: any = {
    db: {
      sessions: {} as Record<string, any>,
      beginTransaction: vi.fn(async () => {
        const id = `tx${++txSeq}`
        payload.db.sessions[id] = { db: { id } }
        return id
      }),
      commitTransaction: vi.fn(async (_id: string) => undefined),
      rollbackTransaction: vi.fn(async (_id: string) => undefined),
      execute: vi.fn(async (_arg: any) => undefined),
    },
    logger: { error: vi.fn() },
    count: vi.fn(async ({ collection, where }: any) => {
      const key = where?.idempotencyKey?.equals
      const list = collection === 'credit-logs' ? state.creditLogs : state.contributionLogs
      return { totalDocs: key ? list.filter((log) => log.idempotencyKey === key).length : 0 }
    }),
    findByID: vi.fn(async ({ collection, id }: any) => {
      if (collection !== 'users' || !state.users[id]) throw new Error('not found')
      return state.users[id]
    }),
    update: vi.fn(async ({ collection, id, data }: any) => {
      if (collection !== 'users' || !state.users[id]) throw new Error('not found')
      Object.assign(state.users[id], data)
      return state.users[id]
    }),
    create: vi.fn(async ({ collection, data }: any) => {
      const doc = { id: `${collection}-${Date.now()}`, ...data }
      if (collection === 'credit-logs') state.creditLogs.push(doc)
      if (collection === 'contribution-logs') state.contributionLogs.push(doc)
      return doc
    }),
    find: vi.fn(async () => ({ docs: [] })),
  }
  return { payload, state }
}

describe('ledger atomicity — credit and contribution invariants', () => {
  it('validateCreditTxAmount locks money-flow signs before ledger writes', () => {
    expect(normalizeCreditAmount(1.235)).toBe(1.24)
    expect(validateCreditTxAmount('consume', -1)).toBeNull()
    expect(validateCreditTxAmount('recharge', 1)).toBeNull()
    expect(validateCreditTxAmount('exchange', 1)).toBeNull()
    expect(validateCreditTxAmount('refund', 1)).toBeNull()
    expect(validateCreditTxAmount('adjust', -1)).toBeNull()
    expect(validateCreditTxAmount('adjust', 1)).toBeNull()
    expect(validateCreditTxAmount('consume', 1)).toContain('consume 流水必须为负数')
    expect(validateCreditTxAmount('recharge', -1)).toContain('recharge 流水必须为正数')
    expect(validateCreditTxAmount('exchange', 0)).toContain('非 0 有限数字')
    expect(validateCreditTxAmount('adjust', 0.001)).toContain('最多保留 2 位小数')
  })

  it('applyCredit writes balance and log in one locked transaction', async () => {
    const { payload, state } = ledgerPayload({
      users: { u1: { id: 'u1', creditBalance: 10, contributionScore: 0 } },
    })

    const result = await applyCredit(payload, {
      userId: 'u1',
      type: 'recharge',
      amount: 5,
      idempotencyKey: 'recharge:u1:one',
    })

    expect(result).toMatchObject({ ok: true, balance: 15 })
    expect(state.users.u1.creditBalance).toBe(15)
    expect(state.creditLogs).toMatchObject([{ amount: 5, balanceAfter: 15, idempotencyKey: 'recharge:u1:one' }])
    expect(payload.db.execute).toHaveBeenCalledWith({
      db: { id: 'tx1' },
      raw: expect.stringMatching(
        new RegExp(`^SELECT pg_advisory_xact_lock\\(${LEDGER_LOCK_NAMESPACES.credit}, \\d+\\)$`),
      ),
    })
    expect(payload.db.commitTransaction).toHaveBeenCalledWith('tx1')
  })

  it('applyCredit duplicate idempotency key commits without a second balance mutation', async () => {
    const { payload, state } = ledgerPayload({
      users: { u1: { id: 'u1', creditBalance: 10, contributionScore: 0 } },
      creditLogs: [{ idempotencyKey: 'same' }],
    })

    const result = await applyCredit(payload, {
      userId: 'u1',
      type: 'recharge',
      amount: 5,
      idempotencyKey: 'same',
    })

    expect(result).toMatchObject({ ok: true, skipped: true })
    expect(state.users.u1.creditBalance).toBe(10)
    expect(state.creditLogs).toHaveLength(1)
    expect(payload.update).not.toHaveBeenCalled()
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.db.commitTransaction).toHaveBeenCalledWith('tx1')
  })

  it('applyCredit rolls back instead of creating a negative balance', async () => {
    const { payload, state } = ledgerPayload({
      users: { u1: { id: 'u1', creditBalance: 3, contributionScore: 0 } },
    })

    const result = await applyCredit(payload, {
      userId: 'u1',
      type: 'consume',
      amount: -5,
      idempotencyKey: 'run:one',
    })

    expect(result).toMatchObject({ ok: false, error: 'credit 余额不足' })
    expect(state.users.u1.creditBalance).toBe(3)
    expect(state.creditLogs).toHaveLength(0)
    expect(payload.db.rollbackTransaction).toHaveBeenCalledWith('tx1')
  })

  it('applyCredit rejects invalid transaction signs before opening a transaction', async () => {
    const { payload, state } = ledgerPayload({
      users: { u1: { id: 'u1', creditBalance: 10, contributionScore: 0 } },
    })

    const consumePositive = await applyCredit(payload, {
      userId: 'u1',
      type: 'consume',
      amount: 5,
      idempotencyKey: 'run:wrong-sign',
    })
    const rechargeNegative = await applyCredit(payload, {
      userId: 'u1',
      type: 'recharge',
      amount: -5,
      idempotencyKey: 'recharge:wrong-sign',
    })

    expect(consumePositive).toMatchObject({ ok: false, error: expect.stringContaining('consume 流水必须为负数') })
    expect(rechargeNegative).toMatchObject({ ok: false, error: expect.stringContaining('recharge 流水必须为正数') })
    expect(state.users.u1.creditBalance).toBe(10)
    expect(state.creditLogs).toHaveLength(0)
    expect(payload.db.beginTransaction).not.toHaveBeenCalled()
  })

  it('applyCredit rejects sub-cent credit amounts to keep balance equal to log sum', async () => {
    const { payload, state } = ledgerPayload({
      users: { u1: { id: 'u1', creditBalance: 10, contributionScore: 0 } },
    })

    const result = await applyCredit(payload, {
      userId: 'u1',
      type: 'adjust',
      amount: 0.001,
      idempotencyKey: 'adjust:sub-cent',
    })

    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('最多保留 2 位小数') })
    expect(state.users.u1.creditBalance).toBe(10)
    expect(state.creditLogs).toHaveLength(0)
    expect(payload.db.beginTransaction).not.toHaveBeenCalled()
  })

  it('applyCredit throws invalid transaction signs when caller requires exceptions', async () => {
    const { payload } = ledgerPayload()
    await expect(
      applyCredit(payload, {
        userId: 'u1',
        type: 'exchange',
        amount: -1,
        throwOnError: true,
      }),
    ).rejects.toThrow('exchange 流水必须为正数')
    expect(payload.db.beginTransaction).not.toHaveBeenCalled()
  })

  it('awardContribution settlement writes score and log in one locked transaction', async () => {
    const { payload, state } = ledgerPayload({
      users: { u1: { id: 'u1', creditBalance: 0, contributionScore: 10 } },
    })

    await awardContribution(payload, {
      userId: 'u1',
      actionType: 'consume',
      points: -4,
      idempotencyKey: 'exchange:u1:one:points',
      throwOnError: true,
    })

    expect(state.users.u1.contributionScore).toBe(6)
    expect(state.contributionLogs).toMatchObject([
      { actionType: 'consume', points: -4, idempotencyKey: 'exchange:u1:one:points' },
    ])
    expect(payload.db.execute).toHaveBeenCalledWith({
      db: { id: 'tx1' },
      raw: expect.stringMatching(
        new RegExp(`^SELECT pg_advisory_xact_lock\\(${LEDGER_LOCK_NAMESPACES.contribution}, \\d+\\)$`),
      ),
    })
    expect(payload.db.commitTransaction).toHaveBeenCalledWith('tx1')
  })

  it('awardContribution rolls back when settlement would make points negative', async () => {
    const { payload, state } = ledgerPayload({
      users: { u1: { id: 'u1', creditBalance: 0, contributionScore: 2 } },
    })

    await expect(
      awardContribution(payload, {
        userId: 'u1',
        actionType: 'consume',
        points: -3,
        idempotencyKey: 'exchange:u1:two:points',
        throwOnError: true,
      }),
    ).rejects.toThrow('贡献值余额不足')

    expect(state.users.u1.contributionScore).toBe(2)
    expect(state.contributionLogs).toHaveLength(0)
    expect(payload.db.rollbackTransaction).toHaveBeenCalledWith('tx1')
  })
})
