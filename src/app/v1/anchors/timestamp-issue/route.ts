import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { resolveRuntimeEnv } from '@/lib/deploymentSettings'
import { readJsonBodyWithLimit } from '@/lib/requestBody'
import {
  MAX_ANCHOR_VERIFY_BYTES,
  anchorTimestampIssuerFromEnv,
  issueAnchorTimestamp,
} from '@/lib/anchorVerify'

const TSA_ROLES = new Set(['admin', 'reviewer'])

// POST /v1/anchors/timestamp-issue —— 调用已配置的第三方 TSA，为外锚 manifest 换取真实时间戳回执。
export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 })
  if ((user as any).accountStatus === 'banned') return Response.json({ error: '账号已被封禁' }, { status: 403 })
  if (!TSA_ROLES.has(String((user as any).role || ''))) return Response.json({ error: '只有审核员或管理员可以调用 TSA 时间戳服务' }, { status: 403 })

  const parsed = await readJsonBodyWithLimit(request, MAX_ANCHOR_VERIFY_BYTES, '时间戳签发输入过大')
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.value && typeof parsed.value === 'object' ? parsed.value as any : {}
  let manifest: any
  try {
    manifest = typeof body.manifest === 'string' ? JSON.parse(body.manifest) : body.manifest
  } catch {
    return Response.json({ error: 'manifest JSON 无效' }, { status: 400 })
  }
  if (!manifest || typeof manifest !== 'object') return Response.json({ error: '缺少 manifest' }, { status: 400 })

  const runtimeEnv = await resolveRuntimeEnv(payload)
  const result = await issueAnchorTimestamp(manifest, {
    ...anchorTimestampIssuerFromEnv(runtimeEnv),
    provider: typeof body.provider === 'string' && body.provider.trim() ? body.provider.trim().slice(0, 80) : anchorTimestampIssuerFromEnv(runtimeEnv).provider,
  })
  if (!result.ok) return Response.json({ ok: false, error: result.reason, timestampRequest: result.timestampRequest }, { status: result.reason.includes('未配置') ? 503 : 400 })
  return Response.json({
    ok: true,
    timestampRequest: result.timestampRequest,
    externalTimestamp: result.externalTimestamp,
    manifestPatch: result.manifestPatch,
    receipt: result.receipt,
    next: '把 manifestPatch.externalTimestamp 写回 manifest，并把 receipt.body 原样归档；公开验签时只需要 receipt 原文与 receiptHash 匹配。',
  })
}
