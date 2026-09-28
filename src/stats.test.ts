import { describe, expect, it } from 'vitest'
import { calculateStats } from './stats'
import type { EventRecord } from './domain'

const event: EventRecord = {
  id: 'e', name: '杯赛', date: '2026-09-28', participants: 32, plannedSwissRounds: 2, cutSize: 8,
  ownDeck: '白森林', status: 'finished', advancement: 'out', firstKnockoutStage: null,
  totalNote: '', createdAt: '', updatedAt: '', matches: [
    { id: 'm1', phase: 'swiss', round: 1, opponentDeck: 'M∀LICE', games: [
      { id: 'g1', result: 'O', turn: 'first', manualTurn: true, note: '' },
      { id: 'g2', result: 'X', turn: 'second', manualTurn: false, note: '' },
      { id: 'g3', result: 'O', turn: 'first', manualTurn: false, note: '' },
    ] },
    { id: 'm2', phase: 'swiss', round: 2, opponentDeck: 'M∀LICE', games: [
      { id: 'g4', result: 'O', turn: 'second', manualTurn: true, note: '' },
      { id: 'g5', result: 'X', turn: 'first', manualTurn: false, note: '' },
    ] },
  ],
}

describe('自动统计', () => {
  it('Match 与 Game 胜率均以胜场除以包括平局的总场数', () => {
    const stats = calculateStats([event])
    expect(stats.eventCount).toBe(1)
    expect(stats.swissMatchCount).toBe(2)
    expect(stats.matches).toMatchObject({ wins: 1, draws: 1, total: 2, rate: .5 })
    expect(stats.games).toMatchObject({ wins: 3, losses: 2, total: 5, rate: .6 })
    expect(stats.firstTurnMatches).toMatchObject({ wins: 1, total: 1, rate: 1 })
    expect(stats.secondTurnMatches).toMatchObject({ draws: 1, total: 1, rate: 0 })
  })
  it('按双方卡组汇总，并按 Game 位置统计', () => {
    const stats = calculateStats([event])
    expect(stats.ownDecks[0].record.total).toBe(2)
    expect(stats.opponentDecks[0].name).toBe('M∀LICE')
    expect(stats.gamePositions[2]).toMatchObject({ wins: 1, total: 1 })
  })
})
