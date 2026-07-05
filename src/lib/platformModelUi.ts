export type ModelPaymentKind = 'platform' | 'byok' | 'requires_byok'

export interface ModelPaymentMeta {
  kind: ModelPaymentKind
  label: string
  disabled: boolean
  help: string
}

export function modelPaymentMeta(model: string, platformModels: readonly string[], hasByok: boolean): ModelPaymentMeta {
  if (platformModels.includes(model)) {
    return {
      kind: 'platform',
      label: '平台代付',
      disabled: false,
      help: '未绑定 BYOK 时也可用，将消耗 credit。',
    }
  }
  if (hasByok) {
    return {
      kind: 'byok',
      label: 'BYOK',
      disabled: false,
      help: '该模型仅通过你的自带 Key 调用，平台不代付。',
    }
  }
  return {
    kind: 'requires_byok',
    label: '需 BYOK',
    disabled: true,
    help: '该模型不在平台代付白名单内，需先到设置绑定自带 Key。',
  }
}
