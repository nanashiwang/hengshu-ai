import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { STAFF_ROLES, ADMIN_GROUPS } from '@/lib/adminNav'

export const dynamic = 'force-dynamic'

// 后台落地：默认进入第一个集合
export default async function ConsoleAdminLanding() {
  const user = await getCurrentUser()
  if (!user || !STAFF_ROLES.includes((user as any).role)) notFound()
  redirect(`/console/admin/${ADMIN_GROUPS[0].items[0].slug}`)
}
