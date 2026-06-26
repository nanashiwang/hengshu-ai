'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function FavoriteButton({
  slug,
  initial,
  loggedIn,
}: {
  slug: string
  initial: boolean
  loggedIn: boolean
}) {
  const router = useRouter()
  const [favorited, setFavorited] = useState(initial)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    if (!loggedIn) {
      router.push('/login')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/v1/skills/${slug}/favorite`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setFavorited(!!data.favorited)
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`flex-1 rounded-md border px-3 py-1.5 text-sm disabled:opacity-50 ${
        favorited
          ? 'border-[var(--warn)] text-[var(--warn)]'
          : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]'
      }`}
    >
      {favorited ? '★ 已收藏' : '☆ 收藏'}
    </button>
  )
}
