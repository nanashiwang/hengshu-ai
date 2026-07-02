import type { CollectionConfig } from 'payload'
import { isAdmin, ownerOrAdmin } from '@/access'
import { rowActionsField } from './fields/rowActions'

// 站内通知（#17，周活作者最强回访钩子）。事件源(收藏/评论/悬赏/结算)由服务端 notify() 写入。
export const Notifications: CollectionConfig = {
  slug: 'notifications',
  labels: { singular: '通知', plural: '通知' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['user', 'type', 'title', 'read', 'createdAt', 'rowActions'],
    group: '成员管理',
  },
  access: {
    read: ownerOrAdmin('user'),
    create: isAdmin, // 仅服务端 overrideAccess
    update: ownerOrAdmin('user'), // 本人可标记已读
    delete: ownerOrAdmin('user'),
  },
  fields: [
    rowActionsField('notifications'),
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true, label: '接收者' },
    {
      name: 'type',
      type: 'select',
      label: '类型',
      defaultValue: 'system',
      options: [
        { label: '被收藏', value: 'skill_favorited' },
        { label: '新评价', value: 'review' },
        { label: '悬赏被接单', value: 'bounty_accepted' },
        { label: '悬赏已提交', value: 'bounty_submitted' },
        { label: '悬赏已完成', value: 'bounty_completed' },
        { label: '系统', value: 'system' },
      ],
    },
    { name: 'title', type: 'text', required: true, label: '标题' },
    { name: 'body', type: 'textarea', label: '内容' },
    { name: 'link', type: 'text', label: '跳转链接' },
    { name: 'read', type: 'checkbox', defaultValue: false, index: true, label: '已读' },
    { name: 'relatedSkill', type: 'relationship', relationTo: 'skills', label: '关联 Skill' },
    { name: 'relatedBounty', type: 'relationship', relationTo: 'bounties', label: '关联悬赏' },
  ],
}
