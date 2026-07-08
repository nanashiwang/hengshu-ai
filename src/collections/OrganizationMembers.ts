import type { Access, CollectionConfig, Where } from 'payload'
import { APIError } from 'payload'
import { isActiveAccount, isAdmin } from '@/access'
import { rowActionsField } from './fields/rowActions'

const memberAccess: Access = ({ req: { user } }) => {
  if (!isActiveAccount(user)) return false
  if (user.role === 'admin') return true
  if (user.role === 'enterprise_admin') {
    return { or: [{ user: { equals: user.id } } as Where, { 'organization.owner': { equals: user.id } } as Where] } as Where
  }
  return { user: { equals: user.id } }
}

function relationId(value: unknown): string | undefined {
  if (!value) return undefined
  return typeof value === 'object' ? String((value as any).id || '') || undefined : String(value)
}

// Organization Member：企业成员关系。组织 owner 仍在 Organizations；这里承载员工/审批员/审计员。
export const OrganizationMembers: CollectionConfig = {
  slug: 'organization-members',
  labels: { singular: '组织成员', plural: '组织成员' },
  indexes: [{ fields: ['organization', 'user'] }],
  admin: {
    useAsTitle: 'role',
    defaultColumns: ['organization', 'user', 'role', 'status', 'rowActions'],
    group: '企业治理',
    description: '组织成员、角色与状态，用于 Enterprise Registry 运行授权。',
  },
  access: {
    read: memberAccess,
    create: ({ req: { user } }) => Boolean(isActiveAccount(user) && (user.role === 'admin' || user.role === 'enterprise_admin')),
    update: ({ req: { user } }) => Boolean(isActiveAccount(user) && (user.role === 'admin' || user.role === 'enterprise_admin')),
    delete: isAdmin,
  },
  fields: [
    rowActionsField('organization-members'),
    { name: 'organization', type: 'relationship', relationTo: 'organizations', required: true, index: true, label: '组织' },
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true, label: '用户' },
    {
      name: 'role',
      type: 'select',
      defaultValue: 'member',
      label: '组织角色',
      options: [
        { label: '成员', value: 'member' },
        { label: '审批员', value: 'approver' },
        { label: '审计员', value: 'auditor' },
        { label: '管理员', value: 'admin' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      label: '状态',
      options: [
        { label: '正常', value: 'active' },
        { label: '暂停', value: 'suspended' },
      ],
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ data, originalDoc, req }) => {
        const user = req.user as any
        // 服务端企业 API / SCIM 已在 lib/enterprise.ts 做组织级鉴权，overrideAccess 写入时不重复拦截。
        if (!user) return data
        if (user.role === 'admin') return data
        if (user.role !== 'enterprise_admin') throw new APIError('无权维护组织成员', 403)

        const organizationId = relationId(data?.organization ?? originalDoc?.organization)
        if (!organizationId) return data
        const org = await req.payload
          .findByID({ collection: 'organizations', id: organizationId, depth: 0, overrideAccess: true, req })
          .catch(() => null) as any
        const ownerId = relationId(org?.owner)
        if (!ownerId || String(ownerId) !== String(user.id)) {
          throw new APIError('只能维护自己负责组织的成员', 403)
        }
        return data
      },
    ],
  },
}
