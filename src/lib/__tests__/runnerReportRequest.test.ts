import { describe, expect, it } from 'vitest'
import {
  MAX_RUNNER_REPORT_LATENCY_MS,
  MAX_RUNNER_REPORT_MODEL_LENGTH,
  normalizeRunnerCompatReport,
} from '@/lib/runnerReportRequest'

describe('runnerReportRequest — Runner 兼容回流边界', () => {
  it('归一化合法兼容报告，且只保留聚合指标字段', () => {
    const result = normalizeRunnerCompatReport({
      slug: ' writer ',
      checksum: 'sha256:abc',
      anon: true,
      model: ' qwen-plus ',
      modelProvider: ' dashscope ',
      modelVersion: ' 2026-07 ',
      success: 1,
      formatValid: true,
      latencyMs: 123.6,
      errorType: '',
      input: { raw: 'should-not-leak' },
      output: 'should-not-leak',
    })
    expect(result).toEqual({
      ok: true,
      value: {
        slug: 'writer',
        checksum: 'sha256:abc',
        anon: true,
        modelName: 'qwen-plus',
        modelProvider: 'dashscope',
        modelVersion: '2026-07',
        success: true,
        latencyMs: 124,
        formatValid: true,
        errorType: undefined,
        inputSizeBucket: undefined,
        outputSizeBucket: undefined,
      },
    })
  })

  it('必须提供 slug 与 model', () => {
    expect(normalizeRunnerCompatReport({ slug: 'writer' })).toEqual({
      ok: false,
      status: 400,
      error: '缺少 slug 或 model',
    })
  })

  it('拒绝超长模型名和字段，避免静默截断污染 ModelProfile', () => {
    expect(normalizeRunnerCompatReport({ slug: 'writer', model: 'x'.repeat(MAX_RUNNER_REPORT_MODEL_LENGTH + 1) })).toEqual({
      ok: false,
      status: 400,
      error: 'slug 或 model 过长',
    })
    expect(normalizeRunnerCompatReport({ slug: 'writer', model: 'qwen', errorType: 'x'.repeat(1000) })).toEqual({
      ok: false,
      status: 400,
      error: '兼容报告字段过长',
    })
  })

  it('拒绝非法 latencyMs', () => {
    expect(normalizeRunnerCompatReport({ slug: 'writer', model: 'qwen', latencyMs: -1 })).toEqual({
      ok: false,
      status: 400,
      error: 'latencyMs 无效',
    })
    expect(normalizeRunnerCompatReport({ slug: 'writer', model: 'qwen', latencyMs: MAX_RUNNER_REPORT_LATENCY_MS + 1 })).toEqual({
      ok: false,
      status: 400,
      error: 'latencyMs 无效',
    })
  })
})
