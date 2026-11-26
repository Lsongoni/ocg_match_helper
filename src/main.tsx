import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'
import { loadTheme, watchSystemTheme } from './theme'
import { registerUpdates, watchVisibility } from './updates'

watchSystemTheme()
// Apply the saved preference before mounting the interface.
void loadTheme().catch(error => console.error('无法读取外观设置', error)).then(() => createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
))

// 注册 Service Worker：新版本就绪时由界面里的更新条提示，不再弹 confirm。
registerUpdates()
watchVisibility()

function adjustForKeyboard() {
  const viewport = window.visualViewport
  const gap = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0
  const active = document.activeElement
  const focused = active instanceof HTMLElement && active.matches('input:not([type="checkbox"]):not([type="radio"]), textarea, select')
  document.body.classList.toggle('form-focused', focused && window.innerWidth < 700)
  document.documentElement.style.setProperty('--keyboard-offset', `${gap}px`)
  if (focused && gap > 100) active.scrollIntoView({ block: 'nearest' })
}
document.addEventListener('focusin', adjustForKeyboard)
document.addEventListener('focusout', () => window.setTimeout(adjustForKeyboard, 50))
window.visualViewport?.addEventListener('resize', adjustForKeyboard)
