import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/access'
import { rowActionsField } from './fields/rowActions'

// 模型官方报价快照（四面墙·成本真值隔离）：排名/双列价用的"官方价"来自此集合(有来源+采集时间)，
// 非平台可在排名代码里编辑的价——杜绝"改价操纵省钱结论"。公开可读(官方价本就公开)。
export const ModelPriceSnapshots: CollectionConfig = {
  slug: 'model-price-snapshots',
  labels: { singular: '模型报价快照', plural: '模型报价快照' },
  admin: {
    useAsTitle: 'model',
    defaultColumns: ['model', 'inputPrice', 'outputPrice', 'currency', 'capturedAt', 'rowActions'],
    group: '系统设置',
  },
  access: {
    read: () => true, // 官方报价公开
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    rowActionsField('model-price-snapshots'),
    { name: 'model', type: 'text', required: true, index: true, label: '模型' },
    { name: 'inputPrice', type: 'number', required: true, label: '输入价(元/1k token)' },
    { name: 'outputPrice', type: 'number', required: true, label: '输出价(元/1k token)' },
    { name: 'currency', type: 'text', defaultValue: 'CNY', label: '币种' },
    { name: 'sourceUrl', type: 'text', label: '官方报价来源' },
    { name: 'capturedAt', type: 'date', label: '采集时间' },
    { name: 'note', type: 'text', label: '备注' },
  ],
}
