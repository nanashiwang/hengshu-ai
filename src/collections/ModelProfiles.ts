import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/access'
import { rowActionsField } from './fields/rowActions'

// Model Profile：模型行为画像。把 modelName 字符串升级为可治理、可过期的兼容对象。
export const ModelProfiles: CollectionConfig = {
  slug: 'model-profiles',
  labels: { singular: '模型画像', plural: '模型画像' },
  indexes: [
    { fields: ['provider', 'modelName'] },
    { fields: ['modelName', 'modelVersion'] },
  ],
  admin: {
    useAsTitle: 'modelName',
    defaultColumns: ['modelName', 'provider', 'modelVersion', 'profileStatus', 'lastObservedAt', 'rowActions'],
    group: '可信与兼容',
    description: '模型的能力、价格、区域、常见失败和兼容证据 freshness。',
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    rowActionsField('model-profiles'),
    { name: 'provider', type: 'text', index: true, label: 'Provider' },
    { name: 'modelName', type: 'text', required: true, index: true, label: '模型名' },
    { name: 'modelVersion', type: 'text', label: '模型版本' },
    {
      name: 'profileStatus',
      type: 'select',
      defaultValue: 'observed',
      label: '画像状态',
      options: [
        { label: '观测中', value: 'observed' },
        { label: '已验证', value: 'verified' },
        { label: '证据过期', value: 'stale' },
        { label: '已废弃', value: 'deprecated' },
      ],
    },
    { name: 'contextLength', type: 'number', label: '上下文长度' },
    { name: 'supportsStructuredOutput', type: 'checkbox', defaultValue: false, label: '支持结构化输出' },
    { name: 'supportsToolUse', type: 'checkbox', defaultValue: false, label: '支持工具调用' },
    { name: 'chineseStyleScore', type: 'number', label: '中文风格能力(0-100)' },
    { name: 'jsonStabilityScore', type: 'number', label: 'JSON 稳定性(0-100)' },
    { name: 'longOutputStabilityScore', type: 'number', label: '长输出稳定性(0-100)' },
    { name: 'inputPrice', type: 'number', label: '输入价格/1k' },
    { name: 'outputPrice', type: 'number', label: '输出价格/1k' },
    { name: 'region', type: 'text', label: '区域/合规特性' },
    { name: 'platformPayAllowed', type: 'checkbox', defaultValue: false, label: '允许平台代付' },
    { name: 'knownIssues', type: 'json', label: '已知问题' },
    { name: 'regressionAlerts', type: 'json', label: '回归告警' },
    { name: 'driftSummary', type: 'json', label: '漂移摘要' },
    { name: 'driftHistory', type: 'json', label: '漂移曲线' },
    { name: 'capabilities', type: 'json', label: '能力标签' },
    { name: 'freshness', type: 'json', label: '证据新鲜度' },
    { name: 'lastObservedAt', type: 'date', label: '最近观测时间' },
  ],
}
