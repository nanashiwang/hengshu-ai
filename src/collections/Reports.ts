import type { CollectionConfig } from 'payload'
import { isAdmin, isLoggedIn, isReviewerOrAdmin } from '@/access'

export const Reports: CollectionConfig = {
  slug: 'reports',
  labels: { singular: '举报', plural: '举报' },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['targetType', 'reason', 'status', 'reporter', 'createdAt'],
    group: '审核治理',
  },
  access: {
    read: isReviewerOrAdmin,
    create: isLoggedIn,
    update: isReviewerOrAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'reporter',
      type: 'relationship',
      relationTo: 'users',
      label: '举报人',
      admin: { readOnly: true },
    },
    {
      name: 'targetType',
      type: 'select',
      required: true,
      label: '对象类型',
      options: [
        { label: 'Skill', value: 'skill' },
        { label: '评论', value: 'review' },
        { label: '用户', value: 'user' },
        { label: '悬赏', value: 'bounty' },
      ],
    },
    { name: 'targetId', type: 'text', required: true, label: '对象 ID' },
    {
      name: 'reason',
      type: 'select',
      required: true,
      label: '原因',
      options: [
        { label: '垃圾信息', value: 'spam' },
        { label: '低质量', value: 'low_quality' },
        { label: '版权问题', value: 'copyright' },
        { label: '滥用/恶意', value: 'abuse' },
        { label: '安全风险', value: 'security' },
        { label: '其他', value: 'other' },
      ],
    },
    { name: 'detail', type: 'textarea', label: '详情' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'open',
      label: '处理状态',
      options: [
        { label: '待处理', value: 'open' },
        { label: '处理中', value: 'reviewing' },
        { label: '已解决', value: 'resolved' },
        { label: '已驳回', value: 'dismissed' },
      ],
    },
    {
      name: 'handledBy',
      type: 'relationship',
      relationTo: 'users',
      label: '处理人',
      admin: { readOnly: true },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, req, operation }) => {
        if (operation === 'create' && req.user && !data.reporter) {
          data.reporter = req.user.id
        }
        return data
      },
    ],
  },
}
