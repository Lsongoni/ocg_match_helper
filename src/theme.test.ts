import 'fake-indexeddb/auto'
import { afterEach, expect, it, vi } from 'vitest'
import { db, getSetting } from './db'
import { loadTheme, resolvedTheme, saveTheme, themePreference, watchSystemTheme } from './theme'

afterEach(async () => { await db.settings.clear(); vi.unstubAllGlobals() })

it('默认跟随系统，明确选择优先于系统外观', () => {
  expect(themePreference(undefined)).toBe('system')
  expect(themePreference('invalid')).toBe('system')
  expect(resolvedTheme('system', true)).toBe('dark')
  expect(resolvedTheme('system', false)).toBe('light')
  expect(resolvedTheme('light', true)).toBe('light')
  expect(resolvedTheme('dark', false)).toBe('dark')
})

it('持久化外观并响应系统变化，恢复旧设置时回到跟随系统', async () => {
  const meta = { setAttribute: vi.fn() }
  const root = { dataset: {} as Record<string, string> }
  let onChange = () => {}
  const media = { matches: false, addEventListener: vi.fn((_event, listener) => { onChange = listener }), removeEventListener: vi.fn() }
  vi.stubGlobal('document', { documentElement: root, querySelector: () => meta })
  vi.stubGlobal('window', { matchMedia: () => media })
  const stop = watchSystemTheme()
  await loadTheme()
  expect(root.dataset.theme).toBe('light')
  media.matches = true; onChange()
  expect(root.dataset.theme).toBe('dark')
  await saveTheme('light')
  expect(await getSetting('theme', 'system')).toBe('light')
  onChange()
  expect(root.dataset.theme).toBe('light')
  await saveTheme('dark')
  expect(await loadTheme()).toBe('dark')
  expect(meta.setAttribute).toHaveBeenLastCalledWith('content', '#141c19')
  await db.settings.clear()
  expect(await loadTheme()).toBe('system')
  stop()
  expect(media.removeEventListener).toHaveBeenCalled()
})
