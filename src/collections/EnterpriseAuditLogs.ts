import type { Access, CollectionConfig, Where } from 'payload'
import { isActiveAccount, isAdmin } from '@/access'
import { rowActionsField } from './fields/rowActions'

const enterpriseAuditRead: Access = ({ req: { user } }) => {
  if (!isActiveAccount(user)) return false
  if (user.role === 'admin') return true
  if (user.role === 'enterprise_admin') return { 'organization.owner': { equals: user.id } } as Where
  return { actor: { equals: user.id } } as Where
}

// 企业运行审计：只记录治理元数据和规模档，不记录输入/输出原文。
export const EnterpriseAuditLogs: CollectionConfig = {
  slug: 'enterprise-audit-logs',
  labels: { singular: '企业运行审计', plural: '企业运行审计' },
  indexes: [
    { fields: ['organization', 'createdAt'] },
    { fields: ['registry', 'createdAt'] },
    { fields: ['runId'] },
  ],
  admin: {
    useAsTitle: 'runId',
    defaultColumns: ['organization', 'skill', 'actor', 'modelName', 'outcome', 'runId', 'createdAt', 'rowActions'],
    group: '企业治理',
    description: '企业 Skill 运行与策略拒绝的审计台账；不含输入/输出原文。',
  },
  access: {
    read: enterpriseAuditRead,
    create: () => false,
    update: () => false,
    delete: isAdmin,
  },
  fields: [
    rowActionsField('enterprise-audit-logs'),
    { name: 'organization', type: 'relationship', relationTo: 'organizations', required: true, index: true, label: '组织' },
    { name: 'registry', type: 'relationship', relationTo: 'enterprise-registries', index: true, label: '注册表记录' },
    { name: 'actor', type: 'relationship', relationTo: 'users', index: true, label: '运行用户' },
    { name: 'skill', type: 'relationship', relationTo: 'skills', required: true, index: true, label: 'Skill' },
    { name: 'skillVersion', type: 'relationship', relationTo: 'skill-versions', index: true, label: '版本' },
    { name: 'skillRun', type: 'relationship', relationTo: 'skill-runs', index: true, label: '运行记录' },
    { name: 'runId', type: 'text', required: true, index: true, label: 'Run ID' },
    { name: 'modelName', type: 'text', index: true, label: '模型名' },
    { name: 'modelVersion', type: 'text', index: true, label: '模型版本' },
    { name: 'modelProfile', type: 'relationship', relationTo: 'model-profiles', index: true, label: '模型画像' },
    {
      name: 'outcome',
      type: 'select',
      required: true,
      index: true,
      label: '结果',
      options: [
        { label: '成功', value: 'success' },
        { label: '运行失败', value: 'failed' },
        { label: '策略拒绝', value: 'denied' },
      ],
    },
    { name: 'errorCode', type: 'text', index: true, label: '错误码' },
    { name: 'policyReason', type: 'textarea', label: '策略原因' },
    { name: 'inputSizeBucket', type: 'text', label: '输入规模档' },
    { name: 'outputSizeBucket', type: 'text', label: '输出规模档' },
    { name: 'latencyMs', type: 'number', label: '耗时(ms)' },
    { name: 'estimatedCost', type: 'number', label: '估算成本' },
    { name: 'chargedCredits', type: 'number', label: '扣减 Credit' },
    { name: 'metadata', type: 'json', label: '脱敏元数据' },
  ],
}
