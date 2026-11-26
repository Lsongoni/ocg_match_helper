import { describe, expect, it } from 'vitest'
import { advance, estimateLastRound, fieldLadder, isStandingProblem, pointsOf, verdictLabel } from './standings'

const sum = (field: Map<number, number>) => [...field.values()].reduce((total, count) => total + count, 0)

describe('大分与分数阶梯', () => {
  it('大分等于胜场×3 加平局数', () => {
    expect(pointsOf(5, 0)).toBe(15)
    expect(pointsOf(4, 1)).toBe(13)
    expect(pointsOf(3, 1)).toBe(10)
    expect(pointsOf(9, 5)).toBe(32)
  })

  it('无平局时阶梯与二项分布一致且总人数守恒', () => {
    for (const [people, rounds] of [[60, 5], [64, 6], [37, 4], [8, 3], [129, 7]] as const) {
      const field = fieldLadder(people, rounds)
      expect(sum(field)).toBeCloseTo(people, 6)
      if (people === 60 && rounds === 5) expect(field.get(15)).toBeCloseTo(60 / 32, 6)
    }
  })

  it('平局率掺入后仍守恒，且会出现非 3 倍数的分数', () => {
    const field = fieldLadder(60, 5, .2)
    expect(sum(field)).toBeCloseTo(60, 6)
    expect([...field.keys()].some(points => points % 3 !== 0)).toBe(true)
  })

  it('advance 保持人数守恒', () => {
    expect(sum(advance(new Map([[0, 60]])))).toBeCloseTo(60, 6)
    expect(sum(advance(new Map([[0, 60]]), .25))).toBeCloseTo(60, 6)
  })
})

describe('最后一轮出轮判断', () => {
  // 60 人 6 轮 Top8，打完 5 轮 4-1（12 分）排第 10。
  const base = { participants: 60, roundsPlayed: 5, cutSize: 8, myRank: 10, myWins: 4, myDraws: 0 }

  it('4-1 排第 10：赢进 Top8，输基本没戏', () => {
    const result = estimateLastRound(base)
    if (isStandingProblem(result)) throw new Error(result.error)
    const win = result.scenarios.find(s => s.outcome === 'win')!
    const loss = result.scenarios.find(s => s.outcome === 'loss')!
    expect(result.myPoints).toBe(12)
    expect(win.points).toBe(15)
    expect(win.expected).toBeLessThanOrEqual(8)
    expect(win.verdict).toBe('safe')
    expect(loss.points).toBe(12)
    expect(loss.expected).toBeGreaterThan(8)
    expect(loss.verdict).toBe('out')
  })

  it('平局战绩按实际大分计算，且不与 3 分阶梯错位', () => {
    // 4-1-0 → 12 分；3 胜 1 平 1 负 → 10 分。
    const result = estimateLastRound({ ...base, myWins: 3, myDraws: 1, myRank: 18 })
    if (isStandingProblem(result)) throw new Error(result.error)
    expect(result.myPoints).toBe(10)
    expect(result.drawRate).toBeCloseTo(.2, 6)
    expect(result.scenarios.find(s => s.outcome === 'win')!.points).toBe(13)
    expect(result.scenarios.find(s => s.outcome === 'draw')!.points).toBe(11)
  })

  it('有平局时也能定位同分组，不再退化成零人', () => {
    const result = estimateLastRound({ ...base, myWins: 3, myDraws: 1, myRank: 18 })
    if (isStandingProblem(result)) throw new Error(result.error)
    expect(result.groupSize).toBeGreaterThan(1)
    const draw = result.scenarios.find(s => s.outcome === 'draw')!
    expect(draw.tied).toBeGreaterThanOrEqual(1)
  })

  it('自己平局后与对手同分，需要比小分', () => {
    const result = estimateLastRound(base)
    if (isStandingProblem(result)) throw new Error(result.error)
    const draw = result.scenarios.find(s => s.outcome === 'draw')!
    expect(draw.points).toBe(13)
    expect(draw.worst).toBeGreaterThan(draw.best)
  })

  it('名次越好估算名次越好', () => {
    const values = [2, 5, 10, 18, 30, 55].map(myRank => {
      const result = estimateLastRound({ ...base, myRank })
      if (isStandingProblem(result)) throw new Error(result.error)
      return result.scenarios.find(s => s.outcome === 'win')!.expected
    })
    for (let index = 1; index < values.length; index += 1) expect(values[index]).toBeGreaterThanOrEqual(values[index - 1])
    expect(values[0]).toBeLessThan(values.at(-1)!)
  })

  it('大分相同但名次靠前时小分位置更好', () => {
    const early = estimateLastRound({ ...base, myRank: 8 })
    const late = estimateLastRound({ ...base, myRank: 12 })
    if (isStandingProblem(early) || isStandingProblem(late)) throw new Error('应以有效输入返回')
    expect(early.positionInGroup).toBeLessThan(late.positionInGroup)
    expect(early.scenarios[0].expected).toBeLessThanOrEqual(late.scenarios[0].expected)
  })

  it('排名第一且赢下最后一轮时名次为第一', () => {
    const result = estimateLastRound({ ...base, myRank: 1, myWins: 5, myDraws: 0 })
    if (isStandingProblem(result)) throw new Error(result.error)
    const win = result.scenarios.find(s => s.outcome === 'win')!
    expect(win.points).toBe(18)
    expect(win.expected).toBe(1)
    expect(win.verdict).toBe('safe')
  })

  it('排名末位即使赢下最后一轮也出不了轮', () => {
    const result = estimateLastRound({ ...base, myRank: 60, myWins: 1, myDraws: 0 })
    if (isStandingProblem(result)) throw new Error(result.error)
    expect(result.scenarios.find(s => s.outcome === 'win')!.verdict).toBe('out')
  })

  it('赢不差于平，平不差于输', () => {
    const result = estimateLastRound(base)
    if (isStandingProblem(result)) throw new Error(result.error)
    const by = (outcome: string) => result.scenarios.find(s => s.outcome === outcome)!
    expect(by('win').expected).toBeLessThanOrEqual(by('draw').expected)
    expect(by('draw').expected).toBeLessThanOrEqual(by('loss').expected)
  })

  it('晋级名额越多判定越宽松', () => {
    const verdictOf = (cutSize: number) => {
      const result = estimateLastRound({ ...base, cutSize })
      if (isStandingProblem(result)) throw new Error(result.error)
      return result.scenarios.find(s => s.outcome === 'win')!.verdict
    }
    expect(verdictOf(4)).toBe('border')
    expect(verdictOf(32)).toBe('safe')
  })

  it('拒绝无效输入', () => {
    const cases = [
      { ...base, participants: 2 },
      { ...base, roundsPlayed: 0 },
      { ...base, cutSize: 0 },
      { ...base, cutSize: 99 },
      { ...base, myRank: 0 },
      { ...base, myRank: 61 },
      { ...base, myWins: -1 },
      { ...base, myDraws: 1.5 },
      { ...base, myWins: 5, myDraws: 1 },
    ]
    for (const input of cases) expect(isStandingProblem(estimateLastRound(input))).toBe(true)
  })

  it('判定文案与状态一一对应', () => {
    expect(verdictLabel('safe')).toBe('稳')
    expect(verdictLabel('border')).toBe('看小分')
    expect(verdictLabel('out')).toBe('没戏')
  })
})
