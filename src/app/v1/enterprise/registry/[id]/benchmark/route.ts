import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { enterprisePrivateBenchmark, normalizeEnterpriseBenchmarkRequest } from '@/lib/enterpriseBenchmark'
import { readJsonBodyWithLimit } from '@/lib/requestBody'

const MAX_ENTERPRISE_BENCHMARK_BYTES = 100_000

// POST /v1/enterprise/registry/{id}/benchmark —— 企业管理员/审批员组织内私有评测，不进入公开榜或公开 Passport。
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 })
  if ((user as any).accountStatus === 'banned') return Response.json({ error: '账号已被封禁' }, { status: 403 })

  const parsed = await readJsonBodyWithLimit(request, MAX_ENTERPRISE_BENCHMARK_BYTES, '企业私有评测请求体过大', {
    emptyValue: {},
  })
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  const normalized = normalizeEnterpriseBenchmarkRequest(parsed.value)
  if (!normalized.ok) return Response.json({ error: normalized.reason }, { status: 400 })

  const result = await enterprisePrivateBenchmark(payload, {
    actorId: user.id as string,
    actorRole: (user as any).role,
    registryId: id,
    models: normalized.models,
    cases: normalized.cases,
    maxAttempts: normalized.maxAttempts,
  })
  if (!result.ok) return Response.json({ error: result.reason }, { status: 403 })
  return Response.json(result)
}
