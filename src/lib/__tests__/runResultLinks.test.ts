import { describe, expect, it } from 'vitest'
import { runResultLinks } from '@/lib/runResultLinks'

describe('runResultLinks — 运行结果闭环入口', () => {
  it('成功运行返回台账和模型画像入口，不生成失败库入口', () => {
    expect(runResultLinks({ skillId: 'skill-1', model: 'qwen-plus', modelVersion: '2026-07-01', success: true })).toEqual({
      runLedgerUrl: '/console/runs?skillId=skill-1&model=qwen-plus&modelVersion=2026-07-01',
      modelProfileUrl: '/models?modelName=qwen-plus&modelVersion=2026-07-01',
      failureKnowledgeUrl: null,
    })
  })

  it('失败运行返回带错误类型的失败库入口', () => {
    expect(runResultLinks({
      skillId: 'skill-1',
      model: 'qwen-plus',
      modelVersion: '2026-07-01',
      errorCode: 'json_parse_error',
      success: false,
    })).toEqual({
      runLedgerUrl: '/console/runs?skillId=skill-1&model=qwen-plus&modelVersion=2026-07-01&success=false',
      modelProfileUrl: '/models?modelName=qwen-plus&modelVersion=2026-07-01',
      failureKnowledgeUrl: '/failures?skillId=skill-1&modelName=qwen-plus&modelVersion=2026-07-01&errorType=json_parse_error',
    })
  })
})
