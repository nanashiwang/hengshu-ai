import { describe, expect, it } from 'vitest'
import { normalizeManifestFormat } from '@/lib/manifestRequest'

describe('manifestRequest — manifest 查询参数', () => {
  it('只允许 json 显式切换，其余回退 yaml', () => {
    expect(normalizeManifestFormat('json')).toBe('json')
    expect(normalizeManifestFormat(' JSON ')).toBe('json')
    expect(normalizeManifestFormat('yaml')).toBe('yaml')
    expect(normalizeManifestFormat('xml')).toBe('yaml')
    expect(normalizeManifestFormat(undefined)).toBe('yaml')
  })
})
