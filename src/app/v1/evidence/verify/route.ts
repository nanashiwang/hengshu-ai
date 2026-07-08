import { getPayload } from 'payload'
import config from '@payload-config'
import { resolveRuntimeEnv } from '@/lib/deploymentSettings'
import { getPublicKeyInfo } from '@/lib/signing'
import { buildEvidenceVerifyQuery, buildPublicEvidenceVerifyRows, canVerifyEvidenceTarget } from '@/lib/evidenceVerifyPublic'

// GET /v1/evidence/verify?targetType=skill_passport&targetId=...&limit=20
// 公开验证已知对象的证据快照；不允许匿名枚举全部 targetId。
export async function GET(request: Request) {
  const payload = await getPayload({ config })
  const url = new URL(request.url)
  const query = buildEvidenceVerifyQuery(url.searchParams)
  if (!query.ok) return Response.json({ error: query.error }, { status: query.status })

  const targetType = url.searchParams.get('targetType')!.trim()
  const targetId = url.searchParams.get('targetId')!.trim()
  const visibleTarget = await canVerifyEvidenceTarget(payload, targetType, targetId)
  if (!visibleTarget) return Response.json({ error: '证据对象不存在' }, { status: 404 })

  const [snapshots, runtimeEnv] = await Promise.all([
    payload.find({
      collection: 'evidence-snapshots' as any,
      where: query.where,
      limit: query.limit,
      depth: 0,
      sort: '-createdAt',
      overrideAccess: true,
    }),
    resolveRuntimeEnv(payload),
  ])
  const publicKey = getPublicKeyInfo(runtimeEnv)
  const rows = buildPublicEvidenceVerifyRows(snapshots.docs as any[], publicKey)

  return Response.json({
    totalDocs: snapshots.totalDocs,
    limit: query.limit,
    publicKey: publicKey ? { keyId: publicKey.keyId, algorithm: publicKey.algorithm } : null,
    docs: rows,
  })
}
