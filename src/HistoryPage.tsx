import { ChevronRight } from 'lucide-react'
import { formatDate, placement, totalRecord, type EventRecord } from './domain'
import { EventFilterControls } from './EventFilterControls'
import { deckNames, filterEvents, type EventFilters } from './eventFilters'

export function HistoryPage({ events, filters, onFilters, onSelect }: { events: EventRecord[]; filters: EventFilters; onFilters: (value: EventFilters) => void; onSelect: (id: string) => void }) {
  const filtered = filterEvents(events, filters)
  return <div className="page-stack"><div className="intro-block history-intro"><p className="eyebrow">YOUR ARCHIVE</p><h2>历史比赛</h2><p>按赛事、卡组和日期找回比赛记录。</p></div>
    <EventFilterControls value={filters} onChange={onFilters} decks={deckNames(events, true)} history />
    <p className="subtle-note" role="status">显示 {filtered.length} / {events.length} 场赛事</p>
    {filtered.length ? <div className="history-list">{filtered.map(event => <button key={event.id} className="history-card" onClick={() => onSelect(event.id)}><span>{formatDate(event.date)} · {event.participants} 人</span><div><strong>{event.name}</strong><ChevronRight size={20} /></div><p>{event.ownDeck} · {totalRecord(event)} · {placement(event)}</p></button>)}</div> : <div className="empty-panel"><strong>{events.length ? '没有符合条件的比赛' : '还没有历史比赛'}</strong><p>{events.length ? '试试调整或重置筛选条件。' : '创建赛事后，记录会保存在这台设备上。'}</p></div>}
  </div>
}
