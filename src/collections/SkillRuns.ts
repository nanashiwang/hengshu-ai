import type { CollectionConfig } from 'payload'
import { isAdmin, isAdminField, ownerOrAdmin } from '@/access'
import { ROUTE_MODES } from '@/lib/constants'
import { decryptJsonSecret, decryptSecret, encryptJsonSecret, encryptSecret } from '@/lib/secrets'
import { rowActionsField } from './fields/rowActions'

export const SkillRuns: CollectionConfig = {
  slug: 'skill-runs',
  labels: { singular: '运行记录', plural: '运行记录' },
  admin: {
    useAsTitle: 'runId',
    defaultColumns: ['runId', 'skill', 'model', 'success', 'estimatedCost', 'latencyMs', 'createdAt', 'rowActions'],
    group: 'Skill 内容',
  },
  access: {
    read: ownerOrAdmin('user'),
    create: isAdmin, // 仅由运行端点 overrideAccess 写入
    update: isAdmin,
    delete: isAdmin,
  },

  hooks: {
    beforeChange: [
      ({ data }) => {
        if (data?.inputJson != null) data.inputJson = encryptJsonSecret(data.inputJson)
        if (typeof data?.outputText === 'string') data.outputText = encryptSecret(data.outputText) || ''
        if (data?.outputJson != null) data.outputJson = encryptJsonSecret(data.outputJson)
        return data
      },
    ],
    afterRead: [
      ({ doc }) => {
        if (doc?.inputJson != null) doc.inputJson = decryptJsonSecret(doc.inputJson) as any
        if (typeof doc?.outputText === 'string') doc.outputText = decryptSecret(doc.outputText)
        if (doc?.outputJson != null) doc.outputJson = decryptJsonSecret(doc.outputJson) as any
        return doc
      },
    ],
  },
  fields: [
    rowActionsField('skill-runs'),
    { name: 'runId', type: 'text', index: true, label: '运行 ID' },
    { name: 'user', type: 'relationship', relationTo: 'users', label: '用户' },
    { name: 'skill', type: 'relationship', relationTo: 'skills', required: true, label: 'Skill' },
    { name: 'skillVersion', type: 'relationship', relationTo: 'skill-versions', label: '版本' },
    { name: 'rerunOf', type: 'relationship', relationTo: 'skill-runs', index: true, label: '重跑自' },
    { name: 'rerunFromModel', type: 'text', label: '原模型' },
    { name: 'adapterProfile', type: 'relationship', relationTo: 'adapter-profiles', index: true, label: '应用适配补丁' },
    { name: 'modelProfile', type: 'relationship', relationTo: 'model-profiles', index: true, label: '模型画像' },
    { name: 'model', type: 'text', label: '使用模型' },
    { name: 'modelVersion', type: 'text', label: '模型版本' },
    {
      name: 'routeMode',
      type: 'select',
      label: '路由模式',
      options: ROUTE_MODES.map((m) => ({ label: m, value: m })),
    },
    {
      name: 'inputJson',
      type: 'json',
      label: '输入',
      access: { read: isAdminField },
      admin: { description: '用户原始输入；普通用户只能经 /v1/runs?includeIO=1 审计导出。' },
    },
    {
      name: 'outputText',
      type: 'textarea',
      label: '输出原文',
      access: { read: isAdminField },
      admin: { description: '模型原始输出；普通用户只能经 /v1/runs?includeIO=1 审计导出。' },
    },
    {
      name: 'outputJson',
      type: 'json',
      label: '结构化输出',
      access: { read: isAdminField },
      admin: { description: '结构化输出原文；普通用户只能经 /v1/runs?includeIO=1 审计导出。' },
    },
    { name: 'promptTokens', type: 'number', label: '输入 token' },
    { name: 'completionTokens', type: 'number', label: '输出 token' },
    { name: 'totalTokens', type: 'number', label: '总 token' },
    { name: 'estimatedCost', type: 'number', label: '估算成本(元)' },
    { name: 'chargedAmount', type: 'number', label: '实际收费(元)' },
    { name: 'chargedCredits', type: 'number', defaultValue: 0, label: '实际扣费 credit' },
    { name: 'savedAmount', type: 'number', defaultValue: 0, label: '成本优化回执(元)', admin: { description: '相比默认 premium 模型降低的估算成本；作为后台履约优化指标，不作为主叙事。' } },
    { name: 'latencyMs', type: 'number', label: '耗时(ms)' },
    { name: 'success', type: 'checkbox', defaultValue: false, label: '是否成功' },
    { name: 'errorCode', type: 'text', label: '错误码' },
    { name: 'formatValid', type: 'checkbox', defaultValue: false, label: '输出格式有效' },
    {
      name: 'countedInMetrics',
      type: 'checkbox',
      defaultValue: true,
      label: '计入 Skill 指标',
      admin: { description: '对比/探测运行(skipAggregate)为 false，不计入 headline 指标，台账对账据此过滤' },
    },
    {
      name: 'newapiLogId',
      type: 'text',
      label: '模型网关 日志 ID',
      access: { read: isAdminField },
      admin: { description: '内部排障句柄，不随用户私人台账或 Payload REST 直接返回。' },
    },
  ],
}
