import { getPayload } from 'payload'
import config from '@payload-config'
import { buildFailureCaseWhere, isPublicFailureCase, publicFailureCase } from '@/lib/failureCasePublic'
import { publicFilteredPageMeta } from '@/lib/publicPagination'
import { boundedIntParam } from '@/lib/queryParams'

// GET /v1/failures —— 公开读取脱敏失败知识库；不含输入/输出原文或逐条时序。
export async function GET(request: Request) {
  const payload = await getPayload({ config })
  const url = new URL(request.url)
  const limit = boundedIntParam(url.searchParams, 'limit', 50, 1, 200)
  const page = boundedIntParam(url.searchParams, 'page', 1, 1, 10_000)
  const where = buildFailureCaseWhere(url.searchParams)

  const res = await payload.find({
    collection: 'failure-cases' as any,
    where,
    depth: 1,
    limit,
    page,
    sort: '-occurrenceCount',
    overrideAccess: true,
  })

  const docs = (res.docs as any[]).filter(isPublicFailureCase).map(publicFailureCase)

  return Response.json({
    ...publicFilteredPageMeta(docs, limit, res.page),
    docs,
  })
}
