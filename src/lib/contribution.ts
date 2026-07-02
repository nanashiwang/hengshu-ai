import type { Payload, PayloadRequest } from 'payload'
import type { ContributionAction } from './constants'

// 结算类行为：金额由调用方权威给定（冻结 -frozenPoints / 发奖 +frozen / 退款 +frozen），
// 必须绕过规则表——否则管理员一旦为这些 action 建规，basePoints 会覆盖金额甚至反转符号（造成双花/凭空造分），
// 或 dailyLimit/selfActionExcluded 会误阻断真实结算（钱冻了却发不出）。
const SETTLEMENT_ACTIONS = new Set<ContributionAction>(['bounty', 'consume', 'other'])

/**
 * 发放术值：以 ContributionRules 为准取分值，并做反作弊前置校验。
 *
 * 规则优先级（非结算类）：
 *  1. 查 actionType 对应规则；规则 enabled=false → 不发；
 *  2. selfActionExcluded 且 actorId===userId → 不发（防自操作刷分）；
 *  3. 取分值：有规则用 rule.basePoints，否则回退传入 points（向后兼容）；
 *  4. dailyLimit>0：当日该 actionType 发放次数达上限 → 不发；
 * 结算类（bounty/consume/other）：直接用调用方 points，绕过全部规则门槛。
 *  5. 原子写入：update(user.contributionScore) + create(ContributionLog) 同事务，保证
 *     不变量 contributionScore == SUM(logs.points)（无外部 req 时自开事务）。
 *
 * ⚠️ 在 Collection Hook 内调用须透传 req（共享父事务，避免死锁）。
 */
export async function awardContribution(
  payload: Payload,
  args: {
    userId: string
    actionType: ContributionAction
    points?: number // 回退值（无规则时使用）；结算类为权威金额
    actorId?: string // 触发者（用于自操作排除）
    relatedSkill?: string
    relatedBounty?: string
    description?: string
    idempotencyKey?: string // 一次性奖励去重（如 fav:<actor>:<skill>）：命中则跳过
    req?: Partial<PayloadRequest>
    throwOnError?: boolean // 结算类调用：内部出错时抛出而非静默吞，供上层事务回滚
  },
): Promise<void> {
  const { userId, actionType, actorId, req } = args
  if (!userId) return
  const tx = req ? { req } : {}
  const isSettlement = SETTLEMENT_ACTIONS.has(actionType)

  // ── 阶段一：确定金额与门槛（结算类绕过规则表）──
  let points: number | undefined
  try {
    // 幂等：一次性奖励去重（命中则不再发放；唯一索引为并发/重放硬后备）
    if (args.idempotencyKey) {
      const dup = await payload.count({
        collection: 'contribution-logs',
        where: { idempotencyKey: { equals: args.idempotencyKey } },
        overrideAccess: true,
        ...tx,
      })
      if (dup.totalDocs > 0) return
    }
    if (isSettlement) {
      points = args.points
    } else {
      const ruleRes = await payload.find({
        collection: 'contribution-rules',
        where: { actionType: { equals: actionType } },
        limit: 1,
        overrideAccess: true,
        ...tx,
      })
      const rule = ruleRes.docs[0] as any

      if (rule && rule.enabled === false) return
      if (rule?.selfActionExcluded && actorId && actorId === userId) return

      points = rule ? rule.basePoints : args.points
      if (!points) return

      if (rule?.dailyLimit && rule.dailyLimit > 0) {
        const start = new Date()
        start.setHours(0, 0, 0, 0)
        const todays = await payload.count({
          collection: 'contribution-logs',
          where: {
            and: [
              { user: { equals: userId } },
              { actionType: { equals: actionType } },
              { createdAt: { greater_than_equal: start.toISOString() } },
            ],
          },
          overrideAccess: true,
          ...tx,
        })
        if (todays.totalDocs >= rule.dailyLimit) return
      }
    }
  } catch (e) {
    if (args.throwOnError) throw e
    payload.logger?.error(`awardContribution 规则判定失败: ${(e as Error).message}`)
    return
  }
  if (!points) return

  // ── 阶段二：原子写入 update+create（无外部 req 时自开事务，防"改了分没记流水"破坏不变量）──
  let ownTxId: number | string | undefined
  let writeReq = req
  if (!req) {
    ownTxId = (await payload.db.beginTransaction?.()) || undefined
    if (ownTxId) writeReq = { transactionID: ownTxId }
  }
  const wtx = writeReq ? { req: writeReq } : {}

  try {
    const user = await payload.findByID({
      collection: 'users',
      id: userId,
      overrideAccess: true,
      depth: 0,
      ...wtx,
    })
    const newScore = (user.contributionScore || 0) + points
    // 防透支：术值余额不可为负（与 applyCredit 对称的纵深防御；结算类扣分若超额则回滚）
    if (newScore < 0) {
      if (ownTxId) await payload.db.rollbackTransaction(ownTxId)
      if (args.throwOnError) throw new Error('术值余额不足')
      payload.logger?.error(`awardContribution 拒绝：术值不足 user=${userId} 需 ${-points}`)
      return
    }
    await payload.update({
      collection: 'users',
      id: userId,
      data: { contributionScore: newScore },
      overrideAccess: true,
      ...wtx,
    })
    await payload.create({
      collection: 'contribution-logs',
      data: {
        user: userId,
        actionType,
        points,
        actor: actorId,
        idempotencyKey: args.idempotencyKey,
        relatedSkill: args.relatedSkill,
        relatedBounty: args.relatedBounty,
        description: args.description,
      },
      overrideAccess: true,
      ...wtx,
    })
    if (ownTxId) await payload.db.commitTransaction(ownTxId)
  } catch (e) {
    // 自开事务：回滚，避免“状态已改、术值未发”或“改了分没记流水”的不一致
    if (ownTxId) await payload.db.rollbackTransaction(ownTxId)
    if (args.throwOnError) throw e
    payload.logger?.error(`awardContribution 写入失败: ${(e as Error).message}`)
  }
}
