import React from 'react'
import './globals.css'
import { SiteNav } from '@/components/SiteNav'

export const metadata = {
  title: '元衡 SkillHub — 经过评测的 AI Skill 市场',
  description:
    '发现、运行、安装、评测和复用高质量 AI 技能，并通过贡献值机制获得更高权限和资源。',
}

// 在 React 注水前设置主题，避免浅/深色闪烁（FOUC）
const themeInitScript = `(function(){try{var t=localStorage.getItem('skillhub-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <SiteNav />
        <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
        <footer className="mt-12 border-t border-[var(--border)]">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-[var(--faint)] sm:flex-row sm:items-center sm:justify-between">
            <span>© 2026 元衡 SkillHub · v0.1</span>
            <span>New API 负责模型接入与计费 · SkillHub 负责任务封装、评测与分发</span>
          </div>
        </footer>
      </body>
    </html>
  )
}
