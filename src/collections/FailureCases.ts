import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/access'
import { rowActionsField } from './fields/rowActions'

// Failure Case：失败知识库的一等资产，只存脱敏症状、错误类型和修复/复验建议。
export const FailureCases: CollectionConfig = {
  slug: 'failure-cases',
  labels: { singular: '失败案例', plural: '失败案例' },
  indexes: [
    { fields: ['profileKey'] },
    { fields: ['errorType', 'modelName'] },
  ],
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'errorType', 'modelName', 'occurrenceCount', 'status', 'rowActions'],
    group: '可信与兼容',
    description: '从 CompatReports/SkillRuns 聚类出的脱敏失败知识库。',
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    rowActionsField('failure-cases'),
    { name: 'title', type: 'text', required: true, label: '标题' },
    { name: 'profileKey', type: 'text', index: true, label: '任务失败画像键' },
    { name: 'errorType', type: 'text', required: true, index: true, label: '错误类型' },
    { name: 'modelName', type: 'text', required: true, index: true, label: '模型' },
    { name: 'primaryModelVersion', type: 'text', label: '主模型版本' },
    { name: 'skill', type: 'relationship', relationTo: 'skills', label: '代表 Skill' },
    { name: 'skillVersion', type: 'relationship', relationTo: 'skill-versions', label: '代表版本' },
    { name: 'symptom', type: 'textarea', label: '脱敏症状' },
    { name: 'likelyCause', type: 'textarea', label: '可能根因' },
    { name: 'repairTemplate', type: 'textarea', label: '修复模板' },
    { name: 'verifyTemplate', type: 'textarea', label: '复验步骤' },
    { name: 'primaryInputBucket', type: 'text', label: '主输入规模档' },
    { name: 'inputBuckets', type: 'json', label: '输入规模档' },
    { name: 'outputBuckets', type: 'json', label: '输出规模档' },
    { name: 'modelBreakdown', type: 'json', label: '模型分布' },
    { name: 'modelVersions', type: 'json', label: '模型版本列表' },
    { name: 'modelVersionBreakdown', type: 'json', label: '模型版本分布' },
    { name: 'sourceBreakdown', type: 'json', label: '来源分布' },
    { name: 'evidenceHash', type: 'text', index: true, label: '证据 Hash' },
    { name: 'occurrenceCount', type: 'number', defaultValue: 0, label: '出现次数' },
    { name: 'affectedSkillCount', type: 'number', defaultValue: 0, label: '影响 Skill 数' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'observed',
      label: '状态',
      options: [
        { label: '观测中', value: 'observed' },
        { label: '已确认', value: 'confirmed' },
        { label: '已修复', value: 'fixed' },
        { label: '已忽略', value: 'ignored' },
      ],
    },
    { name: 'lastObservedAt', type: 'date', label: '最近观测时间' },
  ],
}
