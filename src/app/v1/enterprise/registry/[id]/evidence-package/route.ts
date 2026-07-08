import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { buildEnterpriseRegistryEvidencePackage } from '@/lib/evidencePackage'

// GET /v1/enterprise/registry/{id}/evidence-package —— 导出企业准入证据包 JSON，不包含员工输入输出或 secret。
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 })
  if ((user as any).accountStatus === 'banned') return Response.json({ error: '账号已被封禁' }, { status: 403 })

  const result = await buildEnterpriseRegistryEvidencePackage(payload, {
    registryId: id,
    userId: user.id as string,
    userRole: (user as any).role,
  })
  if (!result.ok) return Response.json({ error: result.reason }, { status: result.status })
  return Response.json(result.package, {
    headers: {
      'content-disposition': `attachment; filename="${result.filename}"`,
      'cache-control': 'no-store',
    },
  })
}
