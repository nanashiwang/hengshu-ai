import { getPayload } from 'payload'
import config from '@payload-config'
import { buildAdapterProfileWhere, isPublicAdapterProfile, publicAdapterProfile } from '@/lib/adapterProfilePublic'
import { publicFilteredPageMeta } from '@/lib/publicPagination'
import { boundedIntParam } from '@/lib/queryParams'

// GET /v1/adapters —— 公开读取已启用/可观测 Adapter 的效果摘要；不暴露 prompt/schema/decoding 补丁内容。
export async function GET(request: Request) {
  const payload = await getPayload({ config })
  const url = new URL(request.url)
  const limit = boundedIntParam(url.searchParams, 'limit', 50, 1, 200)
  const page = boundedIntParam(url.searchParams, 'page', 1, 1, 10_000)

  const where = buildAdapterProfileWhere(url.searchParams)

  const res = await payload.find({
    collection: 'adapter-profiles' as any,
    where,
    depth: 1,
    limit,
    page,
    sort: '-liftScore',
    overrideAccess: true,
  })

  const docs = (res.docs as any[]).filter(isPublicAdapterProfile).map(publicAdapterProfile)

  return Response.json({
    ...publicFilteredPageMeta(docs, limit, res.page),
    docs,
  })
}
