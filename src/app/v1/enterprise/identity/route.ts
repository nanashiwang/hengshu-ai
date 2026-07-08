import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { enterpriseIdentityPlaybook, publicEnterpriseOrganization, updateEnterpriseIdentityPolicy } from '@/lib/enterprise'
import { MAX_ENTERPRISE_REQUEST_BYTES, requireEnterpriseIds } from '@/lib/enterpriseRequest'
import { readJsonBodyWithLimit } from '@/lib/requestBody'

// POST /v1/enterprise/identity —— 更新组织级身份策略（域名白名单 / requireSso / OIDC SSO / SCIM），并做格式校验。
export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 })
  if ((user as any).accountStatus === 'banned') return Response.json({ error: '账号已被封禁' }, { status: 403 })

  const parsed = await readJsonBodyWithLimit(request, MAX_ENTERPRISE_REQUEST_BYTES, '企业身份策略请求体过大')
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.value

  const ids = requireEnterpriseIds(body, ['organizationId'])
  if (!ids.ok) return Response.json({ error: ids.error }, { status: ids.status })
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId.trim() : ''

  const result = await updateEnterpriseIdentityPolicy(payload, {
    actorId: user.id as string,
    actorRole: (user as any).role,
    organizationId,
    identityPolicy: body.identityPolicy,
  })
  if (!result.ok) return Response.json({ error: result.reason }, { status: 403 })

  return Response.json({
    ok: true,
    organization: publicEnterpriseOrganization(result.organization),
    identityPolicy: result.identityPolicy,
    identityPlaybook: enterpriseIdentityPlaybook(result.identityPolicy),
  })
}
