import React from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

const updateSW = registerSW({
  onNeedRefresh() {
    if (window.confirm('新版本已准备好。现在更新应用？未保存的输入可能会丢失。')) void updateSW(true)
  },
})

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
