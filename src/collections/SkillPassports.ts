import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/access'
import { rowActionsField } from './fields/rowActions'

// Skill Passport：Skill 的可信档案。先落 schema，后续由 backfill/运行回流持续刷新。
export const SkillPassports: CollectionConfig = {
  slug: 'skill-passports',
  labels: { singular: 'Skill Passport', plural: 'Skill Passports' },
  indexes: [{ fields: ['skill', 'status'] }],
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'skill', 'status', 'trustScore', 'lastVerifiedAt', 'rowActions'],
    group: '可信与兼容',
    description: 'Skill 的身份、签名、兼容证据、失败记录与治理状态。',
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    rowActionsField('skill-passports'),
    { name: 'title', type: 'text', required: true, label: '标题' },
    { name: 'skill', type: 'relationship', relationTo: 'skills', required: true, unique: true, index: true, label: 'Skill' },
    { name: 'skillVersion', type: 'relationship', relationTo: 'skill-versions', label: '版本' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      index: true,
      label: 'Passport 状态',
      options: [
        { label: '草稿', value: 'draft' },
        { label: '当前有效', value: 'current' },
        { label: '证据过期', value: 'stale' },
        { label: '已撤销', value: 'revoked' },
      ],
    },
    {
      name: 'skillClass',
      type: 'select',
      defaultValue: 'imported',
      label: 'Skill 分级',
      options: [
        { label: 'Verified Skill', value: 'verified' },
        { label: 'Imported Skill', value: 'imported' },
        { label: 'High-risk Skill', value: 'high_risk' },
        { label: 'Rejected Skill', value: 'rejected' },
      ],
    },
    { name: 'trustScore', type: 'number', defaultValue: 0, label: '可信分(0-100)' },
    { name: 'signatureStatus', type: 'text', label: '签名状态' },
    { name: 'manifestChecksum', type: 'text', label: 'Manifest/包校验和' },
    { name: 'capabilitySummary', type: 'json', label: '能力摘要' },
    { name: 'compatibilitySummary', type: 'json', label: '兼容摘要' },
    { name: 'reliabilitySummary', type: 'json', label: '可靠性摘要' },
    { name: 'safetySummary', type: 'json', label: '安全/权限摘要' },
    { name: 'failureSummary', type: 'json', label: '失败摘要' },
    { name: 'evidenceSummary', type: 'json', label: '证据摘要' },
    { name: 'evidenceHash', type: 'text', index: true, label: '证据 Hash' },
    { name: 'enterpriseSummary', type: 'json', label: '企业治理摘要' },
    { name: 'lastVerifiedAt', type: 'date', label: '最近验证时间' },
  ],
}
