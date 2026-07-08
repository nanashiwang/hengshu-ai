function relationId(value: any) {
  return typeof value === 'object' ? value?.id : value
}

export function bountyReadWhere(user?: any) {
  const publicBounty = { isPublic: { equals: true } }
  if (user && user.accountStatus !== 'banned' && (user.role === 'admin' || user.role === 'reviewer')) return true
  if (user && user.accountStatus !== 'banned') {
    return {
      or: [
        publicBounty,
        { creator: { equals: user.id } },
        { acceptedBy: { equals: user.id } },
      ],
    }
  }
  return publicBounty
}

export function canReadBounty(bounty: any, user?: any) {
  if (!bounty) return false
  if (bounty.isPublic !== false) return true
  if (!user || user.accountStatus === 'banned') return false
  if (user.role === 'admin' || user.role === 'reviewer') return true
  const creatorId = relationId(bounty.creator)
  const acceptedById = relationId(bounty.acceptedBy)
  return [creatorId, acceptedById].some((id) => id && String(id) === String(user.id))
}

export function canAcceptBounty(bounty: any, user: any) {
  if (!bounty || !user || user.accountStatus === 'banned') return false
  if (bounty.isPublic === false) return false
  const creatorId = relationId(bounty.creator)
  if (String(creatorId || '') === String(user.id)) return false
  return bounty.status === 'open'
}

export function canSubmitBounty(bounty: any, user: any) {
  if (!bounty || !user || user.accountStatus === 'banned') return false
  const acceptedById = relationId(bounty.acceptedBy)
  return bounty.status === 'accepted' && String(acceptedById || '') === String(user.id)
}

export function canUseSkillAsBountyDelivery(skill: any, user: any) {
  if (!skill || !user || user.accountStatus === 'banned') return false
  const authorId = relationId(skill.author)
  if (String(authorId || '') !== String(user.id)) return false
  return skill.status === 'published' && skill.visibility === 'public'
}
