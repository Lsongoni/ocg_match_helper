import { dateBounds, emptyEventFilters, type DateRange, type EventFilters } from './eventFilters'
import { formatDate } from './domain'

export function EventFilterControls({ value, onChange, decks, history = false }: {
  value: EventFilters
  onChange: (value: EventFilters) => void
  decks: string[]
  history?: boolean
}) {
  const bounds = dateBounds(value)
  return <section className="filter-form" aria-label={history ? '历史筛选' : '统计筛选'}>
    {history && <label className="field"><span className="field-label">搜索赛事或卡组</span><input type="search" placeholder="赛事名称、自己或对手卡组" value={value.query} onChange={e => onChange({ ...value, query: e.target.value })} /></label>}
    <div className="form-grid">
      <label className="field"><span className="field-label">时间范围</span><select value={value.range} onChange={e => onChange({ ...value, range: e.target.value as DateRange })}><option value="all">全部时间</option><option value="30">近 30 天</option><option value="90">近 90 天</option><option value="custom">自定义日期</option></select></label>
      <label className="field"><span className="field-label">自己的卡组</span><select value={value.ownDeck} onChange={e => onChange({ ...value, ownDeck: e.target.value })}><option value="">全部卡组</option>{value.ownDeck && !decks.includes(value.ownDeck) && <option value={value.ownDeck}>{value.ownDeck}（已无记录）</option>}{decks.map(deck => <option key={deck}>{deck}</option>)}</select></label>
    </div>
    {value.range === 'custom' && <div className="form-grid event-form-grid">{(['start', 'end'] as const).map(key => <label className="field" key={key}><span className="field-label">{key === 'start' ? '开始日期' : '结束日期'}</span><span className="event-date-input"><span aria-hidden="true">{value[key] ? formatDate(value[key]) : '不限'}</span><input type="date" value={value[key]} onChange={e => onChange({ ...value, [key]: e.target.value })} /></span></label>)}</div>}
    {bounds.start && bounds.end && bounds.start > bounds.end && <p className="error-message" role="alert">开始日期不能晚于结束日期。</p>}
    {history && <label className="field"><span className="field-label">出轮状态</span><select value={value.advancement} onChange={e => onChange({ ...value, advancement: e.target.value as EventFilters['advancement'] })}><option value="">全部状态</option><option value="in">已出轮</option><option value="out">没出轮</option><option value="undecided">待确认</option></select></label>}
    <div className="filter-summary"><span>{value.range === 'all' ? '全部日期' : `${bounds.start || '不限'} — ${bounds.end || '不限'}`}{value.range === '30' || value.range === '90' ? '（含今天）' : ''}</span><button className="text-button" onClick={() => onChange({ ...emptyEventFilters })}>重置筛选</button></div>
  </section>
}
