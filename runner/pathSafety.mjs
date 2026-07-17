import path from 'node:path'

export const MAX_SKILL_SLUG_LENGTH = 160

const SAFE_SKILL_SLUG = /^[a-z0-9\u3400-\u4dbf\u4e00-\u9fff](?:[a-z0-9\u3400-\u4dbf\u4e00-\u9fff._-]{0,158}[a-z0-9\u3400-\u4dbf\u4e00-\u9fff])?$/i
const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i

export function normalizeSkillSlug(value) {
  const slug = typeof value === 'string' ? value.trim().normalize('NFKC').toLowerCase() : ''
  if (!slug) throw new Error('Skill slug 不能为空')
  if (slug.length > MAX_SKILL_SLUG_LENGTH) throw new Error(`Skill slug 不能超过 ${MAX_SKILL_SLUG_LENGTH} 个字符`)
  if (!SAFE_SKILL_SLUG.test(slug) || WINDOWS_RESERVED_NAME.test(slug)) {
    throw new Error('Skill slug 非法：仅允许中英文字符、数字及中间的 . _ -，禁止路径和系统保留名')
  }
  return slug
}

export function resolveSkillDir(skillsDir, value) {
  const slug = normalizeSkillSlug(value)
  const root = path.resolve(skillsDir)
  const target = path.resolve(root, slug)
  const relative = path.relative(root, target)
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('Skill 本地路径越界，已拒绝操作')
  }
  return target
}
