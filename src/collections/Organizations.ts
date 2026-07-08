import type { Access, CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { isActiveAccount, isAdmin, isAdminField } from '@/access'
import { rowActionsField } from './fields/rowActions'

const orgAdminOrOwner: Access = ({ req: { user } }) => {
  if (!isActiveAccount(user)) return false
  if (user.role === 'admin') return true
  if (user.role === 'enterprise_admin') return { owner: { equals: user.id } }
  return false
}

// Organization：Enterprise Registry 的租户边界；identityPolicy 先承接 SSO/SCIM 配置骨架。
export const Organizations: CollectionConfig = {
  slug: 'organizations',
  labels: { singular: '组织', plural: '组织' },
  indexes: [{ fields: ['slug'] }],
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'owner', 'plan', 'status', 'rowActions'],
    group: '企业治理',
    description: '企业/团队租户，Enterprise Registry 的隔离边界。',
  },
  access: {
    read: orgAdminOrOwner,
    create: ({ req: { user } }) => Boolean(isActiveAccount(user) && (user.role === 'admin' || user.role === 'enterprise_admin')),
    update: orgAdminOrOwner,
    delete: isAdmin,
  },
  fields: [
    rowActionsField('organizations'),
    { name: 'name', type: 'text', required: true, label: '组织名称' },
    { name: 'slug', type: 'text', required: true, unique: true, index: true, label: 'Slug' },
    { name: 'owner', type: 'relationship', relationTo: 'users', required: true, index: true, label: '负责人' },
    {
      name: 'plan',
      type: 'select',
      defaultValue: 'team',
      label: '套餐',
      options: [
        { label: 'Team', value: 'team' },
        { label: 'Enterprise', value: 'enterprise' },
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
    { name: 'modelAllowlist', type: 'json', label: '模型白名单' },
    { name: 'policy', type: 'json', label: '组织策略包' },
    {
      name: 'identityPolicy',
      type: 'json',
      label: '身份策略 / SSO / SCIM',
      access: { read: isAdminField, update: isAdminField },
      admin: {
        description: '企业身份治理骨架；企业管理员请走控制台身份策略面板，避免 REST 直接暴露 SCIM tokenDigest。',
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, req, operation }) => {
        const user = req.user as any
        if (operation === 'create' && user && !data.owner) data.owner = user.id
        if (operation === 'create' && user?.role === 'enterprise_admin' && String(data.owner) !== String(user.id)) {
          throw new APIError('企业管理员只能创建自己负责的组织', 403)
        }
        return data
      },
    ],
  },
}
