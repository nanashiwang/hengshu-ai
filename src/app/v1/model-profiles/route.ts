import { getPayload } from 'payload'
import config from '@payload-config'
import { buildModelProfileWhere, isPublicModelProfile, publicModelProfile } from '@/lib/modelProfilePublic'
import { publicFilteredPageMeta } from '@/lib/publicPagination'
import { boundedIntParam } from '@/lib/queryParams'

// GET /v1/model-profiles —— 公开读取模型画像/漂移/回归告警；不含平台收益字段。
export async function GET(request: Request) {
  const payload = await getPayload({ config })
  const url = new URL(request.url)
  const limit = boundedIntParam(url.searchParams, 'limit', 100, 1, 500)
  const page = boundedIntParam(url.searchParams, 'page', 1, 1, 10_000)

  const where = buildModelProfileWhere(url.searchParams)

  const res = await payload.find({
    collection: 'model-profiles' as any,
    where,
    depth: 0,
    limit,
    page,
    sort: '-lastObservedAt',
    overrideAccess: true,
  })

  const docs = (res.docs as any[]).filter(isPublicModelProfile).map(publicModelProfile)
  return Response.json({
    ...publicFilteredPageMeta(docs, limit, res.page),
    docs,
  })
}
