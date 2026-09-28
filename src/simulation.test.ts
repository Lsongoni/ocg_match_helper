import { describe, expect, it } from 'vitest'
import { findRecord, runSwissSimulation, validateSimulationInput } from './simulation'

describe('瑞士轮模拟', () => {
  it('两人一轮无平局时，胜者总能晋级', () => {
    const result = runSwissSimulation({ participants: 2, rounds: 1, cutSize: 1, drawRate: 0, iterations: 500 })
    expect(findRecord(result, 1, 0, 0)?.rate).toBe(1)
    expect(findRecord(result, 0, 1, 0)?.rate).toBe(0)
    expect(result.rows.reduce((sum, row) => sum + row.appearances, 0)).toBe(1_000)
  })

  it('全平局时同分随机，晋级率接近 50%', () => {
    const result = runSwissSimulation({ participants: 2, rounds: 1, cutSize: 1, drawRate: 1, iterations: 500 })
    expect(findRecord(result, 0, 0, 1)?.rate).toBe(.5)
  })

  it('奇数人数轮空仍保证每名选手每轮有一个结果', () => {
    const result = runSwissSimulation({ participants: 3, rounds: 2, cutSize: 2, drawRate: .03, iterations: 100 })
    expect(result.rows.reduce((sum, row) => sum + row.appearances, 0)).toBe(300)
    expect(result.rows.reduce((sum, row) => sum + row.qualifications, 0)).toBe(200)
    expect(result.rows.every(row => row.wins + row.losses + row.draws === 2)).toBe(true)
  })

  it('拒绝不合法参数，但不设固定参赛人数上限', () => {
    expect(validateSimulationInput({ participants: 0, rounds: 6, cutSize: 8, drawRate: .03, iterations: 100_000 })).toBeTruthy()
    expect(validateSimulationInput({ participants: 512, rounds: 9, cutSize: 32, drawRate: .03, iterations: 100_000 })).toBeNull()
  })
})
