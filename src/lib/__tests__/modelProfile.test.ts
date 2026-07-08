import { describe, expect, it } from 'vitest'
import { buildDriftHistory, buildModelProfileData, ensureModelProfile, modelRegressionAlerts, upsertModelProfile } from '@/lib/modelProfile'

describe('modelProfile — 模型画像初稿生成', () => {
  it('从兼容统计和价格快照生成画像', () => {
    const data = buildModelProfileData({
      modelName: 'qwen-plus',
      stat: {
        model: 'qwen-plus',
        successRate: 0.92,
        formatRate: 0.86,
        avgLatencyMs: 1200,
        samples: 12,
        effectiveSamples: 9.5,
        sourceSummary: [{ source: 'verified', count: 6, weight: 1 }],
      },
      price: { inputPrice: 0.001, outputPrice: 0.004 },
      now: new Date('2026-07-08T00:00:00.000Z'),
    })

    expect(data).toMatchObject({
      provider: 'Alibaba/Qwen',
      modelName: 'qwen-plus',
      profileStatus: 'verified',
      supportsStructuredOutput: true,
      jsonStabilityScore: 86,
      inputPrice: 0.001,
      outputPrice: 0.004,
      lastObservedAt: '2026-07-08T00:00:00.000Z',
      capabilities: { observedSamples: 12, effectiveSamples: 9.5, sourceSummary: [{ source: 'verified', count: 6, weight: 1 }] },
    })
  })

  it('样本不足时保留 observed 和 lowSamples 标记', () => {
    const data = buildModelProfileData({
      modelName: 'unknown-model',
      stat: { model: 'unknown-model', successRate: 1, formatRate: 0.2, avgLatencyMs: 500, samples: 1 },
    })

    expect(data.profileStatus).toBe('observed')
    expect(data.provider).toBe('unknown')
    expect(data.knownIssues).toMatchObject({ lowSamples: true })
  })

  it('ensureModelProfile 已存在则复用，不存在则创建', async () => {
    const calls: any[] = []
    const payload = {
      find: async () => ({ docs: [] }),
      create: async (args: any) => {
        calls.push(args)
        return { id: 'profile-1' }
      },
    }

    await expect(ensureModelProfile(payload as any, 'deepseek-chat')).resolves.toBe('profile-1')
    expect(calls[0]).toMatchObject({
      collection: 'model-profiles',
      data: { modelName: 'deepseek-chat', provider: 'DeepSeek' },
    })
  })

  it('ensureModelProfile 按 modelName + modelVersion 查找和创建', async () => {
    const calls: any[] = []
    const payload = {
      find: async (args: any) => {
        calls.push(args)
        return { docs: [] }
      },
      create: async (args: any) => {
        calls.push(args)
        return { id: 'profile-versioned' }
      },
    }

    await expect(ensureModelProfile(payload as any, 'qwen-plus', 'Alibaba/Qwen', '2026-07')).resolves.toBe('profile-versioned')
    expect(calls[0]).toMatchObject({
      collection: 'model-profiles',
      where: { and: [{ modelName: { equals: 'qwen-plus' } }, { modelVersion: { equals: '2026-07' } }] },
    })
    expect(calls[1]).toMatchObject({
      collection: 'model-profiles',
      data: { modelName: 'qwen-plus', modelVersion: '2026-07', provider: 'Alibaba/Qwen' },
    })
  })

  it('模型画像会识别成功率/格式率明显回归', () => {
    const next = buildModelProfileData({
      modelName: 'qwen-plus',
      stat: { model: 'qwen-plus', successRate: 0.7, formatRate: 0.6, avgLatencyMs: 1200, samples: 20 },
    })
    const alerts = modelRegressionAlerts(
      { knownIssues: { successRate: 0.92, formatRate: 0.86 }, lastObservedAt: '2026-07-01T00:00:00.000Z' },
      next,
    )

    expect(alerts).toEqual([
      { metric: 'successRate', from: 0.92, to: 0.7, delta: -0.22, severity: 'critical' },
      { metric: 'formatRate', from: 0.86, to: 0.6, delta: -0.26, severity: 'critical' },
    ])
  })


  it('构建漂移曲线并保留最近窗口', () => {
    const next = buildModelProfileData({
      modelName: 'qwen-plus',
      stat: { model: 'qwen-plus', successRate: 0.8, formatRate: 0.7, avgLatencyMs: 900, samples: 11 },
      now: new Date('2026-07-08T00:00:00.000Z'),
    })
    const history = buildDriftHistory(
      {
        knownIssues: { successRate: 0.95, formatRate: 0.9, avgLatencyMs: 800 },
        capabilities: { observedSamples: 20 },
        lastObservedAt: '2026-07-01T00:00:00.000Z',
        driftHistory: [{ observedAt: '2026-06-30T00:00:00.000Z', successRate: 0.96 }],
      },
      next,
      2,
    )

    expect(history).toEqual([
      { observedAt: '2026-07-01T00:00:00.000Z', successRate: 0.95, formatRate: 0.9, avgLatencyMs: 800, samples: 20 },
      { observedAt: '2026-07-08T00:00:00.000Z', successRate: 0.8, formatRate: 0.7, avgLatencyMs: 900, samples: 11 },
    ])
  })

  it('upsert 更新已有画像时写入 driftSummary 和 regressionAlerts', async () => {
    const calls: any[] = []
    const payload = {
      find: async () => ({
        docs: [
          {
            id: 'profile-1',
            knownIssues: { successRate: 0.95, formatRate: 0.9 },
            lastObservedAt: '2026-07-01T00:00:00.000Z',
          },
        ],
      }),
      update: async (args: any) => {
        calls.push(args)
        return { id: args.id, ...args.data }
      },
    }
    const data = buildModelProfileData({
      modelName: 'qwen-plus',
      stat: { model: 'qwen-plus', successRate: 0.8, formatRate: 0.88, avgLatencyMs: 1000, samples: 20 },
    })

    await upsertModelProfile(payload as any, data)

    expect(calls[0]).toMatchObject({
      collection: 'model-profiles',
      id: 'profile-1',
      data: {
        driftSummary: { comparedWithPrevious: true, status: 'regression_detected' },
        regressionAlerts: [{ metric: 'successRate', from: 0.95, to: 0.8, delta: -0.15, severity: 'warning' }],
        driftHistory: expect.any(Array),
      },
    })
  })
})
