import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { publicEnterpriseMember, suspendOrganizationMember, upsertOrganizationMember } from '@/lib/enterprise'
import { MAX_ENTERPRISE_REQUEST_BYTES, readEnterpriseQueryId, requireEnterpriseIds } from '@/lib/enterpriseRequest'
import { readJsonBodyWithLimit } from '@/lib/requestBody'

// POST /v1/enterprise/members —— 添加/更新组织成员角色。
export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 })
  if ((user as any).accountStatus === 'banned') return Response.json({ error: '账号已被封禁' }, { status: 403 })

  const parsed = await readJsonBodyWithLimit(request, MAX_ENTERPRISE_REQUEST_BYTES, '企业成员请求体过大')
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.value
  const ids = requireEnterpriseIds(body, ['organizationId', 'userId'])
  if (!ids.ok) return Response.json({ error: ids.error }, { status: ids.status })
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId.trim() : ''
  const userId = typeof body.userId === 'string' ? body.userId.trim() : ''

  const result = await upsertOrganizationMember(payload, {
    actorId: user.id as string,
    actorRole: (user as any).role,
    organizationId,
    userId,
    role: typeof body.role === 'string' ? body.role.trim() : undefined,
    status: typeof body.status === 'string' ? body.status.trim() : undefined,
    authMethod: typeof body.authMethod === 'string' ? body.authMethod.trim() : undefined,
  })
  if (!result.ok) return Response.json({ error: result.reason }, { status: 403 })
  return Response.json({ ok: true, created: result.created, member: publicEnterpriseMember(result.member) })
}

// DELETE /v1/enterprise/members —— 移除成员：保留记录但置为 suspended，便于审计追溯。
export async function DELETE(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 })
  if ((user as any).accountStatus === 'banned') return Response.json({ error: '账号已被封禁' }, { status: 403 })

  const url = new URL(request.url)
  const organizationId = readEnterpriseQueryId(url.searchParams, 'organizationId')
  if (typeof organizationId !== 'string') return Response.json({ error: organizationId.error }, { status: organizationId.status })
  const userId = readEnterpriseQueryId(url.searchParams, 'userId')
  if (typeof userId !== 'string') return Response.json({ error: userId.error }, { status: userId.status })

  const result = await suspendOrganizationMember(payload, {
    actorId: user.id as string,
    actorRole: (user as any).role,
    organizationId,
    userId,
  })
  if (!result.ok) return Response.json({ error: result.reason }, { status: 403 })
  return Response.json({ ok: true, member: publicEnterpriseMember(result.member) })
}
