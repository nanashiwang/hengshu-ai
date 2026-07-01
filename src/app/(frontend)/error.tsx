'use client'

import Link from 'next/link'

// 前台错误边界（Next.js 要求为 Client Component）
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
      <div className="text-5xl">⚠️</div>
      <h1 className="text-xl font-semibold">出了点问题</h1>
      <p className="text-sm text-[var(--muted)]">页面加载失败，请稍后重试。</p>
      <div className="flex gap-3">
        <button type="button" onClick={() => reset()} className="btn btn-primary px-4 py-2">
          重试
        </button>
        <Link href="/" className="rounded-md border border-[var(--border)] px-4 py-2 text-sm">
          返回首页
        </Link>
      </div>
    </div>
  )
}
