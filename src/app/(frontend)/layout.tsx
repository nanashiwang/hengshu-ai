import React from 'react'
import './globals.css'
import { SiteNav } from '@/components/SiteNav'

export const metadata = {
  title: '衡术 Hengshu — Verified AI Skills, Powered by Contribution.',
  description:
    '发现、运行、安装、评测和复用高质量 AI 技能，并通过贡献值机制获得更高权限和资源。',
}

// 在 React 注水前设置主题，并用原生事件接管右上角切换，避免前端 hydration 异常时按钮失效。
const themeInitScript = `(function(){function clean(t){return t==='light'||t==='dark'?t:'dark'}function label(t){return t==='dark'?'切换到浅色主题':'切换到深色主题'}function icon(t){return t==='dark'?'☀':'☾'}function apply(t,save){t=clean(t);document.documentElement.setAttribute('data-theme',t);if(save){try{localStorage.setItem('skillhub-theme',t)}catch(e){}}document.querySelectorAll('[data-theme-toggle]').forEach(function(btn){btn.setAttribute('aria-label',label(t));btn.setAttribute('title',label(t));var i=btn.querySelector('[data-theme-icon]');if(i)i.textContent=icon(t)})}try{apply(localStorage.getItem('skillhub-theme')||'dark',false)}catch(e){apply('dark',false)}function bind(){apply(document.documentElement.getAttribute('data-theme')||'dark',false);document.addEventListener('click',function(e){var btn=e.target&&e.target.closest?e.target.closest('[data-theme-toggle]'):null;if(!btn)return;var cur=clean(document.documentElement.getAttribute('data-theme'));apply(cur==='dark'?'light':'dark',true)})}if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',bind,{once:true})}else{bind()}})();`

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <SiteNav />
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
        <footer className="border-t border-[var(--border)]">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-2 px-4 py-8 text-xs text-[var(--faint)] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <span>© 2026 衡术 Hengshu · v0.1</span>
            <span>Verified AI Skills, Powered by Contribution.</span>
          </div>
        </footer>
      </body>
    </html>
  )
}
