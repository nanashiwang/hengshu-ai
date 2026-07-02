import type { CollectionConfig } from 'payload'
import { isAdmin, ownerOrAdmin } from '@/access'
import { CREDIT_TX_TYPES } from '@/lib/constants'
import { rowActionsField } from './fields/rowActions'

// credit（算力燃料币）台账。不变量：user.creditBalance == SUM(credit-logs.amount)。
// 仅由服务端 credit lib 以事务 overrideAccess 写入。
export const CreditLogs: CollectionConfig = {
  slug: 'credit-logs',
  labels: { singular: 'credit 流水', plural: 'credit 流水' },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['user', 'type', 'amount', 'balanceAfter', 'createdAt', 'rowActions'],
    group: '成员管理',
  },
  access: {
    read: ownerOrAdmin('user'),
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    rowActionsField('credit-logs'),
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, label: '用户' },
    {
      name: 'type',
      type: 'select',
      required: true,
      label: '交易类型',
      options: CREDIT_TX_TYPES.map((t) => ({ label: t, value: t })),
    },
    { name: 'amount', type: 'number', required: true, label: 'credit 变化（带符号）' },
    { name: 'balanceAfter', type: 'number', label: '交易后余额（快照）' },
    {
      name: 'idempotencyKey',
      type: 'text',
      unique: true, // 唯一索引作为并发/重试的硬幂等保证（多条 null 允许）
      index: true,
      label: '幂等键',
      admin: { readOnly: true },
    },
    { name: 'description', type: 'textarea', label: '描述' },
  ],
}
