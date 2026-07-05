import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assertCalibrationUsageDelta,
  isSafeCalibrationUserId,
  resolveCalibrationCredits,
  resolveCalibrationModel,
  validateCalibrationEnv,
} from '@/lib/newapiCalibration'

describe('newapiCalibration — 小额真钱闭环校准护栏', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('只允许 calib- 前缀临时用户，避免覆盖真实用户子令牌', () => {
    expect(isSafeCalibrationUserId('calib-smoke-001')).toBe(true)
    expect(isSafeCalibrationUserId('1001')).toBe(false)
    expect(isSafeCalibrationUserId('user-1')).toBe(false)
  })

  it('校准模型必须落在平台代付白名单内', () => {
    vi.stubEnv('APPROVED_PLATFORM_MODELS', 'deepseek-chat,qwen-plus')
    expect(resolveCalibrationModel({ NEWAPI_CALIBRATE_MODEL: 'qwen-plus' })).toBe('qwen-plus')
    expect(validateCalibrationEnv({
      MODEL_GATEWAY_BASE_URL: 'https://gateway.example',
      NEWAPI_CALIBRATE_USER_ID: 'calib-smoke-001',
      NEWAPI_CALIBRATE_MODEL: 'claude-sonnet-4-6',
    })).toContain('NEWAPI_CALIBRATE_MODEL 不在平台代付白名单内：claude-sonnet-4-6')
  })

  it('校准校验使用传入 env 的平台代理白名单，不误读进程环境', () => {
    expect(validateCalibrationEnv({
      MODEL_GATEWAY_BASE_URL: 'https://gateway.example',
      NEWAPI_CALIBRATE_USER_ID: 'calib-smoke-001',
      NEWAPI_CALIBRATE_MODEL: 'custom-safe-model',
      APPROVED_PLATFORM_MODELS: 'custom-safe-model',
      NEWAPI_CREDIT_TO_QUOTA: '700',
    })).not.toContain('NEWAPI_CALIBRATE_MODEL 不在平台代付白名单内：custom-safe-model')
  })

  it('缺网关或临时用户时报错', () => {
    expect(validateCalibrationEnv({})).toEqual(
      expect.arrayContaining(['缺少 MODEL_GATEWAY_BASE_URL', '缺少 NEWAPI_CALIBRATE_USER_ID']),
    )
  })

  it('非法 quota 刻度会阻断小额校准', () => {
    expect(validateCalibrationEnv({
      MODEL_GATEWAY_BASE_URL: 'https://gateway.example',
      NEWAPI_CALIBRATE_USER_ID: 'calib-smoke-001',
      NEWAPI_CREDIT_TO_QUOTA: '0',
    })).toContain('NEWAPI_CREDIT_TO_QUOTA 必须是正数；禁止用非法 quota 刻度同步真钱配额')
  })

  it('缺 quota 刻度会阻断小额校准，不能使用开发默认值', () => {
    expect(validateCalibrationEnv({
      MODEL_GATEWAY_BASE_URL: 'https://gateway.example',
      NEWAPI_CALIBRATE_USER_ID: 'calib-smoke-001',
    })).toContain('NEWAPI_CREDIT_TO_QUOTA 必须显式配置；真实模式禁止使用开发默认 quota 刻度')
  })

  it('校准 credit 默认 1，且只允许 0.01-10 的小额范围', () => {
    expect(resolveCalibrationCredits({})).toBe(1)
    expect(resolveCalibrationCredits({ NEWAPI_CALIBRATE_CREDITS: '0.01' })).toBe(0.01)
    expect(resolveCalibrationCredits({ NEWAPI_CALIBRATE_CREDITS: '10' })).toBe(10)
    expect(() => resolveCalibrationCredits({ NEWAPI_CALIBRATE_CREDITS: 'NaN' })).toThrow('NEWAPI_CALIBRATE_CREDITS')
    expect(() => resolveCalibrationCredits({ NEWAPI_CALIBRATE_CREDITS: '100' })).toThrow('NEWAPI_CALIBRATE_CREDITS')
  })

  it('非法校准 credit 会阻断，不静默 clamp 成其他金额', () => {
    expect(validateCalibrationEnv({
      MODEL_GATEWAY_BASE_URL: 'https://gateway.example',
      NEWAPI_CALIBRATE_USER_ID: 'calib-smoke-001',
      NEWAPI_CREDIT_TO_QUOTA: '700',
      NEWAPI_CALIBRATE_CREDITS: '100',
    })).toContain('NEWAPI_CALIBRATE_CREDITS 必须是 0.01-10 之间的数字，禁止非法或超额真钱校准')
  })

  it('真实调用必须产生正向 quota 增量', () => {
    expect(() => assertCalibrationUsageDelta(0, 700, 1)).toThrow('未看到 quota 消费增量')
    expect(() => assertCalibrationUsageDelta(1, 700, 1)).not.toThrow()
  })

  it('真实调用必须新增消费记录，避免旧日志 quota 变化被误验收', () => {
    expect(() => assertCalibrationUsageDelta(1, 700, 0)).toThrow('未新增消费记录')
    expect(() => assertCalibrationUsageDelta(1, 700, 1)).not.toThrow()
  })

  it('真实消费不得超过校准下发 quota，避免子令牌配额熔断失效仍验收', () => {
    expect(() => assertCalibrationUsageDelta(701, 700, 1)).toThrow('超过校准下发 quota')
    expect(() => assertCalibrationUsageDelta(700, 700, 1)).not.toThrow()
  })
})
