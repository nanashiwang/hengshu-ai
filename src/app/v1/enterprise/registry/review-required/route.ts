import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import {
  bulkReviewEnterpriseRegistryReapproval,
  listEnterpriseRegistriesForReapproval,
} from '@/lib/enterprise'
import {
  MAX_ENTERPRISE_REQUEST_BYTES,
  readEnterpriseOptionalQuery,
  readEnterpriseQueryId,
  validateEnterpriseText,
} from '@/lib/enterpriseRequest'
import { readJsonBodyWithLimit } from '@/lib/requestBody'
import { boundedIntParam } from '@/lib/queryParams'

// GET /v1/enterprise/registry/review-required?organizationId=... —— 批量列出需要企业准入重审的 Registry。
export async function GET(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 })
  if ((user as any).accountStatus === 'banned') return Response.json({ error: '账号已被封禁' }, { status: 403 })

  const url = new URL(request.url)
  const organizationId = readEnterpriseQueryId(url.searchParams)
  if (typeof organizationId !== 'string') return Response.json({ error: organizationId.error }, { status: organizationId.status })
  const status = readEnterpriseOptionalQuery(url.searchParams, 'status')
  if (typeof status !== 'string') return Response.json({ error: status.error }, { status: status.status })
  const registryStatus = readEnterpriseOptionalQuery(url.searchParams, 'registryStatus')
  if (typeof registryStatus !== 'string') return Response.json({ error: registryStatus.error }, { status: registryStatus.status })
  const limit = boundedIntParam(url.searchParams, 'limit', 100, 1, 200)

  const result = await listEnterpriseRegistriesForReapproval(payload, {
    actorId: user.id as string,
    actorRole: (user as any).role,
    organizationId,
    status: status || undefined,
    registryStatus: registryStatus || undefined,
    includeUnchanged: url.searchParams.get('includeUnchanged') === '1',
    limit,
  })
  if (!result.ok) return Response.json({ error: result.reason }, { status: 403 })
  return Response.json(result)
}

// POST /v1/enterprise/registry/review-required —— 批量刷新基线、接受风险或标记已复核。
export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 })
  if ((user as any).accountStatus === 'banned') return Response.json({ error: '账号已被封禁' }, { status: 403 })

  const parsed = await readJsonBodyWithLimit(request, MAX_ENTERPRISE_REQUEST_BYTES, '企业准入重审请求体过大')
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.value
  if (!body || typeof body !== 'object' || Array.isArray(body)) return Response.json({ error: '请求体必须是 JSON 对象' }, { status: 400 })
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId.trim() : ''
  if (!organizationId) return Response.json({ error: '缺少 organizationId' }, { status: 400 })
  if (!Array.isArray(body.registryIds) || body.registryIds.length === 0) return Response.json({ error: '缺少 registryIds' }, { status: 400 })
  if (body.registryIds.length > 100) return Response.json({ error: 'registryIds 最多 100 个' }, { status: 413 })
  const noteCheck = validateEnterpriseText(body.note, 'note')
  if (!noteCheck.ok) return Response.json({ error: noteCheck.error }, { status: noteCheck.status })

  const result = await bulkReviewEnterpriseRegistryReapproval(payload, {
    actorId: user.id as string,
    actorRole: (user as any).role,
    organizationId,
    registryIds: body.registryIds,
    action: body.action,
    note: typeof body.note === 'string' ? body.note : undefined,
  })
  if (!result.ok) return Response.json({ error: result.reason }, { status: 403 })
  return Response.json(result)
}
