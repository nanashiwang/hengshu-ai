import type { CollectionConfig } from 'payload'
import { isAdmin, isCreatorOrAbove, publishedOrPrivileged } from '@/access'
import { slugify } from '@/lib/slug'
import { awardContribution } from '@/lib/contribution'

export const Skills: CollectionConfig = {
  slug: 'skills',
  labels: { singular: 'Skill', plural: 'Skill' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'author', 'skillRank', 'runCount', 'successRate'],
    group: 'Skill 内容',
  },
  access: {
    read: publishedOrPrivileged,
    create: isCreatorOrAbove,
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin' || user.role === 'reviewer') return true
      return { author: { equals: user.id } }
    },
    delete: isAdmin,
  },
  fields: [
    { name: 'title', type: 'text', required: true, label: '名称' },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      label: 'Slug',
      admin: { position: 'sidebar' },
    },
    { name: 'description', type: 'textarea', label: '简介' },
    { name: 'category', type: 'relationship', relationTo: 'categories', label: '分类' },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      label: '作者',
      admin: { position: 'sidebar' },
    },
    {
      name: 'visibility',
      type: 'select',
      defaultValue: 'public',
      label: '可见性',
      admin: { position: 'sidebar' },
      options: [
        { label: '公开', value: 'public' },
        { label: '私有', value: 'private' },
        { label: '不公开列出', value: 'unlisted' },
        { label: '企业', value: 'enterprise' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      label: '状态',
      admin: { position: 'sidebar' },
      options: [
        { label: '草稿', value: 'draft' },
        { label: '待审核', value: 'pending' },
        { label: '已发布', value: 'published' },
        { label: '已驳回', value: 'rejected' },
        { label: '已归档', value: 'archived' },
      ],
    },
    {
      name: 'currentVersion',
      type: 'relationship',
      relationTo: 'skill-versions',
      label: '当前版本',
      admin: { position: 'sidebar' },
    },
    // ── 状态标签 ──
    { name: 'isOfficial', type: 'checkbox', defaultValue: false, label: '官方' },
    { name: 'isFeatured', type: 'checkbox', defaultValue: false, label: '精选' },
    { name: 'isFreeleech', type: 'checkbox', defaultValue: false, label: '限免' },
    // ── 健康度/指标（由运行链路与 Worker 维护）──
    {
      type: 'collapsible',
      label: '指标（自动维护）',
      admin: { initCollapsed: true },
      fields: [
        { name: 'skillRank', type: 'number', defaultValue: 0, label: 'SkillRank' },
        { name: 'healthScore', type: 'number', defaultValue: 0, label: '健康度' },
        { name: 'runCount', type: 'number', defaultValue: 0, label: '调用次数' },
        { name: 'favoriteCount', type: 'number', defaultValue: 0, label: '收藏数' },
        { name: 'reviewCount', type: 'number', defaultValue: 0, label: '评论数' },
        { name: 'avgRating', type: 'number', defaultValue: 0, label: '平均评分' },
        { name: 'avgCost', type: 'number', defaultValue: 0, label: '平均成本(元)' },
        { name: 'avgLatencyMs', type: 'number', defaultValue: 0, label: '平均耗时(ms)' },
        { name: 'successRate', type: 'number', defaultValue: 0, label: '成功率(0-1)' },
        { name: 'formatSuccessRate', type: 'number', defaultValue: 0, label: '格式成功率(0-1)' },
        { name: 'lastRunAt', type: 'date', label: '最近调用时间' },
        { name: 'lastUpdatedAt', type: 'date', label: '最近更新时间' },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, req, operation }) => {
        if (operation === 'create') {
          if (!data.slug && data.title) data.slug = slugify(data.title)
          if (!data.author && req.user) data.author = req.user.id
          if (!data.lastUpdatedAt) data.lastUpdatedAt = new Date().toISOString()
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        // 发布通过审核：给作者 +50（仅在状态从非 published 变为 published 时）
        const becamePublished =
          doc.status === 'published' &&
          (operation === 'create' || previousDoc?.status !== 'published')
        if (becamePublished) {
          const authorId =
            typeof doc.author === 'object' ? doc.author?.id : doc.author
          if (authorId) {
            await awardContribution(req.payload, {
              userId: authorId,
              actionType: 'skill_published',
              points: 50,
              relatedSkill: doc.id,
              description: `Skill「${doc.title}」发布通过`,
              req,
            })
          }
        }
        return doc
      },
    ],
  },
}
