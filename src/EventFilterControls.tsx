import { useMemo } from 'react'
import { emptyEventFilters, periodFor, periodFromStart, periodsInUse, type EventFilters, type RangeMode } from './eventFilters'
import { formatDate, type EventRecord } from './domain'

export function EventFilterControls({ value, onChange, decks, events, history = false }: {
  value: EventFilters
  onChange: (value: EventFilters) => void
  decks: string[]
  events: EventRecord[]
  history?: boolean
}) {
  const current = periodFor()
  const used = useMemo(() => periodsInUse(events), [events])
  // 当前周期即使还没有赛事也要出现在列表里，方便确认“这个月还没打”。
  const periods = useMemo(() => {
    const list = used.some(period => period.start === current.start) ? used : [current, ...used]
    return [...list].sort((a, b) => b.start.localeCompare(a.start))
  }, [used, current])

  const activeStart = value.periodStart || current.start
  const active = periodFromStart(activeStart) ?? current
  const compareOptions = periods.filter(period => period.start !== active.start)

  function setRange(range: RangeMode) {
    onChange({ ...value, range })
  }

  return <details className="filter-drawer">
    <summary>
      <span className="filter-drawer-label">{history ? '筛选条件' : '统计范围'}</span>
      <span className="filter-drawer-value">{value.range === 'period' ? active.label : value.range === 'custom' ? '自定义日期' : '全部时间'}{value.ownDeck ? ` · ${value.ownDeck}` : ''}</span>
    </summary>
    <section className="filter-form" aria-label={history ? '历史筛选' : '统计筛选'}>
    {history && <label className="field"><span className="field-label">搜索赛事或卡组</span><input type="search" placeholder="赛事名称、自己或对手卡组" value={value.query} onChange={e => onChange({ ...value, query: e.target.value })} /></label>}

    <div className="field">
      <span className="field-label">时间范围</span>
      <div className="segmented" role="group" aria-label="时间范围方式">
        {([['period', '卡表周期'], ['custom', '自定义'], ['all', '全部']] as const).map(([mode, label]) =>
          <button key={mode} type="button" className={value.range === mode ? 'selected' : ''} aria-pressed={value.range === mode} onClick={() => setRange(mode)}>{label}</button>,
        )}
      </div>
    </div>

    {value.range === 'period' && <>
      <label className="field"><span className="field-label">卡表</span>
        <select value={activeStart} onChange={e => onChange({ ...value, periodStart: e.target.value, compareStart: value.compareStart === e.target.value ? '' : value.compareStart })}>
          {periods.map(period => <option key={period.start} value={period.start}>{period.label}</option>)}
        </select>
      </label>
      <p className="period-summary">{active.label} · {formatDate(active.start)} — {formatDate(active.end)}</p>
      {!history && <details className="compare-toggle">
        <summary>{value.compareStart ? `对照：${periodFromStart(value.compareStart)?.label ?? '已选'}` : '与上一周期对照'}</summary>
        <label className="field"><span className="field-label">对照周期</span>
          <select value={value.compareStart} onChange={e => onChange({ ...value, compareStart: e.target.value })}>
            <option value="">不对比</option>
            {compareOptions.map(period => <option key={period.start} value={period.start}>{period.label}</option>)}
          </select>
        </label>
      </details>}
    </>}

    {value.range === 'custom' && <div className="form-grid event-form-grid">
      {(['start', 'end'] as const).map(key =>
        <label className="field" key={key}><span className="field-label">{key === 'start' ? '开始日期' : '结束日期'}</span>
          <span className="event-date-input"><span aria-hidden="true">{value[key] ? formatDate(value[key]) : '不限'}</span><input type="date" value={value[key]} onChange={e => onChange({ ...value, [key]: e.target.value })} /></span>
        </label>,
      )}
    </div>}

    <div className="form-grid">
      <label className="field"><span className="field-label">自己的卡组</span><select value={value.ownDeck} onChange={e => onChange({ ...value, ownDeck: e.target.value })}><option value="">全部卡组</option>{value.ownDeck && !decks.includes(value.ownDeck) && <option value={value.ownDeck}>{value.ownDeck}（已无记录）</option>}{decks.map(deck => <option key={deck}>{deck}</option>)}</select></label>
      {history && <label className="field"><span className="field-label">出轮状态</span><select value={value.advancement} onChange={e => onChange({ ...value, advancement: e.target.value as EventFilters['advancement'] })}><option value="">全部状态</option><option value="in">已出轮</option><option value="out">没出轮</option><option value="undecided">待确认</option></select></label>}
    </div>

    {value.range === 'custom' && value.start && value.end && value.start > value.end && <p className="error-message" role="alert">开始日期不能晚于结束日期。</p>}

    <div className="filter-summary">
      <span>{value.range === 'period' ? active.label : value.range === 'custom' ? `${value.start || '不限'} — ${value.end || '不限'}` : '全部时间'}</span>
      <button className="text-button" onClick={() => onChange({ ...emptyEventFilters })}>重置筛选</button>
    </div>
    </section>
  </details>
}
