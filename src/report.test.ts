import { describe, expect, it } from 'vitest'
import { generateReport, reportFilename } from './report'
import type { EventRecord } from './domain'

const event: EventRecord = {
  id: 'event', name: 'XX杯', date: '2026-10-03', participants: 64,
  plannedSwissRounds: 6, cutSize: 8, ownDeck: '白森林', status: 'finished',
  advancement: 'out', firstKnockoutStage: null, totalNote: '今天状态不错。',
  matches: [{ id: 'm1', phase: 'swiss', round: 1, opponentDeck: 'M∀LICE', games: [
    { id: 'g1', result: 'O', turn: 'first', manualTurn: true, note: '展开成功' },
    { id: 'g2', result: 'X', turn: 'second', manualTurn: false, note: '' },
    { id: 'g3', result: 'O', turn: 'first', manualTurn: false, note: '反杀' },
  ] }], createdAt: '', updatedAt: '',
}

describe('战报', () => {
  it('简版按时间顺序输出，不追加重复的胜负符号', () => {
    const text = generateReport(event, false)
    expect(text).toContain('2026.10.03 XX杯')
    expect(text).toContain('R1 M∀LICE 先 OXO')
    expect(text).not.toContain('G1：')
    expect(text).not.toContain('○')
    expect(text).toContain('最终：没出轮')
  })
  it('完整版只加入实际填写的逐局备注及总备注', () => {
    const text = generateReport(event, true)
    expect(text).toContain('G1：展开成功')
    expect(text).not.toContain('G2：')
    expect(text).toContain('G3：反杀')
    expect(text).toContain('总备注：\n今天状态不错。')
  })
  it('导出文件名去除非法字符', () => {
    expect(reportFilename({ ...event, name: 'A/B:杯' })).toBe('2026-10-03-A_B_杯.txt')
  })
})
