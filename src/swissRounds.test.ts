import { describe, expect, it } from 'vitest'
import { getTournamentFormat } from './swissRounds'
import { runSwissSimulation } from './simulation'

describe('人数区间规则', () => {
  it.each([
    [8, 3, 4], [9, 4, 4], [16, 4, 4], [17, 4, 8], [20, 4, 8],
    [32, 4, 8], [33, 5, 8], [48, 5, 8], [49, 6, 8], [64, 6, 8],
    [65, 6, 16], [128, 6, 16], [129, 7, 16], [150, 7, 16],
  ])('%i 人推荐 %i 轮 Top %i', (people, swissRounds, topCut) => {
    expect(getTournamentFormat(people)).toEqual({ swissRounds, topCut })
  })
  it.each([0, 2, 7, 8.5, NaN, Infinity])('%s 人不擅自推荐', people => {
    expect(getTournamentFormat(people)).toBeNull()
  })
  it.each([[4, 8], [3, 4]])('20 人模拟使用实际 %i 轮 Top %i', (rounds, cutSize) => {
    const result = runSwissSimulation({ participants: 20, rounds, cutSize, drawRate: .03, iterations: 100 })
    expect(result.rows.every(row => row.wins + row.losses + row.draws === rounds)).toBe(true)
    expect(result.rows.reduce((sum, row) => sum + row.qualifications, 0)).toBe(100 * cutSize)
  })
})
