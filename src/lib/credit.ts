import type { Payload, PayloadRequest } from 'payload'
import type { CreditTxType } from './constants'
import { acquireUserLedgerLock } from './dbLocks'

// 元 → credit 换算（1 credit = ¥0.01）。cost.ts 的 estimateCost 以人民币元计，
// 台账以 credit 计——换算只在此一处定义，防止"元/分"单位错位（放大 100 倍事故）。
export function creditsFromYuan(yuan: number): number {
  return Math.round((yuan || 0) * 100 * 100) / 100 // credit 保留 2 位小数
}

export interface ApplyCreditResult {
  ok: boolean
  balance?: number
  skipped?: boolean // 幂等命中：此交易此前已应用
  error?: string
}

export function normalizeCreditAmount(amount: number): number {
  return Math.round(amount * 100) / 100
}

export function validateCreditTxAmount(type: CreditTxType, amount: number): string | null {
  if (!Number.isFinite(amount) || amount === 0) return 'credit 流水 amount 必须是非 0 有限数字'
  if (Math.abs(normalizeCreditAmount(amount) - amount) > 1e-9) {
    return 'credit 流水 amount 最多保留 2 位小数，避免余额快照与流水求和不一致'
  }
  if (type === 'consume' && amount >= 0) return 'consume 流水必须为负数，禁止把模型消费记成入账'
  if (['recharge', 'exchange', 'refund'].includes(type) && amount <= 0) {
    return `${type} 流水必须为正数，禁止把入账记成扣费`
  }
  return null
}

/**
 * 变更用户 credit 余额并记一条台账流水，保证不变量 creditBalance == SUM(credit-logs.amount)。
 *
 * - amount 带符号：充值/兑换/退款为正，消耗为负；
 * - 原子：update(user.creditBalance) + create(credit-log) 同事务（无外部 req 时自开事务）；
 * - 幂等：传 idempotencyKey 时先查重命中即跳过；唯一索引为并发/重试的硬后备；
 * - 防透支：默认不允许余额变负（消耗超额 → 失败），除非 allowNegativeBalance。
 *
 * ⚠️ 在 Collection Hook 内调用须透传 req（共享父事务，避免死锁）。
 */
export async function applyCredit(
  payload: Payload,
  args: {
    userId: string
    type: CreditTxType
    amount: number
    description?: string
    idempotencyKey?: string
    allowNegativeBalance?: boolean
    req?: Partial<PayloadRequest>
    throwOnError?: boolean
  },
): Promise<ApplyCreditResult> {
  const { userId, type, amount, idempotencyKey, req } = args
  if (!userId) return { ok: false, error: '参数缺失' }
  const amountError = validateCreditTxAmount(type, amount)
  if (amountError) {
    if (args.throwOnError) throw new Error(amountError)
    return { ok: false, error: amountError }
  }
  const normalizedAmount = normalizeCreditAmount(amount)

  let ownTxId: number | string | undefined
  let writeReq = req
  if (!req?.transactionID) {
    ownTxId = (await payload.db.beginTransaction?.()) || undefined
    if (ownTxId) writeReq = { ...(req || {}), transactionID: ownTxId }
  }
  const wtx = writeReq ? { req: writeReq } : {}

  try {
    const txId = writeReq?.transactionID ? await writeReq.transactionID : undefined
    if (txId) {
      await acquireUserLedgerLock(payload, txId, 'credit', userId)
    }

    // 幂等前置查重
    if (idempotencyKey) {
      const dup = await payload.count({
        collection: 'credit-logs',
        where: { idempotencyKey: { equals: idempotencyKey } },
        overrideAccess: true,
        ...wtx,
      })
      if (dup.totalDocs > 0) {
        if (ownTxId) await payload.db.commitTransaction(ownTxId)
        return { ok: true, skipped: true }
      }
    }

    const user = await payload.findByID({
      collection: 'users',
      id: userId,
      overrideAccess: true,
      depth: 0,
      ...wtx,
    })
    const balance = (user as any).creditBalance || 0
    const newBalance = normalizeCreditAmount(balance + normalizedAmount) // credit 精度 2 位（1credit=¥0.01）
    if (newBalance < 0 && !args.allowNegativeBalance) {
      if (ownTxId) await payload.db.rollbackTransaction(ownTxId)
      return { ok: false, error: 'credit 余额不足' }
    }

    await payload.update({
      collection: 'users',
      id: userId,
      data: { creditBalance: newBalance },
      overrideAccess: true,
      ...wtx,
    })
    await payload.create({
      collection: 'credit-logs',
      data: {
        user: userId,
        type,
        amount: normalizedAmount,
        balanceAfter: newBalance,
        idempotencyKey,
        description: args.description,
      },
      overrideAccess: true,
      ...wtx,
    })

    if (ownTxId) await payload.db.commitTransaction(ownTxId)
    return { ok: true, balance: newBalance }
  } catch (e) {
    if (ownTxId) await payload.db.rollbackTransaction(ownTxId)
    if (args.throwOnError) throw e
    payload.logger?.error(`applyCredit 失败: ${(e as Error).message}`)
    return { ok: false, error: (e as Error).message }
  }
}
