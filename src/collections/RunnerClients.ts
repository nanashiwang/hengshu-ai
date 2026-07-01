import type { CollectionConfig } from 'payload'
import { isAdmin, ownerOrAdmin } from '@/access'
import { rowActionsField } from './fields/rowActions'

// 一台已登录的 Runner 实例（设备）。install / 兼容报告等写操作据此归属用户、做反作弊。
export const RunnerClients: CollectionConfig = {
  slug: 'runner-clients',
  labels: { singular: 'Runner 实例', plural: 'Runner 实例' },
  admin: {
    useAsTitle: 'runnerId',
    defaultColumns: ['user', 'runnerId', 'runnerVersion', 'os', 'trustedLevel', 'lastSeenAt', 'rowActions'],
    group: '成员管理',
  },
  access: {
    read: ownerOrAdmin('user'),
    create: isAdmin, // 仅服务端 overrideAccess 创建
    update: isAdmin,
    delete: ownerOrAdmin('user'),
  },
  fields: [
    rowActionsField('runner-clients'),
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, label: '用户' },
    { name: 'runnerId', type: 'text', required: true, unique: true, index: true, label: 'Runner ID' },
    {
      name: 'token',
      type: 'text',
      index: true,
      label: '访问令牌',
      access: { read: () => false }, // 任何 API 响应都不返回（overrideAccess 例外）
      admin: { hidden: true },
    },
    { name: 'runnerVersion', type: 'text', label: '版本' },
    { name: 'os', type: 'text', label: '系统' },
    { name: 'arch', type: 'text', label: '架构' },
    { name: 'label', type: 'text', label: '名称/主机' },
    { name: 'anonymousMode', type: 'checkbox', defaultValue: false, label: '匿名模式' },
    {
      name: 'trustedLevel',
      type: 'select',
      defaultValue: 'community',
      label: '信任级别',
      options: [
        { label: '社区', value: 'community' },
        { label: '已验证', value: 'verified' },
      ],
    },
    { name: 'lastSeenAt', type: 'date', label: '最近活跃' },
  ],
  hooks: {
    beforeDelete: [
      async ({ id, req }) => {
        // 删 Runner 前解除引用，避免 skill-installs / compat-reports 的 runner 悬空
        await req.payload.update({
          collection: 'skill-installs',
          where: { runner: { equals: id } },
          data: { runner: null },
          overrideAccess: true,
          req,
        })
        await req.payload.update({
          collection: 'compat-reports',
          where: { runner: { equals: id } },
          data: { runner: null },
          overrideAccess: true,
          req,
        })
        await req.payload.update({
          collection: 'device-codes',
          where: { runnerClient: { equals: id } },
          data: { runnerClient: null },
          overrideAccess: true,
          req,
        })
      },
    ],
  },
}
