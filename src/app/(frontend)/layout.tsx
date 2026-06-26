import React from 'react'
import './globals.css'
import { SiteNav } from '@/components/SiteNav'

export const metadata = {
  title: '元衡 SkillHub — 经过评测的 AI Skill 市场',
  description:
    '发现、运行、安装、评测和复用高质量 AI 技能，并通过贡献值机制获得更高权限和资源。',
}

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <SiteNav />
        <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
        <footer className="mx-auto w-full max-w-6xl px-4 py-10 text-xs text-[var(--muted)]">
          元衡 SkillHub · v0.1 · New API 负责模型接入与计费，SkillHub 负责任务封装、评测与分发
        </footer>
      </body>
    </html>
  )
}
