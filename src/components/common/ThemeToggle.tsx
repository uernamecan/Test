import { useUiStore } from '../../store/uiStore'
import { useSettingsStore } from '../../store/settingsStore'

export default function ThemeToggle() {
  const theme = useUiStore((state) => state.theme)
  const setTheme = useUiStore((state) => state.setTheme)
  const setThemeSetting = useSettingsStore((state) => state.setThemeSetting)
  const nextThemeLabel = theme === 'dark' ? 'Switch to light' : 'Switch to dark'
  const nextTheme = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      onClick={() => {
        setTheme(nextTheme)
        void setThemeSetting(nextTheme)
      }}
      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 transition hover:bg-white/10"
    >
      {nextThemeLabel}
    </button>
  )
}
