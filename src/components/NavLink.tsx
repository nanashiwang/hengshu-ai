'use client'

import type { MouseEventHandler } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavLinkProps {
  href: string
  label: string
  variant?: 'desktop' | 'mobile'
  onClick?: MouseEventHandler<HTMLAnchorElement>
}

function trimPath(path: string) {
  return path.replace(/\/+$/, '') || '/'
}

function isActivePath(pathname: string | null, href: string) {
  const current = trimPath(pathname || '/')
  const target = trimPath(href)
  if (target === '/') return current === '/'
  return current === target || current.startsWith(`${target}/`)
}

export function NavLink({ href, label, variant = 'desktop', onClick }: NavLinkProps) {
  const pathname = usePathname()
  const active = isActivePath(pathname, href)
  const base =
    variant === 'mobile'
      ? 'rounded-lg px-3 py-2.5 text-sm transition-colors'
      : 'rounded-lg px-3 py-1.5 text-sm transition-colors'
  const state = active
    ? 'bg-[var(--panel-2)] font-medium text-[var(--accent)] shadow-sm'
    : 'text-[var(--muted)] hover:bg-[var(--panel-2)] hover:text-[var(--text)]'

  return (
    <Link href={href} onClick={onClick} aria-current={active ? 'page' : undefined} className={`${base} ${state}`}>
      {label}
    </Link>
  )
}
