export function ThemeToggle() {
  return (
    <button
      type="button"
      data-theme-toggle
      aria-label="切换到浅色主题"
      title="切换到浅色主题"
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text)]"
    >
      <span data-theme-icon>☀</span>
    </button>
  )
}
