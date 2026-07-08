import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { canReadEnterpriseAudit, getEnterpriseFailureKnowledge } from '@/lib/enterprise'
import { boundedIntParam } from '@/lib/queryParams'
import { readEnterpriseQueryId } from '@/lib/enterpriseRequest'

// GET /v1/enterprise/failures?organizationId=... —— 组织内失败知识库，只基于脱敏审计元数据聚合。
export async function GET(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 })
  if ((user as any).accountStatus === 'banned') return Response.json({ error: '账号已被封禁' }, { status: 403 })

  const url = new URL(request.url)
  const organizationId = readEnterpriseQueryId(url.searchParams, 'organizationId')
  if (typeof organizationId !== 'string') return Response.json({ error: organizationId.error }, { status: organizationId.status })
  const limit = boundedIntParam(url.searchParams, 'limit', 1000, 1, 1000)
  const access = await canReadEnterpriseAudit(payload, {
    userId: user.id as string,
    userRole: (user as any).role,
    organizationId,
  })
  if (!access.ok) return Response.json({ error: access.reason }, { status: 403 })

  const groups = await getEnterpriseFailureKnowledge(payload, { organizationId, limit })
  return Response.json({ organizationId, totalGroups: groups.length, groups })
}
