import { getSetting, setSetting } from './db'

export type ThemePreference = 'system' | 'light' | 'dark'

export function themePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system'
}

export function resolvedTheme(preference: ThemePreference, systemDark: boolean): 'light' | 'dark' {
  return preference === 'system' ? (systemDark ? 'dark' : 'light') : preference
}

let preference: ThemePreference = 'system'

function applyTheme() {
  const theme = resolvedTheme(preference, window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#141c19' : '#f6f7f3')
}

export async function loadTheme(): Promise<ThemePreference> {
  preference = themePreference(await getSetting('theme', 'system'))
  applyTheme()
  return preference
}

export async function saveTheme(next: ThemePreference): Promise<void> {
  await setSetting('theme', next)
  preference = next
  applyTheme()
}

export function watchSystemTheme(): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  applyTheme()
  media.addEventListener('change', applyTheme)
  return () => media.removeEventListener('change', applyTheme)
}
