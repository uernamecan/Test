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
      className="rounded-full bg-black/5 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/10 dark:bg-white/8 dark:text-slate-200 dark:hover:bg-white/12"
    >
      {nextThemeLabel.replace('Switch to ', '')}
    </button>
  )
}
