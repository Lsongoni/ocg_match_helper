import { localToday, matchKind, visibleMatches, type EventRecord } from './domain'

export const normalizeDeck = (name: string) => name.trim().normalize('NFC')
export type DateRange = 'all' | '30' | '90' | 'custom'
export interface EventFilters {
  range: DateRange
  start: string
  end: string
  ownDeck: string
  query: string
  advancement: '' | EventRecord['advancement']
}
export const emptyEventFilters: EventFilters = { range: 'all', start: '', end: '', ownDeck: '', query: '', advancement: '' }

export function dateBounds(filters: EventFilters, today = localToday()) {
  if (filters.range === 'custom') return { start: filters.start, end: filters.end }
  if (filters.range === 'all') return { start: '', end: '' }
  // Use calendar days, including today, independently of DST and UTC offsets.
  const start = new Date(`${today}T00:00:00Z`)
  start.setUTCDate(start.getUTCDate() - Number(filters.range) + 1)
  return { start: start.toISOString().slice(0, 10), end: today }
}

export function filterEvents(events: EventRecord[], filters: EventFilters, today = localToday()) {
  const { start, end } = dateBounds(filters, today)
  const query = filters.query.trim().normalize('NFC').toLocaleLowerCase()
  return events.filter(event => (!start || event.date >= start) && (!end || event.date <= end)
    && (!filters.ownDeck || normalizeDeck(event.ownDeck) === filters.ownDeck)
    && (!filters.advancement || event.advancement === filters.advancement)
    && (!query || [event.name, event.ownDeck, ...visibleMatches(event).filter(match => matchKind(match) === 'normal').map(match => match.opponentDeck)]
      .some(value => value.normalize('NFC').toLocaleLowerCase().includes(query))))
}

export function deckNames(events: EventRecord[], ownOnly = false): string[] {
  return [...new Set(events.flatMap(event => [event.ownDeck, ...(ownOnly ? [] : event.matches.filter(match => matchKind(match) === 'normal').map(match => match.opponentDeck))])
    .map(normalizeDeck).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

export function matchupEvents(events: EventRecord[], opponent: string): EventRecord[] {
  return events.map(event => ({ ...event, matches: visibleMatches(event).filter(match => matchKind(match) === 'normal' && (normalizeDeck(match.opponentDeck) || '未知卡组') === opponent) }))
    .filter(event => event.matches.length > 0)
}

export function latestEvent(events: EventRecord[]): EventRecord | undefined {
  return [...events].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0]
}

export function reusableEventFields(event: EventRecord, today = localToday()) {
  return { name: event.name, date: today, participants: event.participants, plannedSwissRounds: event.plannedSwissRounds, cutSize: event.cutSize, ownDeck: event.ownDeck }
}
