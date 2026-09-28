import { describe, expect, it } from 'vitest'
import { countSwiss, formatRecord, inferredNextTurn, matchOutcome, placement, recommendedRounds, recordOf, type EventRecord, type MatchRecord } from './domain'

function match(phase: 'swiss' | 'knockout', round: number, sequence: string): MatchRecord {
  return {
    id: `${phase}-${round}`, phase, round, opponentDeck: '测试卡组',
    games: [...sequence].map((result, index) => ({ id: `${round}-${index}`, result: result as 'O' | 'X' | 'D', turn: 'first', manualTurn: true, note: '' })),
  }
}

function event(matches: MatchRecord[], firstKnockoutStage: number | null = null): EventRecord {
  return {
    id: 'event', name: '测试赛', date: '2026-09-28', participants: 64,
    plannedSwissRounds: 6, cutSize: 8, ownDeck: '白森林', status: 'active',
    advancement: firstKnockoutStage ? 'in' : 'undecided', firstKnockoutStage,
    totalNote: '', matches, createdAt: '', updatedAt: '',
  }
}

describe('赛事领域规则', () => {
  it('按 Game 胜负数判断 Match，D 不计胜负', () => {
    expect(matchOutcome(match('swiss', 1, 'OXO'))).toBe('win')
    expect(matchOutcome(match('swiss', 1, 'OXX'))).toBe('loss')
    expect(matchOutcome(match('swiss', 1, 'ODX'))).toBe('draw')
    expect(formatRecord(recordOf([match('swiss', 1, 'OO'), match('swiss', 2, 'ODX')]))).toBe('1-0-1')
  })

  it('按上一局结果推断下一局先后攻，平局不推断', () => {
    expect(inferredNextTurn('O')).toBe('second')
    expect(inferredNextTurn('X')).toBe('first')
    expect(inferredNextTurn('D')).toBeNull()
  })

  it('区分计划与已打瑞士轮数，推荐轮数可手动覆盖', () => {
    expect(recommendedRounds(64)).toBe(6)
    expect(countSwiss(event([match('swiss', 1, 'OO'), match('swiss', 2, 'XX')]))).toBe(2)
  })

  it('按 M 序列推导淘汰赛名次', () => {
    expect(placement(event([match('knockout', 1, 'XX')], 8))).toBe('8强')
    expect(placement(event([match('knockout', 1, 'OO'), match('knockout', 2, 'XX')], 8))).toBe('4强')
    expect(placement(event([match('knockout', 1, 'OO'), match('knockout', 2, 'OO'), match('knockout', 3, 'XX')], 8))).toBe('亚军')
    expect(placement(event([match('knockout', 1, 'OO'), match('knockout', 2, 'OO'), match('knockout', 3, 'OO')], 8))).toBe('冠军')
  })
})
