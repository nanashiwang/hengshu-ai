import { getPayload } from 'payload'
import config from '@payload-config'
import { runnerFromBearer } from '@/lib/runnerAuth'
import { newRunnerTokenUpdate } from '@/lib/runnerManage'
import { recordAuditEvent } from '@/lib/audit'

// POST /v1/runner/rotate —— Runner 用当前 Bearer 自助轮换令牌。
// 新令牌只在本响应返回一次；服务端仅保存 hash，旧令牌立即失效。
export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const actor = await runnerFromBearer(payload, request)
  if (!actor) return Response.json({ error: '未登录或令牌无效' }, { status: 401 })

  const next = newRunnerTokenUpdate()
  await payload.update({
    collection: 'runner-clients',
    id: actor.runner.id,
    data: next.data,
    overrideAccess: true,
  })
  await recordAuditEvent(payload, {
    event: 'runner_token_rotated',
    actorId: actor.user.id,
    targetUserId: actor.user.id,
    targetType: 'runner-client',
    targetId: actor.runner.id,
    summary: 'Runner 自助轮换令牌',
    metadata: { runnerId: actor.runner.runnerId },
    request,
  })

  return Response.json({ ok: true, access_token: next.accessToken, runner_id: actor.runner.runnerId })
}
