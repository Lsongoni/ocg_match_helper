import 'fake-indexeddb/auto'
import JSZip from 'jszip'
import { afterEach, describe, expect, it } from 'vitest'
import { buildBackup, loadBackup, replaceFromBackup } from './backup'
import { db } from './db'
import type { EventRecord } from './domain'

const event: EventRecord = {
  id: 'event-1', name: '测试赛', date: '2026-09-28', participants: 4, plannedSwissRounds: 2,
  cutSize: 2, ownDeck: '白森林', status: 'finished', advancement: 'out', firstKnockoutStage: null,
  totalNote: '赛事复盘', createdAt: '2026-09-28T00:00:00.000Z', updatedAt: '2026-09-28T01:00:00.000Z',
  matches: [{ id: 'match-1', phase: 'swiss', round: 1, opponentDeck: '青眼', games: [
    { id: 'game-1', result: 'O', turn: 'first', manualTurn: true, note: 'G1 备注' },
    { id: 'game-2', result: 'O', turn: 'second', manualTurn: false, note: '' },
  ] }],
}

afterEach(async () => { await db.events.clear(); await db.photos.clear(); await db.settings.clear() })

describe('完整备份', () => {
  it('ZIP 包含数据和图片，并可整体恢复', async () => {
    const photo = { eventId: event.id, blob: new Blob([new Uint8Array([255, 216, 255, 217])], { type: 'image/jpeg' }), mimeType: 'image/jpeg', updatedAt: event.updatedAt }
    const blob = await buildBackup([event], [photo], [{ key: 'drawRate', value: .03 }], '2026-09-28T02:00:00.000Z')
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    expect(zip.file('data.json')).not.toBeNull()
    expect(zip.file('images/event-1.jpg')).not.toBeNull()
    const loaded = await loadBackup(blob)
    expect(loaded.events[0].matches[0].games[0].note).toBe('G1 备注')
    expect(loaded.photos[0].blob.size).toBe(4)
    expect(loaded.settings.find(item => item.key === 'lastBackupAt')?.value).toBe('2026-09-28T02:00:00.000Z')
    await db.events.put({ ...event, id: 'old-event' })
    await replaceFromBackup(loaded)
    expect((await db.events.toArray()).map(item => item.id)).toEqual(['event-1'])
    expect((await db.photos.get('event-1'))?.blob.size).toBe(4)
  })

  it('缺少图片时拒绝恢复前的校验', async () => {
    const photo = { eventId: event.id, blob: new Blob([new Uint8Array([1])], { type: 'image/jpeg' }), mimeType: 'image/jpeg', updatedAt: event.updatedAt }
    const blob = await buildBackup([event], [photo], [], '2026-09-28T02:00:00.000Z')
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    zip.remove('images/event-1.jpg')
    const broken = await zip.generateAsync({ type: 'blob' })
    await expect(loadBackup(broken)).rejects.toThrow('备份缺少图片')
  })
  it('新类型的无 Game 瑞士轮 Match 可完整备份恢复', async () => {
    const special = { ...event, matches: [
      ...event.matches,
      { id: 'bye', phase: 'swiss' as const, round: 2, kind: 'bye' as const, opponentDeck: '', games: [] },
    ] }
    const backup = await buildBackup([special], [], [], '2026-09-28T02:00:00.000Z')
    const loaded = await loadBackup(backup)
    expect(loaded.events[0].matches[1]).toMatchObject({ kind: 'bye', games: [] })
  })
})
