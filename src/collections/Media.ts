import type { CollectionConfig } from 'payload'
import { isLoggedIn } from '@/access'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: '媒体', plural: '媒体' },
  admin: { group: '系统设置' },
  access: {
    read: () => true,
    create: isLoggedIn,
    update: isLoggedIn,
    delete: isLoggedIn,
  },
  upload: {
    // 优先用 MEDIA_DIR（容器内指向挂载的持久卷 /app/media）；未设时回退项目根下 media（本地开发，与 Payload 默认一致）
    staticDir: process.env.MEDIA_DIR || 'media',
  },
  fields: [{ name: 'alt', type: 'text', label: '替代文本' }],
}
