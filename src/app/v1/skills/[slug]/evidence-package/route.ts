import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { buildPublicSkillEvidencePackage } from '@/lib/evidencePackage'

// GET /v1/skills/{slug}/evidence-package —— 导出公开 Skill 证据包 JSON，不包含 prompt/examples/输入输出。
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() }).catch(() => ({ user: null }))
  const result = await buildPublicSkillEvidencePackage(payload, { slug, user })
  if (!result.ok) return Response.json({ error: result.reason }, { status: result.status })
  return Response.json(result.package, {
    headers: {
      'content-disposition': `attachment; filename="${result.filename}"`,
      'cache-control': 'no-store',
    },
  })
}
