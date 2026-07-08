import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { buildRunLedgerWhere, privateRunLedgerEntry } from '@/lib/runLedgerPublic'
import { recordAuditEvent } from '@/lib/audit'
import { boundedIntParam } from '@/lib/queryParams'

// GET /v1/runs —— 当前用户私人运行台账导出；默认不含输入/输出，?includeIO=1 时仅本人可导出原文。
export async function GET(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 })
  if ((user as any).accountStatus === 'banned') return Response.json({ error: '账号已被封禁' }, { status: 403 })

  const url = new URL(request.url)
  const includeIO = url.searchParams.get('includeIO') === '1'
  const limit = boundedIntParam(url.searchParams, 'limit', 100, 1, 500)
  const page = boundedIntParam(url.searchParams, 'page', 1, 1, 10_000)

  const where = buildRunLedgerWhere(String(user.id), url.searchParams)

  const res = await payload.find({
    collection: 'skill-runs',
    where,
    depth: 1,
    limit,
    page,
    sort: '-createdAt',
    overrideAccess: true,
  })

  await recordAuditEvent(payload, {
    event: includeIO ? 'private_run_ledger_export_with_io' : 'private_run_ledger_export',
    actorId: user.id as string,
    targetUserId: user.id as string,
    targetType: 'user',
    targetId: user.id as string,
    summary: includeIO ? '用户导出私人运行台账（含输入/输出）' : '用户导出私人运行台账指标',
    metadata: { includeIO, filters: Object.fromEntries(url.searchParams.entries()), limit, page, exported: res.docs.length },
    request,
  })

  return Response.json({
    totalDocs: res.totalDocs,
    page: res.page,
    totalPages: res.totalPages,
    limit,
    includeIO,
    docs: (res.docs as any[]).map((run) => privateRunLedgerEntry(run, includeIO)),
  })
}
