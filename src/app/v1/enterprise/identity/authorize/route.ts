import { getPayload } from 'payload'
import config from '@payload-config'
import { buildEnterpriseSsoAuthorizeUrl, enterpriseIdentityPlaybook } from '@/lib/enterprise'
import { readEnterpriseOptionalQuery } from '@/lib/enterpriseRequest'

// GET /v1/enterprise/identity/authorize?organizationId=... —— 生成 OIDC SSO 登录发起包。
export async function GET(request: Request) {
  const payload = await getPayload({ config })
  const url = new URL(request.url)
  const organizationIdParam = readEnterpriseOptionalQuery(url.searchParams, 'organizationId', 160)
  if (typeof organizationIdParam !== 'string') return Response.json({ error: organizationIdParam.error }, { status: organizationIdParam.status })
  const organizationId = organizationIdParam
  if (!organizationId) return Response.json({ error: '缺少 organizationId' }, { status: 400 })
  const redirectPathParam = readEnterpriseOptionalQuery(url.searchParams, 'redirectPath', 300)
  if (typeof redirectPathParam !== 'string') return Response.json({ error: redirectPathParam.error }, { status: redirectPathParam.status })
  const redirectPath = redirectPathParam || '/console/enterprise'

  const org = await payload.findByID({ collection: 'organizations' as any, id: organizationId, depth: 0, overrideAccess: true }).catch(() => null) as any
  if (!org || org.status === 'suspended') return Response.json({ error: '组织不存在或已暂停' }, { status: 404 })

  const result = buildEnterpriseSsoAuthorizeUrl(org.identityPolicy, {
    organizationId: String(org.id),
    baseUrl: request.url,
    redirectPath,
  })
  if (!result.ok) {
    return Response.json({
      error: result.reason,
      issues: result.issues || [],
      identityPlaybook: enterpriseIdentityPlaybook(org.identityPolicy),
    }, { status: 400 })
  }

  return Response.json({
    ok: true,
    organization: { id: String(org.id || ''), slug: org.slug || null, name: org.name || null },
    authorize: result.authorize,
    identityPlaybook: enterpriseIdentityPlaybook(org.identityPolicy),
  })
}
