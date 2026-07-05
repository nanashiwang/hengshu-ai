import { createHash } from 'node:crypto'
import type { Payload } from 'payload'

export const LEDGER_LOCK_NAMESPACES = {
  credit: 4_772_001,
  contribution: 4_772_002,
  inviteCode: 4_772_003,
} as const

export type LedgerLockKind = keyof typeof LEDGER_LOCK_NAMESPACES

export function advisoryHashKey(value: string): number {
  const n = createHash('sha256').update(value).digest().readUInt32BE(0)
  return n & 0x7fffffff
}

// 同一用户同一账本串行化，防 read-modify-write 丢更新；key 只拼接数字，避免 SQL 注入。
export async function acquireUserLedgerLock(
  payload: Payload,
  transactionID: string | number,
  kind: LedgerLockKind,
  userId: string,
): Promise<void> {
  const session = (payload.db as any).sessions?.[transactionID]
  if (!session?.db) throw new Error('事务会话不可用，无法加用户账本锁')
  const namespace = LEDGER_LOCK_NAMESPACES[kind]
  const key = advisoryHashKey(userId)
  await (payload.db as any).execute({
    db: session.db,
    raw: `SELECT pg_advisory_xact_lock(${namespace}, ${key})`,
  })
}

// 同一邀请码注册关键区串行化：防并发请求同时看到 unused 后双建用户。
export async function acquireInviteCodeLock(
  payload: Payload,
  transactionID: string | number,
  inviteCode: string,
): Promise<void> {
  const session = (payload.db as any).sessions?.[transactionID]
  if (!session?.db) throw new Error('事务会话不可用，无法加邀请码锁')
  const namespace = LEDGER_LOCK_NAMESPACES.inviteCode
  const key = advisoryHashKey(inviteCode.trim().toUpperCase())
  await (payload.db as any).execute({
    db: session.db,
    raw: `SELECT pg_advisory_xact_lock(${namespace}, ${key})`,
  })
}
