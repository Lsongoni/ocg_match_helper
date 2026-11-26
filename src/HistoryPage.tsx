import { ChevronRight } from 'lucide-react'
import { formatDate, placement, totalRecord, type EventRecord } from './domain'
import { EventFilterControls } from './EventFilterControls'
import { deckNames, filterEvents, periodFor, type EventFilters } from './eventFilters'
import { EmptyArchive } from './illustrations'

export function HistoryPage({ events, filters, onFilters, onSelect }: { events: EventRecord[]; filters: EventFilters; onFilters: (value: EventFilters) => void; onSelect: (id: string) => void }) {
  const filtered = filterEvents(events, filters)
  // 按卡表周期分组，组内保持筛选后的顺序。
  const groups = new Map<string, { label: string; items: EventRecord[] }>()
  for (const event of filtered) {
    const period = periodFor(event.date)
    if (!groups.has(period.start)) groups.set(period.start, { label: period.label, items: [] })
    groups.get(period.start)!.items.push(event)
  }

  return <div className="page-stack">
    <div className="intro-block history-intro"><p className="eyebrow">比赛档案</p><h2>历史比赛</h2><p>按卡表周期归档，找回任何一场的细节。</p></div>
    <EventFilterControls value={filters} onChange={value => onFilters(value)} decks={deckNames(events, true)} events={events} history />
    <p className="subtle-note" role="status">显示 {filtered.length} / {events.length} 场赛事</p>
    {filtered.length ? <div className="archive">{[...groups].map(([start, group]) => <section className="archive-group" key={start}>
      <h3 className="archive-period">{group.label}<span>{group.items.length} 场</span></h3>
      <div className="archive-list">{group.items.map(event => <button key={event.id} className="archive-card" onClick={() => onSelect(event.id)}>
        <span className="archive-date">{formatDate(event.date)}</span>
        <span className="archive-body">
          <strong>{event.name}</strong>
          <small>{event.ownDeck} · {event.participants} 人</small>
        </span>
        <span className="archive-result">
          <b>{totalRecord(event)}</b>
          <em>{placement(event)}</em>
        </span>
        <ChevronRight size={17} className="archive-arrow" />
      </button>)}</div>
    </section>)}</div> : <div className="empty-panel">
      <EmptyArchive />
      <strong>{events.length ? '没有符合条件的比赛' : '还没有历史比赛'}</strong>
      <p>{events.length ? '换个卡表周期，或调整筛选条件。' : '创建赛事后，记录会保存在这台设备上。'}</p>
    </div>}
  </div>
}
