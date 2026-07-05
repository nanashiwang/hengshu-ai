import { approvedPlatformFallback, approvedPlatformModels } from './constants'
import { getCreditToQuota } from './newapiAdmin'

const DEFAULT_CALIBRATION_CREDITS = 1
const MIN_CALIBRATION_CREDITS = 0.01
const MAX_CALIBRATION_CREDITS = 10

export function isSafeCalibrationUserId(userId: string | undefined): boolean {
  return /^calib-[a-z0-9][a-z0-9-]{2,60}$/i.test((userId || '').trim())
}

export function resolveCalibrationModel(env: Record<string, string | undefined> = process.env): string | null {
  const preferred = env.NEWAPI_CALIBRATE_MODEL || env.MODEL_GATEWAY_DEFAULT_MODEL || 'deepseek-chat'
  return approvedPlatformFallback(preferred, env)
}

export function resolveCalibrationCredits(env: Record<string, string | undefined> = process.env): number {
  const raw = env.NEWAPI_CALIBRATE_CREDITS?.trim()
  const credits = raw ? Number(raw) : DEFAULT_CALIBRATION_CREDITS
  if (!Number.isFinite(credits) || credits < MIN_CALIBRATION_CREDITS || credits > MAX_CALIBRATION_CREDITS) {
    throw new Error('NEWAPI_CALIBRATE_CREDITS 必须是 0.01-10 之间的数字，禁止非法或超额真钱校准')
  }
  return credits
}

export function validateCalibrationEnv(env: Record<string, string | undefined> = process.env): string[] {
  const errors: string[] = []
  if (!env.MODEL_GATEWAY_BASE_URL?.trim()) errors.push('缺少 MODEL_GATEWAY_BASE_URL')
  if (!env.NEWAPI_CALIBRATE_USER_ID?.trim()) {
    errors.push('缺少 NEWAPI_CALIBRATE_USER_ID')
  } else if (!isSafeCalibrationUserId(env.NEWAPI_CALIBRATE_USER_ID)) {
    errors.push('NEWAPI_CALIBRATE_USER_ID 必须使用 calib- 前缀的临时用户 ID，避免覆盖真实用户子令牌')
  }
  const model = resolveCalibrationModel(env)
  if (!model) errors.push('平台代付白名单为空，无法选择校准模型')
  if (env.NEWAPI_CALIBRATE_MODEL && !approvedPlatformModels(env).has(env.NEWAPI_CALIBRATE_MODEL)) {
    errors.push(`NEWAPI_CALIBRATE_MODEL 不在平台代付白名单内：${env.NEWAPI_CALIBRATE_MODEL}`)
  }
  try {
    getCreditToQuota(env, { requireExplicit: true })
  } catch (e) {
    errors.push((e as Error).message)
  }
  try {
    resolveCalibrationCredits(env)
  } catch (e) {
    errors.push((e as Error).message)
  }
  return errors
}

export function assertCalibrationUsageDelta(deltaQuota: number, creditedQuota: number, deltaCalls: number): void {
  if (!Number.isFinite(deltaCalls) || deltaCalls <= 0) {
    throw new Error('真实调用成功，但 /api/log 未新增消费记录；不能验收 quota/真钱闭环')
  }
  if (!Number.isFinite(deltaQuota) || deltaQuota <= 0) {
    throw new Error('真实调用成功，但 /api/log 未看到 quota 消费增量；不能验收 quota/真钱闭环')
  }
  if (!Number.isFinite(creditedQuota) || creditedQuota <= 0) {
    throw new Error('校准下发 quota 无效，不能验收 quota/真钱闭环')
  }
  if (deltaQuota > creditedQuota) {
    throw new Error('New API 实际消费 quota 超过校准下发 quota，不能验收子令牌配额熔断')
  }
}
