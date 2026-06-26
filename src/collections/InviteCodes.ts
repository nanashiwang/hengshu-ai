import type { CollectionConfig } from 'payload'
import { isAdmin, isLoggedIn, ownerOrAdmin } from '@/access'
import { generateInviteCode } from '@/lib/slug'

export const InviteCodes: CollectionConfig = {
  slug: 'invite-codes',
  labels: { singular: '邀请码', plural: '邀请码' },
  admin: {
    useAsTitle: 'code',
    defaultColumns: ['code', 'inviter', 'usedBy', 'status', 'expiresAt'],
    group: '用户与社区',
  },
  access: {
    read: ownerOrAdmin('inviter'),
    create: isLoggedIn,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'code',
      type: 'text',
      unique: true,
      index: true,
      label: '邀请码',
      admin: { readOnly: true },
    },
    {
      name: 'inviter',
      type: 'relationship',
      relationTo: 'users',
      label: '邀请人',
      admin: { readOnly: true },
    },
    {
      name: 'usedBy',
      type: 'relationship',
      relationTo: 'users',
      label: '使用人',
      admin: { readOnly: true },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'unused',
      label: '状态',
      options: [
        { label: '未使用', value: 'unused' },
        { label: '已使用', value: 'used' },
        { label: '已过期', value: 'expired' },
        { label: '已撤销', value: 'revoked' },
      ],
    },
    { name: 'minLevelRequired', type: 'number', defaultValue: 1, label: '使用门槛（等级）' },
    { name: 'expiresAt', type: 'date', label: '过期时间' },
  ],
  hooks: {
    beforeChange: [
      ({ data, req, operation }) => {
        if (operation === 'create') {
          if (!data.code) data.code = generateInviteCode()
          if (!data.inviter && req.user) data.inviter = req.user.id
        }
        return data
      },
    ],
  },
}
