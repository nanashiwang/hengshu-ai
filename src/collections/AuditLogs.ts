import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/access'
import { rowActionsField } from './fields/rowActions'

// 安全审计台账：只记录动作、对象、摘要和脱敏 metadata；不落 Key/token/充值码明文。
export const AuditLogs: CollectionConfig = {
  slug: 'audit-logs',
  labels: { singular: '审计日志', plural: '审计日志' },
  admin: {
    useAsTitle: 'event',
    defaultColumns: ['event', 'actor', 'targetUser', 'targetType', 'targetId', 'createdAt', 'rowActions'],
    group: '审核治理',
  },
  access: {
    read: isAdmin,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    rowActionsField('audit-logs'),
    { name: 'event', type: 'text', required: true, index: true, label: '事件' },
    { name: 'actor', type: 'relationship', relationTo: 'users', index: true, label: '操作者' },
    { name: 'targetUser', type: 'relationship', relationTo: 'users', index: true, label: '目标用户' },
    { name: 'targetType', type: 'text', index: true, label: '目标类型' },
    { name: 'targetId', type: 'text', index: true, label: '目标 ID' },
    { name: 'ipHash', type: 'text', index: true, label: 'IP 哈希', admin: { hidden: true } },
    { name: 'summary', type: 'textarea', label: '摘要' },
    { name: 'metadata', type: 'json', label: '脱敏元数据' },
  ],
}
