// 生成 URL slug：保留 ASCII 字母数字与中文，其余转连字符
export function slugify(input: string): string {
  const base = (input || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (base) return base
  return `item-${Math.random().toString(36).slice(2, 8)}`
}

// 生成邀请码：8 位大写字母数字
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// 生成运行 ID
export function generateRunId(): string {
  return `run_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}
