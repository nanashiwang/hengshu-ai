import { describe, expect, it } from 'vitest'
import { getServerUrl, normalizeSiteUrl } from '@/lib/siteUrl'

describe('siteUrl — 服务端运行时站点地址', () => {
  it('去掉尾随斜杠', () => {
    expect(normalizeSiteUrl('https://example.com///')).toBe('https://example.com')
  })

  it('SERVER_URL 优先，NEXT_PUBLIC_SERVER_URL 仅作兼容 fallback', () => {
    expect(getServerUrl({ SERVER_URL: 'https://runtime.example.com', NEXT_PUBLIC_SERVER_URL: 'https://build.example.com' })).toBe(
      'https://runtime.example.com',
    )
    expect(getServerUrl({ NEXT_PUBLIC_SERVER_URL: 'https://build.example.com/' })).toBe('https://build.example.com')
  })
})
