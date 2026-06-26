// 输入字段定义与输出格式校验

export interface InputFieldDef {
  type?: string // string | text | number | select
  label?: string
  required?: boolean
  options?: Array<string | { label?: string; value?: string }>
  placeholder?: string
}
export type InputSchema = Record<string, InputFieldDef>

export function validateInput(
  schema: InputSchema | null | undefined,
  input: Record<string, unknown>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (!schema || typeof schema !== 'object') return { valid: true, errors }
  for (const [key, def] of Object.entries(schema)) {
    const val = input[key]
    const label = def.label || key
    if (def.required && (val == null || val === '')) {
      errors.push(`缺少必填字段：${label}`)
      continue
    }
    if (val == null || val === '') continue
    if (def.type === 'number' && isNaN(Number(val))) {
      errors.push(`字段「${label}」应为数字`)
    }
    if (def.type === 'select' && Array.isArray(def.options)) {
      const opts = def.options.map((o) => (typeof o === 'string' ? o : (o.value ?? o.label)))
      if (!opts.includes(val as string)) errors.push(`字段「${label}」取值非法`)
    }
  }
  return { valid: errors.length === 0, errors }
}

export function checkOutputFormat(
  outputSchema: any,
  outputText: string,
): { formatValid: boolean; outputJson: any } {
  if (!outputSchema || typeof outputSchema !== 'object' || Object.keys(outputSchema).length === 0) {
    return { formatValid: true, outputJson: null } // 未声明结构化输出 → 视为有效
  }
  const parsed = tryExtractJson(outputText)
  if (!parsed || typeof parsed !== 'object') return { formatValid: false, outputJson: null }
  const keys = Object.keys(outputSchema)
  const ok = keys.every((k) => k in parsed)
  return { formatValid: ok, outputJson: parsed }
}

function tryExtractJson(text: string): any | null {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    /* noop */
  }
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) {
    try {
      return JSON.parse(fence[1])
    } catch {
      /* noop */
    }
  }
  const brace = text.match(/\{[\s\S]*\}/)
  if (brace) {
    try {
      return JSON.parse(brace[0])
    } catch {
      /* noop */
    }
  }
  return null
}
