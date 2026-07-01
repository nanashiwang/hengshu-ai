import { describe, it, expect } from 'vitest'
import { pageWindow, buildPageQuery } from '@/lib/pagination'

describe('pageWindow — 紧凑页码窗口', () => {
  it('小页数全展开', () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3])
  })

  it('中间页：首 … 当前±1 … 尾', () => {
    expect(pageWindow(5, 10)).toEqual([1, '…', 4, 5, 6, '…', 10])
  })

  it('相邻不插省略号', () => {
    expect(pageWindow(2, 4)).toEqual([1, 2, 3, 4])
  })

  it('首页', () => {
    expect(pageWindow(1, 10)).toEqual([1, 2, '…', 10])
  })

  it('尾页', () => {
    expect(pageWindow(10, 10)).toEqual([1, '…', 9, 10])
  })
})

describe('buildPageQuery — 分页链接查询串', () => {
  it('page<=1 省略页参数（URL 干净）', () => {
    expect(buildPageQuery({ q: 'x' }, 'page', 1)).toBe('q=x')
  })

  it('page>1 带上页号', () => {
    expect(buildPageQuery({ q: 'x' }, 'page', 3)).toBe('q=x&page=3')
  })

  it('空值过滤 + 覆盖旧 page', () => {
    expect(buildPageQuery({ q: '', page: '9', sort: 'new' }, 'page', 2)).toBe('page=2&sort=new')
  })

  it('自定义 pageKey 保留其它榜页码（一页多榜）', () => {
    expect(buildPageQuery({ up: '2' }, 'sp', 3)).toBe('up=2&sp=3')
  })

  it('值做 URL 编码', () => {
    expect(buildPageQuery({ q: 'a b&c' }, 'page', 2)).toBe('q=a%20b%26c&page=2')
  })
})
