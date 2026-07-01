// 前台加载骨架（force-dynamic 页面查询期间展示，避免白屏）
export default function Loading() {
  return (
    <div className="space-y-4 py-8" aria-busy="true" aria-label="加载中">
      <div className="h-8 w-1/3 animate-pulse rounded-lg bg-[var(--panel-2)]" />
      <div className="h-32 animate-pulse rounded-xl bg-[var(--panel-2)]" />
      <div className="h-32 animate-pulse rounded-xl bg-[var(--panel-2)]" />
    </div>
  )
}
