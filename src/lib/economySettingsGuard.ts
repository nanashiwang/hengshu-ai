const MARGIN_RECONCILE_CONTEXT = 'economyMarginReconcile'
const PROTECTED_MARGIN_FIELDS = ['marginSource', 'marginReconciledAt'] as const

type Data = Record<string, any>

export function economyMarginReconcileContext(): Record<string, true> {
  return { [MARGIN_RECONCILE_CONTEXT]: true }
}

export function isEconomyMarginReconcileContext(context: unknown): boolean {
  return !!context && typeof context === 'object' && (context as Record<string, unknown>)[MARGIN_RECONCILE_CONTEXT] === true
}

function changed(data: Data, original: Data | undefined, field: string): boolean {
  if (!(field in data)) return false
  const prev = original?.[field]
  const next = data[field]
  const prevTime = prev instanceof Date ? prev.toISOString() : prev
  const nextTime = next instanceof Date ? next.toISOString() : next
  return String(prevTime ?? '') !== String(nextTime ?? '')
}

function safeInitialProtectedValue(field: (typeof PROTECTED_MARGIN_FIELDS)[number], value: unknown): boolean {
  if (field === 'marginSource') return value === undefined || value === null || value === '' || value === 'manual'
  return value === undefined || value === null || value === ''
}

export function guardEconomySettingsUpdate(args: {
  context?: unknown
  data: Data
  originalDoc?: Data
}): Data {
  if (isEconomyMarginReconcileContext(args.context)) return args.data

  for (const field of PROTECTED_MARGIN_FIELDS) {
    if (changed(args.data, args.originalDoc, field)) {
      // Payload 初始化 global 时可能把字段默认值一起送进 beforeChange；只放过安全默认值。
      if (args.originalDoc?.[field] == null && safeInitialProtectedValue(field, args.data[field])) continue
      throw new Error('毛利来源与对账时间只能由 worker:reconcile-newapi 写入')
    }
  }

  // 管理员可手填毛利占位用于观察池规模，但必须降级为 manual 且清空对账时间，不能伪造成机器真值。
  if (changed(args.data, args.originalDoc, 'monthlyRealizedMarginCents')) {
    args.data.marginSource = 'manual'
    args.data.marginReconciledAt = null
  }
  return args.data
}
