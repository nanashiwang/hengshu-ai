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
      className={`btn flex-1 ${
        favorited
          ? 'border-[var(--warn)] text-[var(--warn)]'
          : 'btn-secondary'
      }`}
    >
      {favorited ? '★ 已收藏' : '☆ 收藏'}
    </button>
  )
}
