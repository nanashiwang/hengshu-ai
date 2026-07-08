import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { readJsonBodyWithLimit } from '@/lib/requestBody'
import {
  FAILURE_REVIEWER_ROLES,
  bulkTriageFailureCases,
  normalizeFailureTriageRequest,
} from '@/lib/failureTriage'

const MAX_FAILURE_TRIAGE_BYTES = 60_000

// POST /v1/failures/triage —— 审核员批量确认 FailureCase 归因、根因分类与复验覆盖。
export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 })
  if ((user as any).accountStatus === 'banned') return Response.json({ error: '账号已被封禁' }, { status: 403 })
  if (!FAILURE_REVIEWER_ROLES.has(String((user as any).role || ''))) return Response.json({ error: '只有审核员可以批量归因失败案例' }, { status: 403 })

  const parsed = await readJsonBodyWithLimit(request, MAX_FAILURE_TRIAGE_BYTES, '失败批量归因请求体过大')
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  const normalized = normalizeFailureTriageRequest(parsed.value)
  if (!normalized.ok) return Response.json({ error: normalized.reason }, { status: 400 })

  const result = await bulkTriageFailureCases(payload, normalized)
  if (!result.ok && 'reason' in result) return Response.json({ error: result.reason }, { status: 400 })
  return Response.json(result, { status: result.failed ? 207 : 200 })
}
