import type { CollectionConfig } from 'payload'
import { isAdmin, isReviewerOrAdmin } from '@/access'
import { slugify } from '@/lib/slug'
import { rowActionsField } from './fields/rowActions'

export const Categories: CollectionConfig = {
  slug: 'categories',
  labels: { singular: '分类', plural: '分类' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'order', 'rowActions'],
    group: 'Skill 内容',
  },
  access: {
    read: () => true,
    create: isReviewerOrAdmin,
    update: isReviewerOrAdmin,
    delete: isAdmin,
  },
  fields: [
    rowActionsField('categories'),
    { name: 'name', type: 'text', required: true, label: '名称' },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      label: 'Slug',
      admin: { position: 'sidebar' },
    },
    { name: 'description', type: 'textarea', label: '描述' },
    { name: 'icon', type: 'text', label: '图标（emoji 或名称）' },
    { name: 'order', type: 'number', defaultValue: 0, label: '排序' },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (data && !data.slug && data.name) data.slug = slugify(data.name)
        return data
      },
    ],
    beforeDelete: [
      async ({ id, req }) => {
        // 删分类前解除引用，避免 skills.category 悬空导致前台筛选/展示错乱
        await req.payload.update({
          collection: 'skills',
          where: { category: { equals: id } },
          data: { category: null },
          overrideAccess: true,
          req,
        })
      },
    ],
  },
}
