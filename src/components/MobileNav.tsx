'use client'

import { useState } from 'react'
import Link from 'next/link'

interface NavItem {
  href: string
  label: string
}

// 移动端汉堡菜单：暴露一级导航（桌面端由 SiteNav 的 hidden sm:flex 导航承担，本组件 sm:hidden）
export function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-label="菜单"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
      >
        {open ? '✕' : '☰'}
      </button>
      {open && (
        <>
          {/* 点击遮罩关闭 */}
          <button
            type="button"
            aria-label="关闭菜单"
            onClick={() => setOpen(false)}
            className="fixed inset-0 top-[57px] z-20 cursor-default bg-black/20"
          />
          <div className="absolute left-0 right-0 top-full z-30 border-b border-[var(--border)] bg-[var(--bg-elev)] px-4 py-2 shadow-lg">
            <nav className="flex flex-col">
              {items.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </>
      )}
    </div>
  )
}
