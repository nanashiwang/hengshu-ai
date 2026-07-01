import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
      <div className="text-5xl">🔍</div>
      <h1 className="text-xl font-semibold">页面不存在</h1>
      <p className="text-sm text-[var(--muted)]">你访问的内容可能已被移除、还未发布，或链接有误。</p>
      <Link href="/" className="btn btn-primary px-4 py-2">
        返回首页
      </Link>
    </div>
  )
}
