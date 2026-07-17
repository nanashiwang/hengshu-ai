import { describe, expect, it } from 'vitest'
import {
  MAX_SKILL_PACKAGE_FORM_BYTES,
  MAX_SKILL_PACKAGE_TITLE_LENGTH,
  preflightSkillPackageFormRequest,
  readSkillPackageFormData,
  readSkillPackageText,
} from '@/lib/skillPackageSubmissionRequest'

describe('skillPackageSubmissionRequest — Skill 包上传表单边界', () => {
  it('按 content-length 在 formData 解析前拒绝超大上传', () => {
    const req = new Request('http://local.test', {
      method: 'POST',
      headers: { 'content-length': String(MAX_SKILL_PACKAGE_FORM_BYTES + 1) },
      body: '',
    })
    expect(preflightSkillPackageFormRequest(req)).toEqual({
      ok: false,
      status: 413,
      error: 'Skill 包表单过大',
    })
  })

  it('没有 content-length 时也按实际流量拒绝超限表单', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(80))
        controller.enqueue(new Uint8Array(80))
        controller.close()
      },
    })
    const request = new Request('http://localhost/v1/skills', {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=adversarial' },
      body,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' })

    await expect(readSkillPackageFormData(request, 100)).resolves.toEqual({
      ok: false,
      status: 413,
      error: 'Skill 包表单过大',
    })
  })

  it('在字节上限内解析 multipart 表单', async () => {
    const source = new FormData()
    source.set('title', 'safe-skill')
    const request = new Request('http://localhost/v1/skills', { method: 'POST', body: source })
    const result = await readSkillPackageFormData(request, 10_000)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.form.get('title')).toBe('safe-skill')
  })

  it('归一化表单文本字段，并校验必填/长度', () => {
    expect(readSkillPackageText(' Demo ', MAX_SKILL_PACKAGE_TITLE_LENGTH, 'title', true)).toEqual({ ok: true, value: 'Demo' })
    expect(readSkillPackageText('', MAX_SKILL_PACKAGE_TITLE_LENGTH, 'title', true)).toEqual({
      ok: false,
      status: 400,
      error: '请填写 Skill 名称',
    })
    expect(readSkillPackageText('x'.repeat(MAX_SKILL_PACKAGE_TITLE_LENGTH + 1), MAX_SKILL_PACKAGE_TITLE_LENGTH, 'title')).toEqual({
      ok: false,
      status: 400,
      error: 'title 过长',
    })
  })
})
