import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { decryptSecret } from '@/lib/secrets'
import { recordAuditEvent } from '@/lib/audit'
import { normalizeBulkPrivateRerunRequest, publicBulkRerunItem, rerunPrivateLedgerRun } from '@/lib/privateRunRerun'
import { readJsonBodyWithLimit } from '@/lib/requestBody'
import { MAX_SKILL_RUN_REQUEST_BYTES } from '@/lib/skillRunRequest'

// POST /v1/runs/rerun —— 私人台账批量换模型重跑；只返回脱敏结果摘要，不回显输入/输出。
export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 })
  if ((user as any).accountStatus === 'banned') return Response.json({ error: '账号已被封禁' }, { status: 403 })

  const parsed = await readJsonBodyWithLimit(request, MAX_SKILL_RUN_REQUEST_BYTES, '批量重跑请求体过大')
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  const normalized = normalizeBulkPrivateRerunRequest(parsed.value)
  if (!normalized.ok) return Response.json({ error: normalized.error }, { status: normalized.status })

  const fullUser = await payload
    .findByID({ collection: 'users', id: user.id, overrideAccess: true, depth: 0 })
    .catch(() => null)
  const userApiKey = decryptSecret((fullUser as any)?.newapiKeyEncrypted) || undefined

  const results = []
  for (const id of normalized.ids) {
    const rerun = await rerunPrivateLedgerRun(payload, {
      user: user as any,
      sourceRunId: id,
      model: normalized.model,
      modelProvider: normalized.modelProvider,
      modelVersion: normalized.modelVersion,
      userApiKey,
    })
    results.push(publicBulkRerunItem(id, rerun))
  }

  const succeeded = results.filter((item) => item.ok).length
  const failed = results.length - succeeded
  await recordAuditEvent(payload, {
    event: 'private_run_ledger_bulk_rerun',
    actorId: user.id as string,
    targetUserId: user.id as string,
    targetType: 'user',
    targetId: user.id as string,
    summary: `用户批量重跑私人台账：成功 ${succeeded} / 失败 ${failed}`,
    metadata: {
      requested: normalized.ids.length,
      succeeded,
      failed,
      model: normalized.model,
      modelVersion: normalized.modelVersion,
    },
    request,
  })

  return Response.json({
    ok: failed === 0,
    requested: normalized.ids.length,
    succeeded,
    failed,
    model: normalized.model,
    modelVersion: normalized.modelVersion,
    results,
    privacy: {
      inputOutputReturned: false,
      note: '批量重跑复用本人历史输入，但响应只返回运行摘要；如需原文请在私人台账单独 includeIO 导出。',
    },
  }, { status: failed ? 207 : 200 })
}
