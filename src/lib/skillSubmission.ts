export function normalizeSkillSubmissionKey(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  // 客户端幂等键：短 ASCII token，避免异常输入污染唯一索引/日志。
  return /^[A-Za-z0-9._:-]{16,128}$/.test(raw) ? raw : ''
}
