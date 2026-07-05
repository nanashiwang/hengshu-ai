import type { Access, FieldAccess, Where } from 'payload'

// 角色等级排序（用于 “创作者及以上” 之类判断）
export const RANK: Record<string, number> = {
  user: 1,
  creator: 2,
  certified_creator: 3,
  reviewer: 4,
  enterprise_admin: 4,
  admin: 100,
}

export function isActiveAccount(user: unknown): user is { id: string; role?: string; accountStatus?: string | null } {
  return Boolean(user && (user as any).accountStatus !== 'banned')
}

// ───────────── 集合级 Access ─────────────

export const isLoggedIn: Access = ({ req: { user } }) => isActiveAccount(user)

export const isAdmin: Access = ({ req: { user } }) => isActiveAccount(user) && user?.role === 'admin'

export const isReviewerOrAdmin: Access = ({ req: { user } }) =>
  Boolean(isActiveAccount(user) && (user?.role === 'admin' || user?.role === 'reviewer'))

export const isCreatorOrAbove: Access = ({ req: { user } }) =>
  Boolean(isActiveAccount(user) && (RANK[user?.role as string] ?? 0) >= RANK.creator)

/** Users 集合：管理员读全部，普通用户仅自己 */
export const adminOrSelf: Access = ({ req: { user } }) => {
  if (!isActiveAccount(user)) return false
  if (user.role === 'admin') return true
  return { id: { equals: user.id } }
}

/** 拥有者或管理员（按关系字段过滤，默认 user）。未登录拒绝 */
export const ownerOrAdmin =
  (field = 'user'): Access =>
  ({ req: { user } }) => {
    if (!isActiveAccount(user)) return false
    if (user.role === 'admin') return true
    return { [field]: { equals: user.id } }
  }

/** Skills 读取：已发布且公开对所有人可见；作者/审核/管理可见其余状态 */
export const publishedOrPrivileged: Access = ({ req: { user } }) => {
  if (isActiveAccount(user) && (user?.role === 'admin' || user?.role === 'reviewer')) return true
  const publicPublished: Where = {
    and: [{ status: { equals: 'published' } }, { visibility: { equals: 'public' } }],
  }
  if (isActiveAccount(user)) {
    const result: Where = { or: [publicPublished, { author: { equals: user.id } }] }
    return result
  }
  return publicPublished
}


/** SkillVersions 读取：公开已发布 Skill 的版本可读；作者/审核/管理可读草稿/待审版本。 */
export const readableSkillVersion: Access = ({ req: { user } }) => {
  if (isActiveAccount(user) && (user?.role === 'admin' || user?.role === 'reviewer')) return true
  const publicPublished: Where = {
    and: [
      { 'skill.status': { equals: 'published' } },
      { 'skill.visibility': { equals: 'public' } },
    ],
  }
  if (isActiveAccount(user)) return { or: [publicPublished, { 'skill.author': { equals: user.id } }] } as Where
  return publicPublished
}

/** SkillVersions 写入：管理/审核放行；其余登录用户仅限"所属 Skill 是自己作品"的版本（按 skill.author 过滤）。
 *  修复越权：此前 update 用 isCreatorOrAbove 返回布尔 true，任何 creator 可改他人版本的 prompt 劫持在线运行。 */
export const ownSkillVersionOrStaff: Access = ({ req: { user } }) => {
  if (!isActiveAccount(user)) return false
  if (user.role === 'admin' || user.role === 'reviewer') return true
  return { 'skill.author': { equals: user.id } } as Where
}

// ───────────── 字段级 Access ─────────────

export const isAdminField: FieldAccess = ({ req: { user } }) => isActiveAccount(user) && user?.role === 'admin'

/** 字段级：管理员或本人（按文档 id 比对，用于 Users 敏感字段） */
export const fieldAdminOrSelf: FieldAccess = ({ req: { user }, id }) => {
  if (!isActiveAccount(user)) return false
  if (user.role === 'admin') return true
  return user.id === id
}
