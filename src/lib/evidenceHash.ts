import { createHash } from 'crypto'
import { canonicalString } from './canonical'

// 对公开证据摘要做稳定 hash；后续可升级为签名快照/外部时间戳。
export function evidenceHash(value: unknown): string {
  return createHash('sha256').update(canonicalString(value)).digest('hex')
}
