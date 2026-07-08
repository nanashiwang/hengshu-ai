import type { Where } from 'payload'

export function publicScoreSnapshotWhere() {
  return {
    and: [
      { 'skill.status': { equals: 'published' } },
      { 'skill.visibility': { equals: 'public' } },
    ],
  } as Where
}

export function isPublicScoreSnapshot(snapshot: any) {
  const skill = snapshot?.skill
  if (!skill || typeof skill !== 'object') return false
  return skill.status === 'published' && skill.visibility === 'public'
}
