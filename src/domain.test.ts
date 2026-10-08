import { describe, expect, it } from 'vitest'
import { countSwiss, knockoutStages, stageName, formatRecord, inferredNextTurn, matchOutcome, placement, recordOf, totalRecord, visibleMatches, type EventRecord, type MatchRecord } from './domain'
import { getTournamentFormat } from './swissRounds'

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
    expect(getTournamentFormat(64)?.swissRounds).toBe(6)
    expect(getTournamentFormat(20)?.swissRounds).toBe(4)
    expect(countSwiss(event([match('swiss', 1, 'OO'), match('swiss', 2, 'XX')]))).toBe(2)
  })

  it('轮空与对手未到按 Match 胜计分，但不伪造 Game', () => {
    const bye: MatchRecord = { id: 'bye', phase: 'swiss', round: 1, kind: 'bye', opponentDeck: '', games: [] }
    const noShow: MatchRecord = { id: 'no-show', phase: 'swiss', round: 2, kind: 'no-show', opponentDeck: '', games: [] }
    expect(matchOutcome(bye)).toBe('win')
    expect(formatRecord(recordOf([bye, noShow]))).toBe('2-0')
  })

  it('改为没出轮时隐藏淘汰赛记录，改回后可恢复', () => {
    const swiss = match('swiss', 1, 'OO')
    const knockout = match('knockout', 1, 'XX')
    const advanced = event([swiss, knockout], 8)
    const out: EventRecord = { ...advanced, advancement: 'out' }
    expect(visibleMatches(out)).toEqual([swiss])
    expect(totalRecord(out)).toBe('1-0')
    expect(visibleMatches({ ...out, advancement: 'in' })).toEqual([swiss, knockout])
  })

  it('按 M 序列推导淘汰赛名次', () => {
    expect(placement(event([match('knockout', 1, 'XX')], 8))).toBe('8强')
    expect(placement(event([match('knockout', 1, 'OO'), match('knockout', 2, 'XX')], 8))).toBe('4强')
    expect(placement(event([match('knockout', 1, 'OO'), match('knockout', 2, 'OO'), match('knockout', 3, 'XX')], 8))).toBe('亚军')
    expect(placement(event([match('knockout', 1, 'OO'), match('knockout', 2, 'OO'), match('knockout', 3, 'OO')], 8))).toBe('冠军')
  })
})

it.each([4, 8, 16])('Top %i 的 M 阶段按晋级人数生成', cut => {
  const stages = knockoutStages(cut)
  expect(stages.map(stageName)).toEqual(cut === 4 ? ['4强', '决赛'] : cut === 8 ? ['8强', '4强', '决赛'] : ['16强', '8强', '4强', '决赛'])
})
