import { describe, expect, it } from 'vitest'
import { shouldRemindBackup, snoozeDate } from './backupReminder'
import type { EventRecord } from './domain'

const event = { createdAt: '2026-08-01T00:00:00.000Z' } as EventRecord

describe('备份提醒', () => {
  it('首次记录或上次备份 30 天后提示', () => {
    const now = new Date('2026-09-01T00:00:00.000Z')
    expect(shouldRemindBackup([event], null, null, now)).toBe(true)
    expect(shouldRemindBackup([event], '2026-08-20T00:00:00.000Z', null, now)).toBe(false)
  })
  it('稍后提醒暂缓 7 天且无赛事时不提示', () => {
    const now = new Date('2026-09-01T00:00:00.000Z')
    expect(shouldRemindBackup([event], null, snoozeDate(now), now)).toBe(false)
    expect(shouldRemindBackup([], null, null, now)).toBe(false)
  })
})
