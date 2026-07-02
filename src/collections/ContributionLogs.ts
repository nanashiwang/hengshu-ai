import type { CollectionConfig } from 'payload'
import { isAdmin, ownerOrAdmin } from '@/access'
import { CONTRIBUTION_ACTIONS } from '@/lib/constants'
import { rowActionsField } from './fields/rowActions'

export const ContributionLogs: CollectionConfig = {
  slug: 'contribution-logs',
  labels: { singular: '贡献值流水', plural: '贡献值流水' },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['user', 'actionType', 'points', 'createdAt', 'rowActions'],
    group: '成员管理',
  },
  access: {
    read: ownerOrAdmin('user'),
    create: isAdmin, // 仅服务端 overrideAccess 写入
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    rowActionsField('contribution-logs'),
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, label: '用户' },
    {
      name: 'actionType',
      type: 'select',
      required: true,
      label: '行为类型',
      options: CONTRIBUTION_ACTIONS.map((a) => ({ label: a, value: a })),
    },
    { name: 'points', type: 'number', required: true, label: '贡献值变化' },
    {
      name: 'actor',
      type: 'relationship',
      relationTo: 'users',
      label: '触发者',
      admin: { description: '引发本次发放的用户（如收藏者/调用者），用于一次性奖励幂等去重' },
    },
    {
      name: 'idempotencyKey',
      type: 'text',
      unique: true, // 唯一索引：一次性奖励(收藏/发布等)的并发/重放硬幂等（多条 null 允许）
      index: true,
      label: '幂等键',
      admin: { readOnly: true },
    },
    { name: 'relatedSkill', type: 'relationship', relationTo: 'skills', label: '关联 Skill' },
    { name: 'relatedBounty', type: 'relationship', relationTo: 'bounties', label: '关联悬赏' },
    { name: 'description', type: 'textarea', label: '描述' },
  ],
}
