import { describe, expect, it } from 'vitest'
import {
  MAX_DEVICE_CODE_LENGTH,
  MAX_DEVICE_META_LENGTH,
  normalizeDeviceCode,
  normalizeDeviceCodeMeta,
  normalizeUserCode,
} from '@/lib/deviceAuthRequest'

describe('deviceAuthRequest — 设备授权请求边界', () => {
  it('归一化设备码申请 meta，并限制字段长度', () => {
    expect(normalizeDeviceCodeMeta({
      runnerVersion: ' 0.1.0 ',
      os: ' darwin ',
      arch: ' arm64 ',
      label: ' Nana Mac ',
      ignored: 'x',
    })).toEqual({
      runnerVersion: '0.1.0',
      os: 'darwin',
      arch: 'arm64',
      label: 'Nana Mac',
    })
    expect(normalizeDeviceCodeMeta({ label: 'x'.repeat(MAX_DEVICE_META_LENGTH + 1) })).toEqual({
      ok: false,
      status: 400,
      error: '字段过长',
    })
  })

  it('归一化 device_code / userCode，并拒绝空值或超长值', () => {
    expect(normalizeDeviceCode(' abc ')).toBe('abc')
    expect(normalizeUserCode(' ab-cd ')).toBe('AB-CD')
    expect(normalizeDeviceCode('')).toEqual({ ok: false, status: 400, error: 'invalid_request' })
    expect(normalizeUserCode('')).toEqual({ ok: false, status: 400, error: '请输入设备码' })
    expect(normalizeDeviceCode('x'.repeat(MAX_DEVICE_CODE_LENGTH + 1))).toEqual({
      ok: false,
      status: 400,
      error: '字段过长',
    })
  })
})
