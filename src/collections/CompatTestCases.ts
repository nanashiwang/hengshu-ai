import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { isAdmin, isCreatorOrAbove, ownSkillVersionOrStaff } from '@/access'
import { rowActionsField } from './fields/rowActions'

function relationId(value: unknown): string | undefined {
  if (!value) return undefined
  return typeof value === 'object' ? String((value as any).id || '') || undefined : String(value)
}

// Compat Test Case：可重复运行的兼容测试样例，比 examples 更适合 benchmark 和回归。
export const CompatTestCases: CollectionConfig = {
  slug: 'compat-test-cases',
  labels: { singular: '兼容测试样例', plural: '兼容测试样例' },
  indexes: [{ fields: ['skill', 'enabled'] }],
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'skill', 'caseType', 'enabled', 'rowActions'],
    group: '可信与兼容',
    description: '用于系统 benchmark 的 Skill 兼容测试样例。',
  },
  access: {
    read: ownSkillVersionOrStaff,
    create: isCreatorOrAbove,
    update: isCreatorOrAbove,
    delete: isAdmin,
  },
  fields: [
    rowActionsField('compat-test-cases'),
    { name: 'title', type: 'text', required: true, label: '标题' },
    { name: 'skill', type: 'relationship', relationTo: 'skills', required: true, index: true, label: 'Skill' },
    { name: 'skillVersion', type: 'relationship', relationTo: 'skill-versions', label: '适用版本' },
    {
      name: 'caseType',
      type: 'select',
      defaultValue: 'normal',
      label: '样例类型',
      options: [
        { label: '普通输入', value: 'normal' },
        { label: '边界输入', value: 'edge' },
        { label: '长文本', value: 'long_context' },
        { label: '结构化输出压力', value: 'structured_output' },
        { label: '安全/误用测试', value: 'safety' },
      ],
    },
    { name: 'inputJson', type: 'json', required: true, label: '测试输入' },
    { name: 'expectedOutputShape', type: 'json', label: '期望输出形状' },
    { name: 'requiredOutputPaths', type: 'json', label: '必需输出路径', admin: { description: '如 ["title", "items.0.name"]；benchmark 会逐条检查。' } },
    { name: 'expectedTextIncludes', type: 'json', label: '输出应包含文本', admin: { description: '字符串数组；适用于非 JSON 输出的黄金样例打分。' } },
    { name: 'minScore', type: 'number', defaultValue: 0.8, label: '通过分', admin: { description: '0-1；低于该分数视为该黄金样例未达标。' } },
    { name: 'rubric', type: 'textarea', label: '判定标准' },
    { name: 'enabled', type: 'checkbox', defaultValue: true, index: true, label: '启用' },
    { name: 'lastRunAt', type: 'date', label: '最近运行时间' },
  ],
  hooks: {
    beforeValidate: [
      async ({ data, originalDoc, req }) => {
        const merged = { ...(originalDoc || {}), ...(data || {}) }
        const skillId = relationId(merged.skill)
        if (!skillId) return data

        const skill = await req.payload
          .findByID({ collection: 'skills', id: skillId, overrideAccess: true, depth: 0, req })
          .catch(() => null) as any
        if (!skill) throw new APIError('测试样例关联的 Skill 不存在', 400)

        const user = req.user as any
        if (user && !['admin', 'reviewer'].includes(String(user.role || ''))) {
          const authorId = relationId(skill.author)
          if (!authorId || String(authorId) !== String(user.id)) {
            throw new APIError('无权为他人的 Skill 创建或修改测试样例', 403)
          }
        }

        const skillVersionId = relationId(merged.skillVersion)
        if (skillVersionId) {
          const version = await req.payload
            .findByID({ collection: 'skill-versions', id: skillVersionId, overrideAccess: true, depth: 0, req })
            .catch(() => null) as any
          if (!version || relationId(version.skill) !== skillId) {
            throw new APIError('测试样例关联的 SkillVersion 不属于该 Skill', 400)
          }
        }
        return data
      },
    ],
  },
}
