import type { Payload, PayloadRequest } from 'payload'
import type { ContributionAction } from './constants'

/**
 * 发放/扣减贡献值：创建一条 ContributionLog 并原子更新 user.contributionScore。
 * 始终使用 overrideAccess。
 *
 * ⚠️ 关键：在 Collection Hook 内调用时必须透传 `req`，使嵌套写操作加入父级事务，
 * 否则会与触发本 hook 的父级事务（持有外键行锁）互相等待造成死锁。
 * 在路由处理器等顶层场景可不传 req（各自独立事务）。
 */
export async function awardContribution(
  payload: Payload,
  args: {
    userId: string
    actionType: ContributionAction
    points: number
    relatedSkill?: string
    relatedBounty?: string
    description?: string
    req?: PayloadRequest
  },
): Promise<void> {
  const { userId, actionType, points, req } = args
  if (!userId || !points) return
  const tx = req ? { req } : {}
  try {
    const user = await payload.findByID({
      collection: 'users',
      id: userId,
      overrideAccess: true,
      depth: 0,
      ...tx,
    })
    await payload.update({
      collection: 'users',
      id: userId,
      data: { contributionScore: (user.contributionScore || 0) + points },
      overrideAccess: true,
      ...tx,
    })
    await payload.create({
      collection: 'contribution-logs',
      data: {
        user: userId,
        actionType,
        points,
        relatedSkill: args.relatedSkill,
        relatedBounty: args.relatedBounty,
        description: args.description,
      },
      overrideAccess: true,
      ...tx,
    })
  } catch (e) {
    payload.logger?.error(`awardContribution 失败: ${(e as Error).message}`)
  }
}
