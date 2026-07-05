import type { MetadataRoute } from 'next'
import { getServerUrl } from '@/lib/siteUrl'

export default function robots(): MetadataRoute.Robots {
  const base = getServerUrl()
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // 私有/接口路径不索引
      disallow: ['/console', '/admin', '/api/', '/v1/'],
    },
    sitemap: `${base}/sitemap.xml`,
  }
}
