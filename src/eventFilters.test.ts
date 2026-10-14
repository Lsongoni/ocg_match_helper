import { describe, expect, it } from 'vitest'
import { dateBounds, deckNames, emptyEventFilters, filterEvents, latestEvent, matchupEvents, reusableEventFields } from './eventFilters'
import { calculateStats } from './stats'
import type { EventRecord, MatchRecord } from './domain'

const match: MatchRecord = { id: 'm', phase: 'swiss', round: 1, opponentDeck: '青眼', games: [{ id: 'g', result: 'O', turn: 'first', manualTurn: true, note: '复盘' }] }
const event: EventRecord = { id: 'e', name: '周末店赛', date: '2026-10-14', participants: 32, plannedSwissRounds: 4, cutSize: 8, ownDeck: ' 白森林 ', status: 'finished', advancement: 'out', firstKnockoutStage: null, totalNote: '赛事备注', matches: [match], createdAt: '2026-10-14T09:00:00Z', updatedAt: '2026-10-14T09:00:00Z' }

describe('赛事筛选与对局分析', () => {
  it('近 30/90 天包含今天，跨月跨年按日历天计算', () => {
    expect(dateBounds({ ...emptyEventFilters, range: '30' }, '2026-01-01')).toEqual({ start: '2025-12-03', end: '2026-01-01' })
    expect(dateBounds({ ...emptyEventFilters, range: '90' }, '2026-10-14')).toEqual({ start: '2026-07-17', end: '2026-10-14' })
  })
  it('日期两端包含，排除未来和区间外的赛事', () => {
    const events = ['2026-09-14', '2026-09-15', '2026-10-14', '2026-10-15'].map(date => ({ ...event, id: date, date }))
    expect(filterEvents(events, { ...emptyEventFilters, range: '30' }, '2026-10-14').map(item => item.date)).toEqual(['2026-09-15', '2026-10-14'])
  })
  it('自定义日期支持单边，倒置范围不返回赛事', () => {
    expect(filterEvents([event], { ...emptyEventFilters, range: 'custom', start: '2026-10-14' })).toHaveLength(1)
    expect(filterEvents([event], { ...emptyEventFilters, range: 'custom', end: '2026-10-13' })).toHaveLength(0)
    expect(filterEvents([event], { ...emptyEventFilters, range: 'custom', start: '2026-10-15', end: '2026-10-14' })).toHaveLength(0)
  })
  it('名称搜索、自己的卡组、出轮和日期取交集', () => {
    const filters = { ...emptyEventFilters, query: '青眼', ownDeck: '白森林', advancement: 'out' as const, range: 'custom' as const, start: '2026-10-14', end: '2026-10-14' }
    const events = [event, { ...event, id: 'other', ownDeck: '其他' }, { ...event, id: 'in', advancement: 'in' as const }]
    expect(filterEvents(events, filters).map(item => item.id)).toEqual(['e'])
    expect(filterEvents([event], { ...emptyEventFilters, query: '周末' })).toHaveLength(1)
    expect(filterEvents([event], { ...emptyEventFilters, query: '白森林' })).toHaveLength(1)
  })
  it('对手搜索忽略隐藏淘汰赛和轮空，大小写不敏感', () => {
    const hidden = { ...match, id: 'hidden', phase: 'knockout' as const, opponentDeck: '隐藏' }
    const bye = { ...match, id: 'bye', kind: 'bye' as const, opponentDeck: '轮空旧名称', games: [] }
    const item = { ...event, matches: [{ ...match, opponentDeck: 'M∀LICE' }, hidden, bye] }
    expect(filterEvents([item], { ...emptyEventFilters, query: 'm∀lice' })).toHaveLength(1)
    expect(filterEvents([item], { ...emptyEventFilters, query: '隐藏' })).toHaveLength(0)
    expect(filterEvents([item], { ...emptyEventFilters, query: '轮空旧名称' })).toHaveLength(0)
  })
  it('全局统计只用筛选后的赛事，对局明细只用匹配的正常可见 Match', () => {
    const draw = { ...match, id: 'draw', games: [{ ...match.games[0], result: 'D' as const, turn: 'second' as const }] }
    const bye = { ...match, id: 'bye', kind: 'bye' as const, games: [] }
    const hidden = { ...match, id: 'hidden', phase: 'knockout' as const }
    const item = { ...event, matches: [match, draw, bye, hidden, { ...match, id: 'other', opponentDeck: '其他' }] }
    const filtered = filterEvents([item, { ...event, id: 'different', ownDeck: '其他' }], { ...emptyEventFilters, ownDeck: '白森林' })
    expect(calculateStats(filtered).matches.total).toBe(4)
    const details = matchupEvents(filtered, '青眼')
    expect(details[0].matches.map(item => item.id)).toEqual(['m', 'draw'])
    const stats = calculateStats(details)
    expect(stats.matches).toMatchObject({ total: 2, wins: 1, draws: 1, rate: .5 })
    expect(stats.firstTurnMatches).toMatchObject({ total: 1, rate: 1 })
    expect(stats.secondTurnMatches).toMatchObject({ total: 1, rate: 0 })
    expect(stats.games.total).toBe(2)
    expect(item.matches).toHaveLength(5)
  })
  it('卡组候选去除空白、规范 Unicode、去重，包含隐藏记录', () => {
    expect(deckNames([{ ...event, ownDeck: ' e\u0301 ', matches: [{ ...match, opponentDeck: 'é' }, { ...match, phase: 'knockout', opponentDeck: '隐藏' }] }])).toEqual(expect.arrayContaining(['é', '隐藏']))
    expect(deckNames([event], true)).toEqual(['白森林'])
  })
})

describe('沿用赛事设置', () => {
  it('按赛事日期选最近赛事，修改旧赛事不会改变来源', () => {
    const old = { ...event, id: 'old', date: '2026-10-01', updatedAt: '2026-10-15T00:00:00Z' }
    expect(latestEvent([old, event])?.id).toBe('e')
    expect(latestEvent([])).toBeUndefined()
  })
  it('只复制表单设置和今天，不带身份、结果、备注、照片引用或状态', () => {
    expect(reusableEventFields(event, '2026-10-15')).toEqual({ name: '周末店赛', date: '2026-10-15', participants: 32, plannedSwissRounds: 4, cutSize: 8, ownDeck: ' 白森林 ' })
    expect(event.date).toBe('2026-10-14')
  })
})
