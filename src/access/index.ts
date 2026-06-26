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

// ───────────── 集合级 Access ─────────────

export const isLoggedIn: Access = ({ req: { user } }) => Boolean(user)

export const isAdmin: Access = ({ req: { user } }) => user?.role === 'admin'

export const isReviewerOrAdmin: Access = ({ req: { user } }) =>
  Boolean(user && (user.role === 'admin' || user.role === 'reviewer'))

export const isCreatorOrAbove: Access = ({ req: { user } }) =>
  Boolean(user && (RANK[user.role as string] ?? 0) >= RANK.creator)

/** Users 集合：管理员读全部，普通用户仅自己 */
export const adminOrSelf: Access = ({ req: { user } }) => {
  if (!user) return false
  if (user.role === 'admin') return true
  return { id: { equals: user.id } }
}

/** 拥有者或管理员（按关系字段过滤，默认 user）。未登录拒绝 */
export const ownerOrAdmin =
  (field = 'user'): Access =>
  ({ req: { user } }) => {
    if (!user) return false
    if (user.role === 'admin') return true
    return { [field]: { equals: user.id } }
  }

/** Skills 读取：已发布且公开对所有人可见；作者/审核/管理可见其余状态 */
export const publishedOrPrivileged: Access = ({ req: { user } }) => {
  if (user && (user.role === 'admin' || user.role === 'reviewer')) return true
  const publicPublished: Where = {
    and: [{ status: { equals: 'published' } }, { visibility: { equals: 'public' } }],
  }
  if (user) {
    const result: Where = { or: [publicPublished, { author: { equals: user.id } }] }
    return result
  }
  return publicPublished
}

// ───────────── 字段级 Access ─────────────

export const isAdminField: FieldAccess = ({ req: { user } }) => user?.role === 'admin'

/** 字段级：管理员或本人（按文档 id 比对，用于 Users 敏感字段） */
export const fieldAdminOrSelf: FieldAccess = ({ req: { user }, id }) => {
  if (!user) return false
  if (user.role === 'admin') return true
  return user.id === id
}
