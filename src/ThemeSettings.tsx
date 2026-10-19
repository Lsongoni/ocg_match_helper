import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { loadTheme, saveTheme, type ThemePreference } from './theme'

const options = [
  { value: 'system', label: '跟随系统', Icon: Monitor },
  { value: 'light', label: '浅色', Icon: Sun },
  { value: 'dark', label: '深色', Icon: Moon },
] as const

export function ThemeSettings() {
  const [selected, setSelected] = useState<ThemePreference>('system')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    void loadTheme().then(setSelected).catch(() => setError('无法读取外观设置。')).finally(() => setBusy(false))
  }, [])

  async function choose(value: ThemePreference) {
    setBusy(true)
    try { await saveTheme(value); setSelected(value); setError('') }
    catch { setError('外观设置保存失败，请重试。') }
    finally { setBusy(false) }
  }

  return <section className="settings-card"><div className="settings-heading"><Moon size={22} /><div><h3>外观</h3><p>选择适合当前光线的界面</p></div></div>
    <div className="segmented theme-options" role="group" aria-label="外观模式">{options.map(({ value, label, Icon }) => <button type="button" key={value} className={selected === value ? 'selected' : ''} aria-pressed={selected === value} disabled={busy} onClick={() => void choose(value)}><Icon size={18} /><span>{label}</span></button>)}</div>
    <p>跟随系统会随设备的深浅色模式自动切换，选择会保存在本机并包含在完整备份中。</p>
    {error && <p className="error-message" role="alert">{error}</p>}
  </section>
}
