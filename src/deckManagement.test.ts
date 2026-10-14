import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { db } from './db'
import { mergeDeckNames, planDeckMerge } from './deckManagement'
import type { EventRecord } from './domain'
import { calculateStats } from './stats'
import { buildBackup, loadBackup } from './backup'
import Dexie from 'dexie'

const event: EventRecord = { id: 'e', name: '店赛', date: '2026-10-14', participants: 16, plannedSwissRounds: 4, cutSize: 4, ownDeck: ' 简称 ', status: 'finished', advancement: 'out', firstKnockoutStage: null, totalNote: '保留备注', createdAt: '2026-10-14T00:00:00Z', updatedAt: '2026-10-14T00:00:00Z', matches: [
  { id: 'm', phase: 'swiss', round: 1, opponentDeck: '别名', games: [{ id: 'g', result: 'O', turn: 'first', manualTurn: true, note: '小局备注' }] },
  { id: 'hidden', phase: 'knockout', round: 1, opponentDeck: '简称', games: [{ id: 'h', result: 'X', turn: 'second', manualTurn: true, note: '' }] },
  { id: 'bye', phase: 'swiss', round: 2, kind: 'bye', opponentDeck: '', games: [] },
] }
afterEach(async () => { vi.restoreAllMocks(); await db.events.clear(); await db.photos.clear(); await db.settings.clear() })

describe('卡组名称合并', () => {
  it('预览包含双方名称及隐藏淘汰赛，不修改原始对象', () => {
    const plan = planDeckMerge([event], ['简称', '别名'], '统一名称')
    expect(plan).toMatchObject({ ownCount: 1, opponentCount: 2, hiddenCount: 1 })
    expect(plan.updates).toHaveLength(1)
    expect(event.ownDeck).toBe(' 简称 ')
    expect(plan.updates[0].matches[2]).toEqual(event.matches[2])
  })
  it('拒绝空名称和同名操作，不自动猜测未选别名', async () => {
    expect(planDeckMerge([event], ['简称'], '  ').updates).toHaveLength(0)
    expect(planDeckMerge([event], ['简称'], '简称').updates).toHaveLength(0)
    const plan = planDeckMerge([event], ['简称'], '新名')
    expect(plan.updates[0].matches[0].opponentDeck).toBe('别名')
    await expect(mergeDeckNames(['简称'], '', plan)).rejects.toThrow('请选择旧名称')
  })
  it('事务合并后统计归一，保留 Game/备注/照片，并可按原备份格式导出', async () => {
    const second = { ...event, id: 'e2', ownDeck: '统一名称', matches: [] }
    await db.events.bulkPut([event, second])
    const photo = { eventId: 'e', blob: new Blob([new Uint8Array([255, 216, 255, 217])], { type: 'image/jpeg' }), mimeType: 'image/jpeg', updatedAt: event.updatedAt }
    await db.photos.put(photo)
    const plan = planDeckMerge([event, second], ['简称', '别名'], '统一名称')
    await mergeDeckNames(['简称', '别名'], '统一名称', plan)
    const saved = (await db.events.get('e'))!
    expect(saved.ownDeck).toBe('统一名称')
    expect(saved.matches[0].games).toEqual(event.matches[0].games)
    expect(saved.totalNote).toBe(event.totalNote)
    expect(saved.matches[1].opponentDeck).toBe('统一名称')
    expect(saved.updatedAt).not.toBe(event.updatedAt)
    expect((await db.events.get('e2'))).toEqual(second)
    expect((await db.photos.get('e'))?.blob.size).toBe(4)
    const stats = calculateStats(await db.events.toArray())
    expect(stats.ownDecks.map(item => item.name)).toEqual(['统一名称'])
    expect(stats.matches).toMatchObject({ wins: 2, total: 2 })
    const restored = await loadBackup(await buildBackup(await db.events.toArray(), await db.photos.toArray(), [], '2026-10-14T01:00:00Z'))
    expect(restored.events.find(item => item.id === 'e')?.ownDeck).toBe('统一名称')
    expect(restored.photos).toHaveLength(1)
  })
  it('预览后记录变更时拒绝覆盖', async () => {
    await db.events.put(event)
    const plan = planDeckMerge([event], ['简称'], '新名')
    await db.events.update('e', { totalNote: '另一个页面的新备注' })
    await expect(mergeDeckNames(['简称'], '新名', plan)).rejects.toThrow('赛事记录已发生变化')
    expect((await db.events.get('e'))?.ownDeck).toBe(' 简称 ')
    expect((await db.events.get('e'))?.totalNote).toBe('另一个页面的新备注')
  })
  it('部分写入失败时事务回滚，不留下半合并状态', async () => {
    const second = { ...event, id: 'e2' }
    await db.events.bulkPut([event, second])
    const plan = planDeckMerge([event, second], ['简称'], '新名')
    vi.spyOn(db.events, 'bulkPut').mockImplementationOnce(() => Dexie.Promise.resolve(db.events.put({ ...event, ownDeck: '新名' })).then(() => { throw new Error('写入失败') }))
    await expect(mergeDeckNames(['简称'], '新名', plan)).rejects.toThrow('写入失败')
    expect(await db.events.get('e')).toEqual(event)
    expect(await db.events.get('e2')).toEqual(second)
  })
})
