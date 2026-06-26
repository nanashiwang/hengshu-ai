// 渲染 Prompt 模板：安全替换 {{变量名}}（无代码执行）
export function renderTemplate(template: string, vars: Record<string, unknown>): string {
  return (template || '').replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, key: string) => {
    const v = vars[key]
    if (v == null) return ''
    return typeof v === 'string' ? v : JSON.stringify(v)
  })
}
