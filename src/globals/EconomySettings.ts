import type { GlobalConfig } from 'payload'
import { isAdmin, isAdminField } from '@/access'
import { guardEconomySettingsUpdate } from '@/lib/economySettingsGuard'

// 变现经济参数（占位可调，上线前用真实数校准）。read/update 仅管理员；前台经兑换端点取安全子集。
export const EconomySettings: GlobalConfig = {
  slug: 'economy-settings',
  label: '经济设置',
  admin: { group: '系统设置' },
  access: {
    read: isAdmin, // 含毛利等敏感数；前台走 /v1/economy/exchange 的安全 GET
    update: isAdmin,
  },
  fields: [
    {
      name: 'exchangeEnabled',
      type: 'checkbox',
      defaultValue: false,
      label: '开放术值兑换',
    },
    {
      name: 'freeCreditOnRegister',
      type: 'number',
      defaultValue: 0,
      label: '注册赠送 credit（免费额度 F）',
      admin: {
        description:
          '新用户注册即送的试用额度（营销成本，§7A 建议 30-50）。0=不送。赠送的 credit 只能消耗，不产术值',
      },
    },
    {
      name: 'alpha',
      type: 'number',
      defaultValue: 0.3,
      label: '兑换池占毛利比例 α（保命红线，永不亏 margin）',
    },
    {
      name: 'monthlyRealizedMarginCents',
      type: 'number',
      defaultValue: 0,
      label: '当月已实现毛利（分）【占位】',
      admin: {
        description: '接入 New API /api/log 自动回填前手动填；0 = 兑换池空、自动关闭兑换。1 分 = 1 credit',
      },
    },
    {
      name: 'marginSource',
      type: 'select',
      defaultValue: 'manual',
      label: '毛利来源',
      access: { update: isAdminField },
      admin: { description: 'newapi=/api/log 真值；local=本平台 consume 流水估算；manual=手填占位，不允许开放兑换' },
      options: [
        { label: '手动占位', value: 'manual' },
        { label: 'New API 日志', value: 'newapi' },
        { label: '本地流水估算', value: 'local' },
      ],
    },
    {
      name: 'marginReconciledAt',
      type: 'date',
      label: '毛利对账时间',
      access: { update: isAdminField },
      admin: { description: '由 worker:reconcile-newapi 写入；必须是本月对账，兑换开关才生效' },
    },
    {
      name: 'pointsPerCredit',
      type: 'number',
      defaultValue: 10,
      label: '兑换率（多少术值换 1 credit）',
    },
    { name: 'minCreditPerTx', type: 'number', defaultValue: 10, label: '单次最少兑换 credit' },
    { name: 'perTxMaxCredit', type: 'number', defaultValue: 500, label: '单次上限 credit' },
    { name: 'perUserDailyMaxCredit', type: 'number', defaultValue: 1000, label: '单用户每日上限 credit' },
    { name: 'perUserMonthlyMaxCredit', type: 'number', defaultValue: 5000, label: '单用户每月上限 credit' },
  ],
  hooks: {
    beforeChange: [
      ({ data, originalDoc, context }) => guardEconomySettingsUpdate({ data, originalDoc, context }),
    ],
  },
}
