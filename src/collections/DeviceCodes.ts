import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/access'

// OAuth Device Code 流程的临时凭据（系统内部用，admin 隐藏）。
export const DeviceCodes: CollectionConfig = {
  slug: 'device-codes',
  labels: { singular: '设备码', plural: '设备码' },
  admin: { hidden: true },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    { name: 'deviceCode', type: 'text', index: true, required: true },
    { name: 'userCode', type: 'text', index: true, required: true },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'pending', value: 'pending' },
        { label: 'authorized', value: 'authorized' },
        { label: 'denied', value: 'denied' },
        { label: 'consumed', value: 'consumed' },
      ],
    },
    { name: 'user', type: 'relationship', relationTo: 'users' },
    { name: 'runnerClient', type: 'relationship', relationTo: 'runner-clients' },
    { name: 'meta', type: 'json' }, // 申请时上报的 runnerVersion/os/arch
    { name: 'expiresAt', type: 'date' },
  ],
}
