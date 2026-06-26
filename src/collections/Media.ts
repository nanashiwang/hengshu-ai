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
  upload: true,
  fields: [{ name: 'alt', type: 'text', label: '替代文本' }],
}
