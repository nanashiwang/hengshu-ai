import type { Payload, PayloadRequest } from 'payload'

type NotifyType =
  | 'skill_favorited'
  | 'review'
  | 'bounty_accepted'
  | 'bounty_submitted'
  | 'bounty_completed'
  | 'system'

// 写一条站内通知（#17）。fire-and-forget：永不因通知失败中断业务；自操作(actor===接收者)不通知。
export async function notify(
  payload: Payload,
  args: {
    userId: string
    type: NotifyType
    title: string
    body?: string
    link?: string
    relatedSkill?: string
    relatedBounty?: string
    actorId?: string
    req?: Partial<PayloadRequest>
  },
): Promise<void> {
  const { userId, actorId } = args
  if (!userId) return
  if (actorId && String(actorId) === String(userId)) return // 不给自己发
  try {
    await payload.create({
      collection: 'notifications',
      overrideAccess: true,
      data: {
        user: userId,
        type: args.type,
        title: args.title,
        body: args.body,
        link: args.link,
        relatedSkill: args.relatedSkill,
        relatedBounty: args.relatedBounty,
      },
      ...(args.req ? { req: args.req } : {}),
    })
  } catch (e) {
    payload.logger?.error(`notify 失败: ${(e as Error).message}`)
  }
}
