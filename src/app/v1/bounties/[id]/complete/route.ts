import { getPayload } from 'payload'
import type { PayloadRequest } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { awardContribution } from '@/lib/contribution'
import { notify } from '@/lib/notify'

// POST /v1/bounties/{id}/complete —— 发布人验收，释放冻结术值给接单人
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 })

  const b = await payload.findByID({ collection: 'bounties', id, overrideAccess: true }).catch(() => null)
  if (!b) return Response.json({ error: '悬赏不存在' }, { status: 404 })
  const creatorId = typeof b.creator === 'object' ? (b.creator as any)?.id : b.creator
  if (creatorId !== user.id && user.role !== 'admin') {
    return Response.json({ error: '只有发布人可验收' }, { status: 403 })
  }
  if (b.status !== 'submitted') return Response.json({ error: '当前状态不可验收' }, { status: 400 })

  const acceptedById = typeof b.acceptedBy === 'object' ? (b.acceptedBy as any)?.id : b.acceptedBy
  const frozen = b.frozenPoints || 0

  // 原子结算：状态变更 + 释放术值绑进同一事务，任一步失败整体回滚（杜绝“状态已完成但术值没到账”）
  const transactionID = await payload.db.beginTransaction()
  const txReq: Partial<PayloadRequest> | undefined = transactionID ? { transactionID } : undefined
  try {
    await payload.update({ collection: 'bounties', id, data: { status: 'completed' }, overrideAccess: true, req: txReq })

    if (frozen > 0 && acceptedById) {
      // 释放冻结术值（无 'bounty' 规则 → 走传入 points 的可变金额）
      await awardContribution(payload, {
        userId: acceptedById,
        actionType: 'bounty',
        points: frozen,
        relatedBounty: id,
        description: `完成悬赏「${b.title}」奖励`,
        req: txReq,
        throwOnError: true,
      })
    }

    if (transactionID) await payload.db.commitTransaction(transactionID)
  } catch (e) {
    if (transactionID) await payload.db.rollbackTransaction(transactionID)
    payload.logger?.error(`bounty complete 结算失败: ${(e as Error).message}`)
    return Response.json({ error: '验收结算失败，请重试' }, { status: 500 })
  }

  // 提交后通知接单人赏金到账（在事务外，通知失败不影响已完成的结算）
  if (acceptedById) {
    await notify(payload, {
      userId: acceptedById,
      type: 'bounty_completed',
      title: `悬赏「${b.title}」已验收，${frozen} 术值赏金到账`,
      link: `/bounties/${id}`,
      relatedBounty: id,
      actorId: user.id as string,
    })
  }

  return Response.json({ ok: true, released: frozen })
}
