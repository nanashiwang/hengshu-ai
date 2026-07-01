import { getPayload } from 'payload'
import type { PayloadRequest } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { awardContribution } from '@/lib/contribution'

// POST /v1/bounties/{id}/cancel —— 发布人取消，退还冻结术值
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 })

  const b = await payload.findByID({ collection: 'bounties', id, overrideAccess: true }).catch(() => null)
  if (!b) return Response.json({ error: '悬赏不存在' }, { status: 404 })
  const creatorId = typeof b.creator === 'object' ? (b.creator as any)?.id : b.creator
  if (creatorId !== user.id && user.role !== 'admin') {
    return Response.json({ error: '只有发布人可取消' }, { status: 403 })
  }
  if (['completed', 'cancelled'].includes(b.status as string)) {
    return Response.json({ error: '当前状态不可取消' }, { status: 400 })
  }

  const frozen = b.frozenPoints || 0

  // 原子结算：状态变更 + 退还术值绑进同一事务，任一步失败整体回滚
  const transactionID = await payload.db.beginTransaction()
  const txReq: Partial<PayloadRequest> | undefined = transactionID ? { transactionID } : undefined
  try {
    await payload.update({ collection: 'bounties', id, data: { status: 'cancelled' }, overrideAccess: true, req: txReq })

    if (frozen > 0 && creatorId) {
      await awardContribution(payload, {
        userId: creatorId,
        actionType: 'other',
        points: frozen,
        relatedBounty: id,
        description: `退还悬赏赏金「${b.title}」`,
        req: txReq,
        throwOnError: true,
      })
    }

    if (transactionID) await payload.db.commitTransaction(transactionID)
  } catch (e) {
    if (transactionID) await payload.db.rollbackTransaction(transactionID)
    payload.logger?.error(`bounty cancel 结算失败: ${(e as Error).message}`)
    return Response.json({ error: '取消结算失败，请重试' }, { status: 500 })
  }

  return Response.json({ ok: true, refunded: frozen })
}
