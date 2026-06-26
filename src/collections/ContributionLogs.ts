import type { CollectionConfig } from 'payload'
import { isAdmin, ownerOrAdmin } from '@/access'
import { CONTRIBUTION_ACTIONS } from '@/lib/constants'

export const ContributionLogs: CollectionConfig = {
  slug: 'contribution-logs',
  labels: { singular: '贡献值流水', plural: '贡献值流水' },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['user', 'actionType', 'points', 'createdAt'],
    group: '成员管理',
  },
  access: {
    read: ownerOrAdmin('user'),
    create: isAdmin, // 仅服务端 overrideAccess 写入
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, label: '用户' },
    {
      name: 'actionType',
      type: 'select',
      required: true,
      label: '行为类型',
      options: CONTRIBUTION_ACTIONS.map((a) => ({ label: a, value: a })),
    },
    { name: 'points', type: 'number', required: true, label: '贡献值变化' },
    { name: 'relatedSkill', type: 'relationship', relationTo: 'skills', label: '关联 Skill' },
    { name: 'relatedBounty', type: 'relationship', relationTo: 'bounties', label: '关联悬赏' },
    { name: 'description', type: 'textarea', label: '描述' },
  ],
}
