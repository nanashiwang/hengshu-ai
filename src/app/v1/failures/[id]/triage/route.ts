import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { readJsonBodyWithLimit } from '@/lib/requestBody'
import {
  FAILURE_REVIEWER_ROLES,
  bulkTriageFailureCases,
  normalizeFailureTriageRequest,
} from '@/lib/failureTriage'

const MAX_FAILURE_TRIAGE_BYTES = 30_000

// POST /v1/failures/{id}/triage —— 审核员为失败案例写入人工归因与复验覆盖。
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 })
  if ((user as any).accountStatus === 'banned') return Response.json({ error: '账号已被封禁' }, { status: 403 })
  if (!FAILURE_REVIEWER_ROLES.has(String((user as any).role || ''))) return Response.json({ error: '只有审核员可以归因失败案例' }, { status: 403 })

  const parsed = await readJsonBodyWithLimit(request, MAX_FAILURE_TRIAGE_BYTES, '失败归因请求体过大')
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  const normalized = normalizeFailureTriageRequest({ ...(parsed.value as any), id })
  if (!normalized.ok) return Response.json({ error: normalized.reason }, { status: 400 })
  const result = await bulkTriageFailureCases(payload, normalized)
  const row = result.results?.[0]
  if (!row?.ok && row?.error === '失败案例不存在') return Response.json({ error: row.error }, { status: 404 })
  if (!row?.ok) return Response.json({ error: row?.error || '更新失败' }, { status: 400 })

  return Response.json({ ok: true, failure: row.failure })
}
