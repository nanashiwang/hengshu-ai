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
      defaultValue: 'AI Skill 的可信与兼容控制平面。',
      label: '标语',
    },
    {
      name: 'featuredSkills',
      type: 'relationship',
      relationTo: 'skills',
      hasMany: true,
      label: '首页精选 Skill',
    },
    {
      name: 'registrationEmailRequired',
      type: 'checkbox',
      defaultValue: false,
      label: '注册必须填写邮箱',
      admin: {
        description: '开启时注册页要求填写邮箱；关闭时用户可不填，系统会生成内部占位邮箱用于账号登录态。',
      },
    },
    { name: 'announcement', type: 'textarea', label: '公告' },
  ],
}
