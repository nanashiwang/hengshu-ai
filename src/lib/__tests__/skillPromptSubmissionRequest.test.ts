import { describe, expect, it } from 'vitest'
import {
  MAX_SKILL_PROMPT_TEMPLATE_LENGTH,
  MAX_SKILL_RECOMMENDED_MODELS_BYTES,
  MAX_SKILL_TITLE_LENGTH,
  normalizeSkillPromptSubmission,
} from '@/lib/skillPromptSubmissionRequest'

describe('skillPromptSubmissionRequest — Prompt Skill 发布边界', () => {
  it('归一化合法 Prompt Skill 发布请求，并解析 JSON 字段', () => {
    expect(normalizeSkillPromptSubmission({
      title: ' 写作助手 ',
      description: ' 生成短文 ',
      systemPrompt: ' 你是助手 ',
      promptTemplate: ' 写：{{topic}} ',
      inputSchema: '{"type":"object"}',
      recommendedModels: { cloud: ['qwen-plus'] },
      categorySlug: ' content-creation ',
      idempotencyKey: 'submit-0123456789',
      status: 'published',
    })).toEqual({
      ok: true,
      value: {
        title: '写作助手',
        description: '生成短文',
        systemPrompt: '你是助手',
        promptTemplate: '写：{{topic}}',
        inputSchema: { type: 'object' },
        recommendedModels: { cloud: ['qwen-plus'] },
        categorySlug: 'content-creation',
        idempotencyKey: 'submit-0123456789',
      },
    })
  })

  it('要求 body 为对象，且 title / promptTemplate 必填', () => {
    expect(normalizeSkillPromptSubmission([])).toEqual({
      ok: false,
      status: 400,
      error: '请求体必须是 JSON 对象',
    })
    expect(normalizeSkillPromptSubmission({ promptTemplate: 'x' })).toEqual({
      ok: false,
      status: 400,
      error: '请填写 Skill 名称',
    })
    expect(normalizeSkillPromptSubmission({ title: 'x' })).toEqual({
      ok: false,
      status: 400,
      error: '请填写 User 模板',
    })
  })

  it('拒绝超长 title / promptTemplate', () => {
    expect(normalizeSkillPromptSubmission({ title: 'x'.repeat(MAX_SKILL_TITLE_LENGTH + 1), promptTemplate: 'p' })).toEqual({
      ok: false,
      status: 400,
      error: 'title 过长',
    })
    expect(normalizeSkillPromptSubmission({ title: 't', promptTemplate: 'x'.repeat(MAX_SKILL_PROMPT_TEMPLATE_LENGTH + 1) })).toEqual({
      ok: false,
      status: 400,
      error: 'promptTemplate 过长',
    })
  })

  it('拒绝非法或超大的 JSON 字段', () => {
    expect(normalizeSkillPromptSubmission({ title: 't', promptTemplate: 'p', inputSchema: '{bad' })).toEqual({
      ok: false,
      status: 400,
      error: '输入字段定义不是合法 JSON',
    })
    expect(normalizeSkillPromptSubmission({
      title: 't',
      promptTemplate: 'p',
      recommendedModels: { note: 'x'.repeat(MAX_SKILL_RECOMMENDED_MODELS_BYTES) },
    })).toEqual({
      ok: false,
      status: 413,
      error: '推荐模型配置过大',
    })
  })
})
