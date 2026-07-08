import { describe, expect, it } from 'vitest'
import {
  MAX_ENTERPRISE_ID_LENGTH,
  MAX_ENTERPRISE_LIST_ITEMS,
  MAX_ENTERPRISE_SCIM_FILTER_LENGTH,
  MAX_ENTERPRISE_TEXT_LENGTH,
  readEnterpriseOptionalQuery,
  readEnterpriseQueryId,
  requireEnterpriseIds,
  validateEnterpriseStringList,
  validateEnterpriseText,
} from '@/lib/enterpriseRequest'

describe('enterpriseRequest — 企业治理请求边界', () => {
  it('要求 body 为对象并包含必要 id', () => {
    expect(requireEnterpriseIds([], ['organizationId'])).toEqual({
      ok: false,
      status: 400,
      error: '请求体必须是 JSON 对象',
    })
    expect(requireEnterpriseIds({ organizationId: '' }, ['organizationId'])).toEqual({
      ok: false,
      status: 400,
      error: '缺少 organizationId',
    })
    expect(requireEnterpriseIds({ organizationId: 'org-1', skillId: 'skill-1' }, ['organizationId', 'skillId'])).toEqual({ ok: true })
  })

  it('拒绝过长 id、说明文本和模型白名单', () => {
    expect(requireEnterpriseIds({ organizationId: 'x'.repeat(MAX_ENTERPRISE_ID_LENGTH + 1) }, ['organizationId'])).toEqual({
      ok: false,
      status: 400,
      error: 'organizationId 过长',
    })
    expect(validateEnterpriseText('x'.repeat(MAX_ENTERPRISE_TEXT_LENGTH + 1), 'riskNotes')).toEqual({
      ok: false,
      status: 400,
      error: 'riskNotes 过长',
    })
    expect(validateEnterpriseStringList(Array.from({ length: MAX_ENTERPRISE_LIST_ITEMS + 1 }, (_, i) => `m-${i}`), 'modelAllowlist')).toEqual({
      ok: false,
      status: 413,
      error: 'modelAllowlist 项过多',
    })
  })

  it('拒绝模型白名单中的过长项', () => {
    expect(validateEnterpriseStringList(['qwen', 'x'.repeat(MAX_ENTERPRISE_ID_LENGTH + 1)], 'modelAllowlist')).toEqual({
      ok: false,
      status: 400,
      error: 'modelAllowlist 含过长项',
    })
  })

  it('限制企业 GET 查询参数中的 id/filter 长度', () => {
    expect(readEnterpriseQueryId(new URLSearchParams('organizationId=org-1'))).toBe('org-1')
    expect(readEnterpriseQueryId(new URLSearchParams(''))).toEqual({
      ok: false,
      status: 400,
      error: '缺少 organizationId',
    })
    expect(readEnterpriseQueryId(new URLSearchParams(`organizationId=${'x'.repeat(MAX_ENTERPRISE_ID_LENGTH + 1)}`))).toEqual({
      ok: false,
      status: 400,
      error: 'organizationId 过长',
    })
    expect(readEnterpriseOptionalQuery(new URLSearchParams(`filter=${'x'.repeat(MAX_ENTERPRISE_SCIM_FILTER_LENGTH + 1)}`), 'filter', MAX_ENTERPRISE_SCIM_FILTER_LENGTH)).toEqual({
      ok: false,
      status: 400,
      error: 'filter 过长',
    })
  })
})
