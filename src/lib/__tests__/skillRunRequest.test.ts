import { describe, expect, it } from 'vitest'
import {
  MAX_COMPARE_MODELS,
  MAX_MODEL_NAME_LENGTH,
  MAX_MODEL_PROVIDER_LENGTH,
  MAX_MODEL_VERSION_LENGTH,
  MAX_SKILL_RUN_INPUT_BYTES,
  normalizeCompareModels,
  normalizeOptionalModelProvider,
  normalizeOptionalModelVersion,
  normalizeRerunModel,
  normalizeRouteMode,
  normalizeRunInput,
} from '@/lib/skillRunRequest'

describe('skillRunRequest — 运行请求边界', () => {
  it('默认空 input，并要求 input 是对象', () => {
    expect(normalizeRunInput({})).toEqual({})
    expect(normalizeRunInput({ input: [] })).toEqual({
      ok: false,
      status: 400,
      error: 'input 必须是 JSON 对象',
    })
  })

  it('拒绝超大 input，避免私人台账和运行链路被塞入大对象', () => {
    const result = normalizeRunInput({ input: { text: 'x'.repeat(MAX_SKILL_RUN_INPUT_BYTES) } })
    expect(result).toEqual({ ok: false, status: 413, error: 'input 过大' })
  })

  it('模型对比去重、清洗并限制数量', () => {
    const models = normalizeCompareModels([' gpt-5 ', 'gpt-5', '', 'qwen', 'kimi', 'doubao', 'extra'])
    expect(models).toEqual(['gpt-5', 'qwen', 'kimi', 'doubao'].slice(0, MAX_COMPARE_MODELS))
  })

  it('拒绝过长模型名称', () => {
    expect(normalizeCompareModels(['x'.repeat(MAX_MODEL_NAME_LENGTH + 1)])).toEqual({
      ok: false,
      status: 400,
      error: '模型名称过长',
    })
    expect(normalizeRerunModel('x'.repeat(MAX_MODEL_NAME_LENGTH + 1))).toEqual({
      ok: false,
      status: 400,
      error: '模型名称过长',
    })
  })

  it('重跑必须指定模型', () => {
    expect(normalizeRerunModel('')).toEqual({
      ok: false,
      status: 400,
      error: '请选择要重跑的模型',
    })
    expect(normalizeRerunModel(' gpt-5 ')).toBe('gpt-5')
  })

  it('routeMode 只接受平台声明的枚举值', () => {
    expect(normalizeRouteMode(undefined)).toBeUndefined()
    expect(normalizeRouteMode(' cheap ')).toBe('cheap')
    expect(normalizeRouteMode('free')).toEqual({
      ok: false,
      status: 400,
      error: 'routeMode 无效',
    })
  })

  it('可选模型供应商和版本会清洗并限制长度', () => {
    expect(normalizeOptionalModelProvider(' openai ')).toBe('openai')
    expect(normalizeOptionalModelVersion(' 2026-07-01 ')).toBe('2026-07-01')
    expect(normalizeOptionalModelProvider('p'.repeat(MAX_MODEL_PROVIDER_LENGTH + 1))).toEqual({
      ok: false,
      status: 400,
      error: '模型 Provider 过长',
    })
    expect(normalizeOptionalModelVersion('v'.repeat(MAX_MODEL_VERSION_LENGTH + 1))).toEqual({
      ok: false,
      status: 400,
      error: '模型版本过长',
    })
  })
})
