import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { isPublicFailureCase } from '@/lib/failureCasePublic'
import { buildApprovedAdapterWhere, buildFailureReverifyPlan, buildFailureReverifyRunWhere } from '@/lib/reverifyPlan'

function relationId(value: any) {
  if (!value) return null
  return typeof value === 'object' ? String(value.id || '') || null : String(value)
}

function canViewFailureCase(user: any, failure: any) {
  if (isPublicFailureCase(failure)) return true
  const role = String(user?.role || '')
  if (role === 'admin' || role === 'reviewer') return true
  const authorId = relationId(failure?.skill?.author)
  return authorId && String(authorId) === String(user?.id)
}

// GET /v1/failures/{id}/reverify-plan —— 为当前用户生成“失败复现 → Adapter 复验 → 覆盖回写”计划。
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 })
  if ((user as any).accountStatus === 'banned') return Response.json({ error: '账号已被封禁' }, { status: 403 })

  const failureCase = await payload.findByID({ collection: 'failure-cases' as any, id, depth: 2, overrideAccess: true }).catch(() => null)
  if (!failureCase) return Response.json({ error: '失败案例不存在' }, { status: 404 })
  if (!canViewFailureCase(user, failureCase)) return Response.json({ error: '无权查看该失败案例' }, { status: 403 })

  const [runsRes, adaptersRes] = await Promise.all([
    payload.find({
      collection: 'skill-runs' as any,
      where: buildFailureReverifyRunWhere(String(user.id), failureCase),
      depth: 1,
      limit: 20,
      sort: '-createdAt',
      overrideAccess: true,
    }).catch(() => ({ docs: [] as any[] })),
    payload.find({
      collection: 'adapter-profiles' as any,
      where: buildApprovedAdapterWhere(failureCase),
      depth: 1,
      limit: 10,
      sort: '-liftScore',
      overrideAccess: true,
    }).catch(() => ({ docs: [] as any[] })),
  ])

  return Response.json({
    ok: true,
    plan: buildFailureReverifyPlan({
      failureCase,
      candidateRuns: runsRes.docs as any[],
      adapters: adaptersRes.docs as any[],
      userId: String(user.id),
    }),
  })
}
