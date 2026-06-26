import type { CollectionConfig } from 'payload'
import { isAdmin, isLoggedIn, ownerOrAdmin } from '@/access'

// 重算某 Skill 的平均评分与评论数（在 hook 内调用须透传 req 以共享事务）
async function recomputeSkillRating(payload: any, skillId: string, req?: any) {
  if (!skillId) return
  const tx = req ? { req } : {}
  try {
    const res = await payload.find({
      collection: 'reviews',
      where: { and: [{ skill: { equals: skillId } }, { status: { equals: 'visible' } }] },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
      ...tx,
    })
    const ratings = res.docs
      .map((d: any) => d.rating)
      .filter((r: any) => typeof r === 'number')
    const reviewCount = res.totalDocs
    const avgRating =
      ratings.length > 0
        ? Math.round((ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length) * 100) /
          100
        : 0
    await payload.update({
      collection: 'skills',
      id: skillId,
      data: { reviewCount, avgRating },
      overrideAccess: true,
      ...tx,
    })
  } catch (e) {
    payload.logger?.error(`recomputeSkillRating 失败: ${(e as Error).message}`)
  }
}

export const Reviews: CollectionConfig = {
  slug: 'reviews',
  labels: { singular: '评论', plural: '评论' },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['skill', 'user', 'rating', 'type', 'status', 'createdAt'],
    group: '审核治理',
  },
  access: {
    read: () => true,
    create: isLoggedIn,
    update: ownerOrAdmin('user'),
    delete: ownerOrAdmin('user'),
  },
  fields: [
    { name: 'skill', type: 'relationship', relationTo: 'skills', required: true, label: 'Skill' },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      label: '用户',
      admin: { readOnly: true },
    },
    { name: 'rating', type: 'number', min: 1, max: 5, label: '评分(1-5)' },
    { name: 'content', type: 'textarea', label: '内容' },
    {
      name: 'type',
      type: 'select',
      defaultValue: 'review',
      label: '类型',
      options: [
        { label: '评价', value: 'review' },
        { label: '失败案例', value: 'failure_case' },
        { label: '兼容报告', value: 'compat_report' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'visible',
      label: '状态',
      options: [
        { label: '可见', value: 'visible' },
        { label: '隐藏', value: 'hidden' },
        { label: '待审', value: 'pending' },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, req, operation }) => {
        if (operation === 'create' && req.user && !data.user) data.user = req.user.id
        return data
      },
    ],
    afterChange: [
      async ({ doc, req }) => {
        const skillId = typeof doc.skill === 'object' ? doc.skill?.id : doc.skill
        await recomputeSkillRating(req.payload, skillId, req)
        return doc
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        const skillId = typeof doc.skill === 'object' ? doc.skill?.id : doc.skill
        await recomputeSkillRating(req.payload, skillId, req)
        return doc
      },
    ],
  },
}
