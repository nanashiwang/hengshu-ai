type ThemeMode = 'light' | 'dark'

function label(theme: ThemeMode) {
  return theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'
}

function icon(theme: ThemeMode) {
  return theme === 'dark' ? '☀' : '☾'
}

export function ThemeToggle({ initialTheme = 'dark' }: { initialTheme?: ThemeMode }) {
  const theme = initialTheme === 'light' ? 'light' : 'dark'

  return (
    <button
      type="button"
      data-theme-toggle
      aria-label={label(theme)}
      title={label(theme)}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text)]"
    >
      <span data-theme-icon>{icon(theme)}</span>
    </button>
  )
}
