import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { readJsonBodyWithLimit } from '@/lib/requestBody'

const REVIEW_STATUSES = new Set(['pending', 'needs_changes', 'approved', 'rejected'])
const MAX_ADAPTER_REVIEW_BYTES = 20_000
const REVIEWER_ROLES = new Set(['admin', 'reviewer'])

// POST /v1/adapters/{id}/review —— 审核员更新 Adapter 人工评审状态；批准时可同时启用 active。
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 })
  if ((user as any).accountStatus === 'banned') return Response.json({ error: '账号已被封禁' }, { status: 403 })
  if (!REVIEWER_ROLES.has(String((user as any).role || ''))) {
    return Response.json({ error: '只有审核员可以评审 Adapter' }, { status: 403 })
  }

  const parsed = await readJsonBodyWithLimit(request, MAX_ADAPTER_REVIEW_BYTES, 'Adapter 评审请求体过大')
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.value && typeof parsed.value === 'object' ? parsed.value as any : {}
  const reviewStatus = String(body.reviewStatus || '').trim()
  if (!REVIEW_STATUSES.has(reviewStatus)) return Response.json({ error: 'reviewStatus 不合法' }, { status: 400 })
  const reviewerNotes = typeof body.reviewerNotes === 'string' ? body.reviewerNotes.trim().slice(0, 1000) : undefined
  const activate = Boolean(body.activate)
  if (activate && reviewStatus !== 'approved') return Response.json({ error: '只有 approved 可以启用 Adapter' }, { status: 400 })

  const adapter = await payload.findByID({
    collection: 'adapter-profiles' as any,
    id,
    depth: 0,
    overrideAccess: true,
  }).catch(() => null) as any
  if (!adapter) return Response.json({ error: 'Adapter 不存在' }, { status: 404 })

  const updated = await payload.update({
    collection: 'adapter-profiles' as any,
    id,
    data: {
      reviewStatus,
      ...(reviewerNotes ? { reviewerNotes } : {}),
      ...(activate ? { status: 'active' } : reviewStatus === 'rejected' ? { status: 'disabled' } : {}),
    },
    depth: 0,
    overrideAccess: true,
  })

  return Response.json({
    ok: true,
    adapter: {
      id: String((updated as any).id || ''),
      status: (updated as any).status || 'draft',
      reviewStatus: (updated as any).reviewStatus || reviewStatus,
      reviewedAt: (updated as any).reviewedAt || null,
    },
  })
}
