import { hmacDigest } from './secrets'
import { normalizeCreditAmount, validateCreditTxAmount } from './credit'

export function normalizeRechargeCode(value: string): string {
  return String(value || '')
    .trim()
    .replace(/[\s-]+/g, '')
    .toUpperCase()
}

export function rechargeCodeDigest(value: string): string {
  const normalized = normalizeRechargeCode(value)
  return normalized ? hmacDigest(normalized, 'recharge-code') : ''
}

export function maskRechargeCode(value: string): string {
  const normalized = normalizeRechargeCode(value)
  if (!normalized) return ''
  if (normalized.length <= 8) return `${normalized.slice(0, 2)}****`
  return `${normalized.slice(0, 4)}****${normalized.slice(-4)}`
}

export function resolveRechargeCreditAmount(value: unknown): number {
  const amount = Number(value)
  const error = validateCreditTxAmount('recharge', amount)
  if (error) throw new Error(`充值码金额无效：${error}`)
  return normalizeCreditAmount(amount)
}
