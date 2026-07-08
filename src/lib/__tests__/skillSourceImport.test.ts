import { describe, expect, it } from 'vitest'
import { analyzeSkillPackage } from '@/lib/skillPackage'
import {
  normalizeSkillImportSource,
  parseSkillImportSources,
  skillImportSourceHash,
  sourceTextToPackage,
  summarizeSkillImportDiff,
} from '@/lib/skillSourceImport'

describe('skill source import helpers', () => {
  it('normalizes sources with stable idempotency keys and safe defaults', () => {
    const source = normalizeSkillImportSource({ url: 'https://github.com/acme/repo/blob/main/README.md' })
    expect(source.format).toBe('github_readme')
    expect(source.visibility).toBe('unlisted')
    expect(source.idempotencyKey).toMatch(/^import-source:/)
    expect(source.locator).toBe('https://github.com/acme/repo/blob/main/README.md')
    expect(source.title).toContain('README')
  })

  it('keeps source imports out of enterprise visibility by default', () => {
    const source = normalizeSkillImportSource({
      title: 'Internal Helper',
      visibility: 'enterprise',
      content: '# Internal Helper',
    })
    expect(source.visibility).toBe('unlisted')
  })

  it('parses array or object source manifests', () => {
    const sources = parseSkillImportSources({ sources: [{ title: 'A', content: '# A' }, { title: 'B', format: 'gpts', content: '{}' }] })
    expect(sources.map((s) => s.title)).toEqual(['A', 'B'])
    expect(sources[1].format).toBe('gpts')
  })

  it('wraps README text as an importable package', () => {
    const source = normalizeSkillImportSource({ title: 'Repo Helper', format: 'github_readme' })
    const pkg = sourceTextToPackage(source, '# Repo Helper\nReusable workflow.')
    const analysis = analyzeSkillPackage(pkg.fileName, pkg.buffer)
    expect(analysis.sourceFormat).toBe('github_readme')
    expect(analysis.promptTemplate).toContain('Repo Helper')
  })

  it('wraps Claude Skill text as an importable package', () => {
    const source = normalizeSkillImportSource({ title: 'Claude Helper', format: 'claude_skill' })
    const pkg = sourceTextToPackage(source, '# Claude Helper\nFollow these instructions.')
    const analysis = analyzeSkillPackage(pkg.fileName, pkg.buffer)
    expect(analysis.sourceFormat).toBe('claude_skill')
    expect(analysis.importedSourceName).toBe('SKILL.md')
  })

  it('hashes source content separately from stable idempotency keys', () => {
    const source = normalizeSkillImportSource({ url: 'https://github.com/acme/repo/blob/main/README.md' })
    expect(skillImportSourceHash(source, '# v1')).not.toBe(skillImportSourceHash(source, '# v2'))
    expect(normalizeSkillImportSource({ url: source.url }).idempotencyKey).toBe(source.idempotencyKey)
  })

  it('summarizes source diffs for resync review', () => {
    const diff = summarizeSkillImportDiff(
      { version: '1.0.0', promptTemplate: 'A', inputSchema: { request: { type: 'text' } }, permissions: { network: false } },
      { version: '1.1.0', promptTemplate: 'B', inputSchema: { request: { type: 'text' } }, permissions: { network: true } },
    )
    expect(diff).toContain('version: 1.0.0 -> 1.1.0')
    expect(diff).toContain('prompt template')
    expect(diff).toContain('permissions')
    expect(diff).not.toContain('input schema')
  })
})
