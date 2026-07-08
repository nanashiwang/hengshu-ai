import { describe, expect, it } from 'vitest'
import {
  MAX_ADAPTER_DRAFT_TITLE_LENGTH,
  MAX_ADAPTER_JSON_PATCH_BYTES,
  MAX_ADAPTER_PROMPT_APPEND_LENGTH,
  normalizeAdapterDraftOverrides,
} from '@/lib/adapterDraftRequest'

describe('adapterDraftRequest — 失败库生成 Adapter 草稿边界', () => {
  it('只归一化允许的 Adapter 草稿 override 字段', () => {
    expect(normalizeAdapterDraftOverrides({
      title: ' 修复 JSON ',
      systemPromptAppend: ' 只输出 JSON ',
      userPromptAppend: ' 自检 schema ',
      outputSchemaPatch: { required: ['text'] },
      decodingPatch: { temperature: 0.2 },
      status: 'active',
      skill: 'other-skill',
    })).toEqual({
      ok: true,
      overrides: {
        title: '修复 JSON',
        systemPromptAppend: '只输出 JSON',
        userPromptAppend: '自检 schema',
        outputSchemaPatch: { required: ['text'] },
        decodingPatch: { temperature: 0.2 },
      },
    })
  })

  it('拒绝非对象 body 和非对象 JSON patch', () => {
    expect(normalizeAdapterDraftOverrides([])).toEqual({
      ok: false,
      status: 400,
      error: '请求体必须是 JSON 对象',
    })
    expect(normalizeAdapterDraftOverrides({ outputSchemaPatch: [] })).toEqual({
      ok: false,
      status: 400,
      error: 'outputSchemaPatch 必须是 JSON 对象',
    })
  })

  it('拒绝过长 title 和 prompt 追加补丁', () => {
    expect(normalizeAdapterDraftOverrides({ title: 'x'.repeat(MAX_ADAPTER_DRAFT_TITLE_LENGTH + 1) })).toEqual({
      ok: false,
      status: 400,
      error: 'title 过长',
    })
    expect(normalizeAdapterDraftOverrides({ userPromptAppend: 'x'.repeat(MAX_ADAPTER_PROMPT_APPEND_LENGTH + 1) })).toEqual({
      ok: false,
      status: 400,
      error: 'userPromptAppend 过长',
    })
  })

  it('拒绝超大 JSON patch，避免把 Adapter 草稿变成大对象存储入口', () => {
    expect(normalizeAdapterDraftOverrides({ decodingPatch: { note: 'x'.repeat(MAX_ADAPTER_JSON_PATCH_BYTES) } })).toEqual({
      ok: false,
      status: 413,
      error: 'decodingPatch 过大',
    })
  })
})
