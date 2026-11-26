import { localToday, matchKind, visibleMatches, type EventRecord } from './domain'

export const normalizeDeck = (name: string) => name.trim().normalize('NFC')

/**
 * 筛选范围：卡表周期、自定义日期区间或全部。
 * 卡表在每年 1／4／7／10 月的 1 日生效，因此周期就是自然季度，
 * 用「生效月份」命名，例如 2026 年 10 月表覆盖 2026-10-01 至 2026-12-31。
 */
export type RangeMode = 'period' | 'custom' | 'all'

export interface CardPeriod {
  /** 生效年份。 */
  year: number
  /** 生效月份：1、4、7 或 10。 */
  month: number
  /** 周期首日，YYYY-MM-DD。 */
  start: string
  /** 周期末日，YYYY-MM-DD。 */
  end: string
  /** 展示名，例如「2026年10月表」。 */
  label: string
}

export interface EventFilters {
  range: RangeMode
  /** 选中的卡表周期首日，空表示当前周期。 */
  periodStart: string
  /** 用于统计对照的另一个周期首日，空表示不对照。 */
  compareStart: string
  start: string
  end: string
  ownDeck: string
  query: string
  advancement: '' | EventRecord['advancement']
}

export const emptyEventFilters: EventFilters = {
  range: 'period', periodStart: '', compareStart: '', start: '', end: '', ownDeck: '', query: '', advancement: '',
}

const PAD = (value: number) => String(value).padStart(2, '0')

/** 某日期所属卡表周期的生效年月。 */
export function periodOf(date: string): { year: number; month: number } {
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  if (!Number.isFinite(year) || !Number.isFinite(month)) return { year: 1970, month: 1 }
  // 1–3 月归入 1 月表，4–6 月归入 4 月表，依此类推。
  const index = Math.min(3, Math.max(0, Math.floor((month - 1) / 3)))
  return { year, month: [1, 4, 7, 10][index] }
}

/** 由生效年月构造完整周期。 */
export function buildPeriod(year: number, month: number): CardPeriod {
  const nextMonth = month === 10 ? 1 : month + 3
  const nextYear = month === 10 ? year + 1 : year
  const endDate = new Date(Date.UTC(nextYear, nextMonth - 1, 0))
  return {
    year,
    month,
    start: `${year}-${PAD(month)}-01`,
    end: `${endDate.getUTCFullYear()}-${PAD(endDate.getUTCMonth() + 1)}-${PAD(endDate.getUTCDate())}`,
    label: `${year}年${month}月表`,
  }
}

/** 包含指定日期的卡表周期，默认今天。 */
export function periodFor(date = localToday()): CardPeriod {
  const { year, month } = periodOf(date)
  return buildPeriod(year, month)
}

/** 周期首日 → 周期对象，非法输入返回 null。 */
export function periodFromStart(start: string): CardPeriod | null {
  if (!/^\d{4}-\d{2}-01$/.test(start)) return null
  const month = Number(start.slice(5, 7))
  if (![1, 4, 7, 10].includes(month)) return null
  return buildPeriod(Number(start.slice(0, 4)), month)
}

/** 相对某周期前后偏移若干个周期。 */
export function shiftPeriod(period: CardPeriod, delta: number): CardPeriod {
  const order = [1, 4, 7, 10]
  const index = order.indexOf(period.month) + delta
  const year = period.year + Math.floor(index / 4)
  const month = order[((index % 4) + 4) % 4]
  return buildPeriod(year, month)
}

/** 从赛事中找出所有出现过的周期，按时间从新到旧。 */
export function periodsInUse(events: EventRecord[]): CardPeriod[] {
  const seen = new Map<string, CardPeriod>()
  for (const event of events) {
    const period = periodFor(event.date)
    if (!seen.has(period.start)) seen.set(period.start, period)
  }
  return [...seen.values()].sort((a, b) => b.start.localeCompare(a.start))
}

/** 当前筛选生效的日期区间。 */
export function dateBounds(filters: EventFilters, today = localToday()): { start: string; end: string } {
  if (filters.range === 'custom') return { start: filters.start, end: filters.end }
  if (filters.range === 'all') return { start: '', end: '' }
  const period = filters.periodStart ? periodFromStart(filters.periodStart) : periodFor(today)
  return period ? { start: period.start, end: period.end } : { start: '', end: '' }
}

/** 对照周期的日期区间；未选择或与主周期相同则返回 null。 */
export function compareBounds(filters: EventFilters, today = localToday()): { start: string; end: string } | null {
  if (filters.range !== 'period' || !filters.compareStart) return null
  const period = periodFromStart(filters.compareStart)
  const primary = dateBounds(filters, today)
  if (!period || period.start === primary.start) return null
  return { start: period.start, end: period.end }
}

/** 只按日期区间过滤。 */
export function eventsInRange(events: EventRecord[], bounds: { start: string; end: string }): EventRecord[] {
  return events.filter(event => (!bounds.start || event.date >= bounds.start) && (!bounds.end || event.date <= bounds.end))
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
