import { describe, expect, it } from 'vitest'
import {
  normalizeSkillImportVisibility,
  normalizeSkillSubmissionVisibility,
} from '@/lib/skillVisibility'

describe('skill visibility normalization', () => {
  it('does not let ordinary creators create enterprise skills through public submission', () => {
    const creator = { id: 'u1', role: 'creator' }
    expect(normalizeSkillSubmissionVisibility('enterprise', creator)).toBe('unlisted')
  })

  it('keeps admin/reviewer enterprise visibility for staff-maintained records', () => {
    expect(normalizeSkillSubmissionVisibility('enterprise', { role: 'admin' })).toBe('enterprise')
    expect(normalizeSkillSubmissionVisibility('enterprise', { role: 'reviewer' })).toBe('enterprise')
  })

  it('keeps public/private/unlisted submissions and safe defaults', () => {
    expect(normalizeSkillSubmissionVisibility('private', { role: 'creator' })).toBe('private')
    expect(normalizeSkillSubmissionVisibility('unlisted', { role: 'creator' })).toBe('unlisted')
    expect(normalizeSkillSubmissionVisibility('bad', { role: 'creator' })).toBe('public')
  })

  it('normalizes source imports to public catalog visibility only', () => {
    expect(normalizeSkillImportVisibility('public')).toBe('public')
    expect(normalizeSkillImportVisibility('private')).toBe('private')
    expect(normalizeSkillImportVisibility('enterprise')).toBe('unlisted')
    expect(normalizeSkillImportVisibility(undefined)).toBe('unlisted')
  })
})
