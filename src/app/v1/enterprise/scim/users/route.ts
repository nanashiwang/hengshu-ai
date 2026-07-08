import { getPayload } from 'payload'
import config from '@payload-config'
import {
  deprovisionEnterpriseScimMember,
  findEnterpriseScimMember,
  enterpriseScimListResponse,
  enterpriseScimUserResource,
  listEnterpriseScimMembers,
  normalizeEnterpriseScimUserInput,
  parseEnterpriseScimUserFilter,
  provisionEnterpriseScimMember,
} from '@/lib/enterprise'
import {
  MAX_ENTERPRISE_EMAIL_LENGTH,
  MAX_ENTERPRISE_SCIM_FILTER_LENGTH,
  MAX_ENTERPRISE_SCIM_REQUEST_BYTES,
  readEnterpriseOptionalQuery,
  readEnterpriseQueryId,
  requireEnterpriseIds,
} from '@/lib/enterpriseRequest'
import { readJsonBodyWithLimit } from '@/lib/requestBody'
import { boundedIntParam } from '@/lib/queryParams'

function scimEmailFromUrl(request: Request) {
  const url = new URL(request.url)
  const organizationId = readEnterpriseQueryId(url.searchParams, 'organizationId')
  const email = readEnterpriseOptionalQuery(url.searchParams, 'email', MAX_ENTERPRISE_EMAIL_LENGTH)
  const userName = readEnterpriseOptionalQuery(url.searchParams, 'userName', MAX_ENTERPRISE_EMAIL_LENGTH)
  return {
    organizationId,
    email: typeof email === 'string' && email ? email : userName,
  }
}

// POST /v1/enterprise/scim/users —— 最小 SCIM provision 入口：按 email 创建/绑定用户并维护组织成员。
export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const parsed = await readJsonBodyWithLimit(request, MAX_ENTERPRISE_SCIM_REQUEST_BYTES, 'SCIM 请求体过大')
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.value

  const ids = requireEnterpriseIds(body, ['organizationId'])
  if (!ids.ok) return Response.json({ error: ids.error }, { status: ids.status })
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId.trim() : ''
  const input = normalizeEnterpriseScimUserInput(body)
  const email = input.email
  if (!organizationId || !email) return Response.json({ error: '缺少 organizationId 或 email/userName' }, { status: 400 })

  const result = await provisionEnterpriseScimMember(payload, {
    organizationId,
    bearerToken: request.headers.get('authorization'),
    email,
    username: input.username,
    role: input.role,
    active: input.active,
  })
  if (!result.ok) return Response.json({ error: result.reason }, { status: 403 })

  return Response.json({
    ok: true,
    ...enterpriseScimUserResource(result.user, result.member),
    createdUser: result.createdUser,
    createdMember: result.createdMember,
  })
}

// PATCH /v1/enterprise/scim/users —— 兼容 SCIM PATCH/PUT 风格：按 active 决定启用/停用。
export async function PATCH(request: Request) {
  return POST(request)
}

export async function PUT(request: Request) {
  return POST(request)
}

// GET /v1/enterprise/scim/users?organizationId=...&email=... —— 查询用户；无 email 时返回 SCIM ListResponse。
export async function GET(request: Request) {
  const payload = await getPayload({ config })
  const url = new URL(request.url)
  const { organizationId, email } = scimEmailFromUrl(request)
  if (typeof organizationId !== 'string') return Response.json({ error: organizationId.error }, { status: organizationId.status })
  if (typeof email !== 'string') return Response.json({ error: email.error }, { status: email.status })
  const filterText = readEnterpriseOptionalQuery(url.searchParams, 'filter', MAX_ENTERPRISE_SCIM_FILTER_LENGTH)
  if (typeof filterText !== 'string') return Response.json({ error: filterText.error }, { status: filterText.status })
  const filter = parseEnterpriseScimUserFilter(filterText || null)
  if (filter.unsupported) return Response.json({ error: `暂不支持的 SCIM filter: ${filter.unsupported}` }, { status: 400 })
  const lookupEmail = email || filter.email || ''

  if (!lookupEmail) {
    const result = await listEnterpriseScimMembers(payload, {
      organizationId,
      bearerToken: request.headers.get('authorization'),
      startIndex: boundedIntParam(url.searchParams, 'startIndex', 1, 1, 100_000),
      count: boundedIntParam(url.searchParams, 'count', 50, 1, 200),
    })
    if (!result.ok) return Response.json({ error: result.reason }, { status: 403 })
    return Response.json(enterpriseScimListResponse(result.resources, result.totalResults, result.startIndex, result.itemsPerPage))
  }

  const result = await findEnterpriseScimMember(payload, {
    organizationId,
    bearerToken: request.headers.get('authorization'),
    email: lookupEmail,
  })
  if (!result.ok) return Response.json({ error: result.reason }, { status: 403 })
  if (filter.email) {
    const resources = result.user ? [enterpriseScimUserResource(result.user, result.member)] : []
    return Response.json(enterpriseScimListResponse(resources, resources.length, 1, resources.length))
  }
  if (!result.user) return Response.json({ ok: true, found: false })

  return Response.json({
    ok: true,
    found: true,
    ...enterpriseScimUserResource(result.user, result.member),
  })
}

// DELETE /v1/enterprise/scim/users?organizationId=...&email=... —— 停用组织成员，保留用户和成员审计痕迹。
export async function DELETE(request: Request) {
  const payload = await getPayload({ config })
  const { organizationId, email } = scimEmailFromUrl(request)
  if (typeof organizationId !== 'string') return Response.json({ error: organizationId.error }, { status: organizationId.status })
  if (typeof email !== 'string') return Response.json({ error: email.error }, { status: email.status })
  if (!email) return Response.json({ error: '缺少 organizationId 或 email/userName' }, { status: 400 })

  const result = await deprovisionEnterpriseScimMember(payload, {
    organizationId,
    bearerToken: request.headers.get('authorization'),
    email,
  })
  if (!result.ok) return Response.json({ error: result.reason }, { status: 403 })
  return Response.json({
    ok: true,
    found: Boolean(result.user),
    ...(result.user ? enterpriseScimUserResource(result.user, result.member) : { userName: email, active: false }),
    active: false,
  })
}
