import { describe, expect, it } from 'vitest'
import { publicSanitize } from '@/lib/publicSanitize'

describe('publicSanitize — 公开对象递归脱敏', () => {
  it('移除 prompt、原始 IO、examples 与内部收益字段，但保留 schema 摘要', () => {
    const row = publicSanitize({
      inputSchema: { topic: { type: 'string' } },
      outputSchema: { result: { type: 'string' } },
      examples: [{ input: 'secret', output: 'secret' }],
      sampleInput: 'secret',
      expectedOutput: 'secret',
      promptTemplate: 'secret prompt',
      systemPromptAppend: 'adapter patch',
      userPromptAppend: 'adapter patch',
      outputSchemaPatch: { secret: true },
      decodingPatch: { temperature: 0.1 },
      apiKeyEncrypted: 'enc:v1:secret',
      accessToken: 'secret-token',
      signerSecretKey: 'secret-key',
      passwordHash: 'hash-secret',
      signingPrivateKey: 'private-key',
      scimTokenDigest: 'sha256:secret',
      runnerTokenHash: 'sha256:secret',
      platformRevenue: 123,
      nested: {
        model: 'qwen-plus',
        rawReports: [{ inputJson: { secret: true } }],
        newapiRequestLogId: 'log-secret',
        totalTokens: 123,
      },
    }) as any

    expect(row).toEqual({
      inputSchema: { topic: { type: 'string' } },
      outputSchema: { result: { type: 'string' } },
      nested: { model: 'qwen-plus' },
    })
  })

  it('对非敏感字段里的明显密钥/令牌字符串做内容级脱敏', () => {
    const row = publicSanitize({
      symptom: 'upstream failed with Authorization: Bearer sk-secretsecretsecret123',
      likelyCause: 'provider key sk-live_xxxxxxxxxxxxxxxx leaked in error',
      safe: '普通错误描述保留',
    })

    expect(row).toEqual({
      symptom: 'upstream failed with Authorization: Bearer <redacted>',
      likelyCause: 'provider key <redacted> leaked in error',
      safe: '普通错误描述保留',
    })
  })
})
