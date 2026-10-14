import { useState } from 'react'
import type { EventRecord } from './domain'
import { deckNames, normalizeDeck } from './eventFilters'
import { mergeDeckNames, planDeckMerge } from './deckManagement'

export function DeckManager({ events, onChanged }: { events: EventRecord[]; onChanged: () => Promise<void> }) {
  const [sources, setSources] = useState<string[]>([])
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const names = deckNames(events)
  const plan = planDeckMerge(events, sources, target)
  async function merge() {
    if (!plan.updates.length || !confirm(`将 ${sources.join('、')} 统一为“${normalizeDeck(target)}”。影响 ${plan.updates.length} 场赛事、${plan.ownCount} 处自己的卡组和 ${plan.opponentCount} 处对手卡组（含 ${plan.hiddenCount} 处隐藏淘汰赛记录）。历史记录中的名称会一并修改，不能一键撤销。确认合并？`)) return
    setBusy(true); setError(''); setSuccess('')
    try {
      await mergeDeckNames(sources, target, plan)
      await onChanged()
      setSources([]); setTarget('')
      setSuccess(`已统一 ${plan.updates.length} 场赛事中的卡组名称。`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : '合并失败，请重试。') }
    finally { setBusy(false) }
  }
  return <section className="settings-card deck-manager"><div className="settings-heading"><div><h3>卡组名称管理</h3><p>统一简称或别名，让统计正确归到同一卡组。</p></div></div>
    {!names.length ? <p>记录使用卡组后，可在这里管理名称。</p> : <>
      <fieldset disabled={busy} className="deck-name-options"><legend>选择需要修改的旧名称</legend>{names.map(name => <label key={name} className="filter-checkbox"><input type="checkbox" checked={sources.includes(name)} onChange={e => { setSources(e.target.checked ? [...sources, name] : sources.filter(source => source !== name)); setError(''); setSuccess('') }} /><span>{name}</span></label>)}</fieldset>
      <label className="field"><span className="field-label">统一名称</span><input value={target} disabled={busy} list="managed-deck-names" placeholder="选择已有名称或填写新名称" onChange={e => { setTarget(e.target.value); setError(''); setSuccess('') }} /><datalist id="managed-deck-names">{names.map(name => <option key={name} value={name} />)}</datalist></label>
      {plan.updates.length > 0 && <div className="restore-preview" aria-live="polite"><strong>合并到：{normalizeDeck(target)}</strong><span>影响 {plan.updates.length} 场赛事</span><span>自己的卡组 {plan.ownCount} 处 · 对手卡组 {plan.opponentCount} 处</span><span>包含隐藏淘汰赛记录 {plan.hiddenCount} 处</span></div>}
      <p>历史记录、统计和战报会使用统一名称。只修改你选择的名称，不会自动判断别名。建议合并前保存完整备份。</p>
      <button className="button secondary full-width" disabled={busy || !plan.updates.length} onClick={() => void merge()}>{busy ? '正在合并…' : '确认合并名称'}</button>
    </>}
    {error && <p className="error-message" role="alert">{error}</p>}{success && <p className="success-message" role="status">{success}</p>}
  </section>
}
