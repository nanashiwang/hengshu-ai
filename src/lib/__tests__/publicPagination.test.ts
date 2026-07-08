import { describe, expect, it } from 'vitest'
import { publicFilteredPageMeta } from '@/lib/publicPagination'

describe('publicPagination — 公开过滤后分页元数据', () => {
  it('只按过滤后的本页 docs 返回数量，避免泄漏过滤前 totalPages', () => {
    expect(publicFilteredPageMeta([{ id: 'a' }], 50, 3)).toEqual({
      totalDocs: 1,
      page: 3,
      totalPages: 1,
      limit: 50,
    })
    expect(publicFilteredPageMeta([], 50, 3)).toEqual({
      totalDocs: 0,
      page: 3,
      totalPages: 0,
      limit: 50,
    })
  })
})
