import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { canRevokeRunner } from '@/lib/runnerManage'
import { recordAuditEvent } from '@/lib/audit'

// POST /v1/runners/{id}/revoke —— 用户撤销自己的 Runner；审核/管理员可代处理。
// 删除 Runner 会触发 RunnerClients.beforeDelete，解除安装/报告/设备码引用，使旧 Bearer 立即失效。
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 })
  if ((user as any).accountStatus === 'banned') return Response.json({ error: '账号已被封禁' }, { status: 403 })

  const runner = await payload
    .findByID({ collection: 'runner-clients', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!runner) return Response.json({ error: 'Runner 不存在或已撤销' }, { status: 404 })
  if (!canRevokeRunner(user, runner)) return Response.json({ error: '只能撤销自己的 Runner' }, { status: 403 })

  try {
    const runnerUserId = typeof (runner as any).user === 'object' ? (runner as any).user?.id : (runner as any).user
    await payload.delete({ collection: 'runner-clients', id, overrideAccess: true })
    await recordAuditEvent(payload, {
      event: 'runner_revoked',
      actorId: user.id as string,
      targetUserId: runnerUserId ? String(runnerUserId) : undefined,
      targetType: 'runner-client',
      targetId: id,
      summary: 'Runner 被撤销，旧 Bearer 立即失效',
      metadata: { runnerId: (runner as any).runnerId, trustedLevel: (runner as any).trustedLevel },
      request,
    })
    return Response.json({ ok: true })
  } catch (e) {
    payload.logger?.error(`撤销 Runner 失败 runner=${id}: ${(e as Error).message}`)
    return Response.json({ error: '撤销失败，请重试' }, { status: 500 })
  }
}
