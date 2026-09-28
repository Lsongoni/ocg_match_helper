import Dexie, { type EntityTable } from 'dexie'
import type { EventRecord } from './domain'

export interface StoredPhoto {
  eventId: string
  blob: Blob
  mimeType: string
  updatedAt: string
}

export interface SettingRecord {
  key: string
  value: string | number | null
}

class OcgDatabase extends Dexie {
  events!: EntityTable<EventRecord, 'id'>
  photos!: EntityTable<StoredPhoto, 'eventId'>
  settings!: EntityTable<SettingRecord, 'key'>

  constructor() {
    super('ocg-match-helper')
    this.version(1).stores({
      events: 'id, date, status, updatedAt',
      photos: 'eventId',
      settings: 'key',
    })
  }
}

export const db = new OcgDatabase()

export async function listEvents(): Promise<EventRecord[]> {
  return (await db.events.toArray()).sort((a, b) =>
    b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt),
  )
}

export async function saveEvent(event: EventRecord): Promise<void> {
  await db.events.put({ ...event, updatedAt: new Date().toISOString() })
}

export async function deleteEvent(id: string): Promise<void> {
  await db.transaction('rw', db.events, db.photos, async () => {
    await db.events.delete(id)
    await db.photos.delete(id)
  })
}

export async function getSetting<T extends string | number | null>(key: string, fallback: T): Promise<T> {
  const stored = await db.settings.get(key)
  return (stored?.value ?? fallback) as T
}

export async function setSetting(key: string, value: string | number | null): Promise<void> {
  await db.settings.put({ key, value })
}
