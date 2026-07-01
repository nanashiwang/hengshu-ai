import { describe, it, expect } from 'vitest'
import { selectModel } from '@/lib/route'

describe('selectModel — 任务级路由选主模型 + fallback', () => {
  it('优先 strategies[mode][0]', () => {
    const r = selectModel(
      { strategies: { cheap: ['m-cheap', 'm-2'] } },
      { cloud: ['m-cloud'] },
      'cheap',
      'm-default',
    )
    expect(r.model).toBe('m-cheap')
    expect(r.mode).toBe('cheap')
  })

  it('无 strategies 回退 cloud[0]', () => {
    const r = selectModel({}, { cloud: ['m-cloud'] }, 'balanced', 'm-default')
    expect(r.model).toBe('m-cloud')
  })

  it('全空回退 fallbackDefault + 默认 balanced', () => {
    const r = selectModel(null, null, undefined, 'm-default')
    expect(r.model).toBe('m-default')
    expect(r.mode).toBe('balanced')
  })

  it('mode 缺省时用 routePolicy.default', () => {
    const r = selectModel(
      { default: 'quality', strategies: { quality: ['m-q'] } },
      null,
      undefined,
      'm-default',
    )
    expect(r.mode).toBe('quality')
    expect(r.model).toBe('m-q')
  })

  it('fallbacks 去重且排除 primary', () => {
    const r = selectModel(
      { strategies: { cheap: ['m1'], fallback: ['m2', 'm1'] } },
      { cloud: ['m2', 'm3'] },
      'cheap',
      'm3',
    )
    expect(r.model).toBe('m1')
    expect(r.fallbacks).toEqual(['m2', 'm3'])
  })
})
