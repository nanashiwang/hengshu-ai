'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// 挂载后把本用户未读通知标为已读（不在服务端 render 内 mutate，避免 Link prefetch 提前触发），
// 成功后 refresh 让导航未读角标归零。
export function MarkNotificationsRead({ hasUnread }: { hasUnread: boolean }) {
  const router = useRouter()
  useEffect(() => {
    if (!hasUnread) return
    fetch('/v1/notifications/read', { method: 'POST', credentials: 'include' })
      .then((r) => {
        if (r.ok) router.refresh()
      })
      .catch(() => {})
    // 仅挂载时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
