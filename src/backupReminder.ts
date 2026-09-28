import type { EventRecord } from './domain'

const DAY = 24 * 60 * 60 * 1000

export function shouldRemindBackup(events: EventRecord[], lastBackupAt: string | null, snoozeUntil: string | null, now = new Date()): boolean {
  if (!events.length) return false
  if (snoozeUntil && Number.isFinite(Date.parse(snoozeUntil)) && now.getTime() < Date.parse(snoozeUntil)) return false
  const firstRecord = events.map(event => Date.parse(event.createdAt)).filter(Number.isFinite).sort((a, b) => a - b)[0]
  const base = lastBackupAt && Number.isFinite(Date.parse(lastBackupAt)) ? Date.parse(lastBackupAt) : firstRecord
  return Number.isFinite(base) && now.getTime() - base >= 30 * DAY
}

export function snoozeDate(now = new Date()): string { return new Date(now.getTime() + 7 * DAY).toISOString() }
