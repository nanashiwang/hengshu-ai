import type { GlobalConfig } from 'payload'
import { isAdmin } from '@/access'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: '站点设置',
  admin: { group: '系统' },
  access: {
    read: () => true,
    update: isAdmin,
  },
  fields: [
    { name: 'siteName', type: 'text', defaultValue: '元衡 SkillHub', label: '站点名称' },
    { name: 'slogan', type: 'text', defaultValue: '经过评测的 AI Skill 市场', label: '标语' },
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
