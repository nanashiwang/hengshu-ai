// 控制台共享展示组件（服务端组件，供 /console 各页复用）

export const ROLE_LABELS: Record<string, string> = {
  user: '普通用户',
  creator: '创作者',
  certified_creator: '认证创作者',
  reviewer: '审核员',
  admin: '管理员',
  enterprise_admin: '企业管理员',
}

export function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-[var(--muted)]">{children}</div>
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-lg font-bold text-[var(--accent)]">{value}</div>
      <div className="text-xs text-[var(--muted)]">{label}</div>
    </div>
  )
}
