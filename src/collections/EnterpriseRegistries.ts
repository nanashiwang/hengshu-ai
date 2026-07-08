import type { Access, CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { isActiveAccount, isAdmin } from '@/access'
import { rowActionsField } from './fields/rowActions'

const registryAccess: Access = ({ req: { user } }) => {
  if (!isActiveAccount(user)) return false
  if (user.role === 'admin') return true
  if (user.role === 'enterprise_admin') return { 'organization.owner': { equals: user.id } }
  return false
}

function relationId(value: unknown): string | undefined {
  if (!value) return undefined
  return typeof value === 'object' ? String((value as any).id || '') || undefined : String(value)
}

// Enterprise Registry：企业批准哪些 Skill/版本/模型可用的最小治理表。
export const EnterpriseRegistries: CollectionConfig = {
  slug: 'enterprise-registries',
  labels: { singular: '企业注册表', plural: '企业注册表' },
  indexes: [{ fields: ['organization', 'skill'] }],
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'organization', 'skill', 'approvalStatus', 'approvedBy', 'rowActions'],
    group: '企业治理',
    description: '企业 AI Skill 注册表：审批、版本锁定、模型白名单与审计治理入口。',
  },
  access: {
    read: registryAccess,
    create: registryAccess,
    update: registryAccess,
    delete: isAdmin,
  },
  fields: [
    rowActionsField('enterprise-registries'),
    { name: 'name', type: 'text', required: true, label: '名称' },
    { name: 'organization', type: 'relationship', relationTo: 'organizations', required: true, index: true, label: '组织' },
    { name: 'skill', type: 'relationship', relationTo: 'skills', required: true, index: true, label: 'Skill' },
    { name: 'skillVersion', type: 'relationship', relationTo: 'skill-versions', label: '锁定版本' },
    { name: 'passport', type: 'relationship', relationTo: 'skill-passports', label: '采用时 Passport' },
    {
      name: 'approvalStatus',
      type: 'select',
      defaultValue: 'pending',
      label: '审批状态',
      options: [
        { label: '待审批', value: 'pending' },
        { label: '已批准', value: 'approved' },
        { label: '已限制', value: 'restricted' },
        { label: '已禁用', value: 'disabled' },
        { label: '已废弃', value: 'deprecated' },
      ],
    },
    { name: 'approvedBy', type: 'relationship', relationTo: 'users', label: '审批人' },
    { name: 'approvedAt', type: 'date', label: '审批时间' },
    { name: 'modelAllowlist', type: 'json', label: '该 Skill 允许模型' },
    { name: 'usageScope', type: 'textarea', label: '使用范围' },
    { name: 'riskNotes', type: 'textarea', label: '风险备注' },
    { name: 'auditPolicy', type: 'json', label: '审计策略' },
    {
      name: 'adoptionBaseline',
      type: 'json',
      label: '企业采用基线',
      admin: { description: '批准时冻结 Contract/Passport/证书摘要，用于后续版本漂移和重新审批判断。' },
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ data, originalDoc, req }) => {
        const user = req.user as any
        // 企业 API 已通过 canManageOrganization 鉴权后 overrideAccess 写入；这里兜住直连 Payload Admin/REST。
        if (!user) return data
        if (user.role === 'admin') return data
        if (user.role !== 'enterprise_admin') throw new APIError('无权维护企业注册表', 403)

        const organizationId = relationId(data?.organization ?? originalDoc?.organization)
        if (!organizationId) return data
        const org = await req.payload
          .findByID({ collection: 'organizations', id: organizationId, depth: 0, overrideAccess: true, req })
          .catch(() => null) as any
        const ownerId = relationId(org?.owner)
        if (!ownerId || String(ownerId) !== String(user.id)) {
          throw new APIError('只能维护自己负责组织的注册表', 403)
        }

        const skillId = relationId(data?.skill ?? originalDoc?.skill)
        const versionId = relationId(data?.skillVersion ?? originalDoc?.skillVersion)
        if (skillId && versionId) {
          const version = await req.payload
            .findByID({ collection: 'skill-versions', id: versionId, depth: 0, overrideAccess: true, req })
            .catch(() => null) as any
          if (!version || relationId(version.skill) !== skillId) {
            throw new APIError('企业注册表锁定版本不属于该 Skill', 400)
          }
        }

        const passportId = relationId(data?.passport ?? originalDoc?.passport)
        if (skillId && passportId) {
          const passport = await req.payload
            .findByID({ collection: 'skill-passports', id: passportId, depth: 0, overrideAccess: true, req })
            .catch(() => null) as any
          if (!passport || relationId(passport.skill) !== skillId) {
            throw new APIError('企业注册表采用的 Passport 不属于该 Skill', 400)
          }
        }
        return data
      },
    ],
    beforeChange: [
      ({ data, req }) => {
        if (data.approvalStatus === 'approved' && req.user && !data.approvedBy) {
          data.approvedBy = req.user.id
          data.approvedAt = new Date().toISOString()
        }
        return data
      },
    ],
  },
}
