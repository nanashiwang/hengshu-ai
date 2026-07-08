import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { adapterDraftSummary, createAdapterDraftFromFailureCase } from '@/lib/adapterProfile'
import { MAX_ADAPTER_DRAFT_REQUEST_BYTES, normalizeAdapterDraftOverrides } from '@/lib/adapterDraftRequest'
import { readJsonBodyWithLimit } from '@/lib/requestBody'

// POST /v1/failures/{id}/adapter —— 从失败案例生成待审核 Adapter 草稿。
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 })
  if ((user as any).accountStatus === 'banned') return Response.json({ error: '账号已被封禁' }, { status: 403 })

  const parsed = await readJsonBodyWithLimit(request, MAX_ADAPTER_DRAFT_REQUEST_BYTES, 'Adapter 草稿请求体过大', { emptyValue: {} })
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  const normalized = normalizeAdapterDraftOverrides(parsed.value)
  if (!normalized.ok) return Response.json({ error: normalized.error }, { status: normalized.status })

  const result = await createAdapterDraftFromFailureCase(payload, {
    userId: user.id as string,
    userRole: (user as any).role,
    failureCaseId: id,
    overrides: normalized.overrides,
  })
  if (!result.ok) return Response.json({ error: result.reason }, { status: 403 })
  return Response.json({ ok: true, adapter: adapterDraftSummary(result.adapter) })
}
