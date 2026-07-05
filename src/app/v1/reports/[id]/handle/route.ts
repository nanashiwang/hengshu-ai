import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { syncNewApiQuotaToBalance } from '@/lib/newapiQuota'
import { suppressUserCompatReports } from '@/lib/moderation'
import { recordAuditEvent } from '@/lib/audit'

// POST /v1/reports/{id}/handle  { action, note? } —— 审核员/管理员处置举报（封禁闭环）。
// action: dismiss(驳回) | resolve(标记已解决) | ban_target(封禁责任用户) | hide_target(隐藏内容)
const STAFF = ['admin', 'reviewer']

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 })
  if (!STAFF.includes(user.role as string)) return Response.json({ error: '无权处置' }, { status: 403 })

  let body: any = {}
  try {
    body = await request.json()
  } catch {
    /* 容忍空 body */
  }
  const action = String(body.action || '')
  if (!['dismiss', 'resolve', 'ban_target', 'hide_target'].includes(action)) {
    return Response.json({ error: '无效的处置动作' }, { status: 400 })
  }

  const report = await payload.findByID({ collection: 'reports', id, depth: 0, overrideAccess: true }).catch(() => null)
  if (!report) return Response.json({ error: '举报不存在' }, { status: 404 })
  const targetType = (report as any).targetType
  const targetId = (report as any).targetId

  try {
    // 定位责任用户 / 内容
    async function resolveOwnerUserId(): Promise<string | null> {
      if (targetType === 'user') return targetId
      const coll = targetType === 'skill' ? 'skills' : targetType === 'review' ? 'reviews' : targetType === 'bounty' ? 'bounties' : null
      if (!coll) return null
      const doc = await payload.findByID({ collection: coll as any, id: targetId, depth: 0, overrideAccess: true }).catch(() => null)
      if (!doc) return null
      const ownerField = targetType === 'skill' ? 'author' : targetType === 'bounty' ? 'creator' : 'user'
      const ref = (doc as any)[ownerField]
      return typeof ref === 'object' ? ref?.id : ref
    }

    if (action === 'ban_target') {
      const ownerId = await resolveOwnerUserId()
      if (!ownerId) return Response.json({ error: '无法定位责任用户' }, { status: 400 })
      if (String(ownerId) === String(user.id)) return Response.json({ error: '不能封禁自己' }, { status: 400 })
      await payload.update({ collection: 'users', id: ownerId, data: { accountStatus: 'banned' }, overrideAccess: true })
      await recordAuditEvent(payload, {
        event: 'user_banned',
        actorId: user.id as string,
        targetUserId: String(ownerId),
        targetType,
        targetId,
        summary: '举报处置封禁责任用户',
        metadata: { reportId: id, action, note: body.note },
        request,
      })
      syncNewApiQuotaToBalance(payload, String(ownerId)).catch((e) =>
        payload.logger?.error(`封禁后网关配额归零失败: ${(e as Error).message}`),
      )
      // 追溯降权：抑制该用户历史 online + Runner 兼容报告，权重归 0 不再影响 LocalScore/榜。
      try {
        await suppressUserCompatReports(payload, String(ownerId))
      } catch (e) {
        payload.logger?.error(`抑制被封用户报告失败: ${(e as Error).message}`)
      }
    } else if (action === 'hide_target') {
      if (targetType === 'skill') {
        await payload.update({ collection: 'skills', id: targetId, data: { status: 'archived' }, overrideAccess: true }).catch(() => null)
      } else if (targetType === 'review') {
        await payload.update({ collection: 'reviews', id: targetId, data: { status: 'hidden' }, overrideAccess: true }).catch(() => null)
      } else {
        return Response.json({ error: '该对象类型不支持隐藏' }, { status: 400 })
      }
    }

    const newStatus = action === 'dismiss' ? 'dismissed' : 'resolved'
    await payload.update({
      collection: 'reports',
      id,
      data: { status: newStatus, handledBy: user.id, detail: body.note ? `${(report as any).detail || ''}\n[处置] ${body.note}`.slice(0, 2000) : (report as any).detail },
      overrideAccess: true,
    })
    if (action !== 'ban_target') {
      await recordAuditEvent(payload, {
        event: 'report_handled',
        actorId: user.id as string,
        targetType,
        targetId,
        summary: `举报处置：${action}`,
        metadata: { reportId: id, action, status: newStatus, note: body.note },
        request,
      })
    }
    return Response.json({ ok: true, status: newStatus })
  } catch (e) {
    payload.logger?.error(`处置举报失败: ${(e as Error).message}`)
    return Response.json({ error: '处置失败，请重试' }, { status: 500 })
  }
}
