import { describe, expect, it } from 'vitest'
import { normalizeSkillSubmissionKey } from '@/lib/skillSubmission'

describe('skillSubmission — 发布 Skill 幂等键', () => {
  it('只接受 16-128 位短 ASCII token，并会 trim', () => {
    expect(normalizeSkillSubmissionKey('  submit-0123456789  ')).toBe('submit-0123456789')
    expect(normalizeSkillSubmissionKey('short')).toBe('')
    expect(normalizeSkillSubmissionKey('中文-submit-0123456789')).toBe('')
    expect(normalizeSkillSubmissionKey('x'.repeat(129))).toBe('')
    expect(normalizeSkillSubmissionKey(null)).toBe('')
  })
})
