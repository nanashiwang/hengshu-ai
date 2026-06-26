import type { GlobalConfig } from 'payload'
import { isAdmin } from '@/access'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: '站点设置',
  admin: { group: '系统设置' },
  access: {
    read: () => true,
    update: isAdmin,
  },
  fields: [
    { name: 'siteName', type: 'text', defaultValue: '衡术 Hengshu', label: '站点名称' },
    {
      name: 'slogan',
      type: 'text',
      defaultValue: 'Verified AI Skills, Powered by Contribution.',
      label: '标语',
    },
    {
      name: 'featuredSkills',
      type: 'relationship',
      relationTo: 'skills',
      hasMany: true,
      label: '首页精选 Skill',
    },
    { name: 'announcement', type: 'textarea', label: '公告' },
  ],
}
