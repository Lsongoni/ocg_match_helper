import JSZip from 'jszip'
import packageInfo from '../package.json'
import { db, setSetting, type SettingRecord, type StoredPhoto } from './db'
import { localToday, type EventRecord, type GameRecord, type MatchRecord } from './domain'

interface ImageManifest { eventId: string; path: string; mimeType: string; updatedAt: string }
interface BackupPayload {
  schemaVersion: 1
  exportedAt: string
  appVersion: string
  data: { events: EventRecord[]; settings: SettingRecord[]; images: ImageManifest[] }
}
export interface LoadedBackup {
  exportedAt: string
  appVersion: string
  events: EventRecord[]
  settings: SettingRecord[]
  photos: StoredPhoto[]
}

function object(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function validGame(value: unknown): value is GameRecord {
  return object(value) && typeof value.id === 'string' && ['O', 'X', 'D'].includes(String(value.result)) &&
    ['first', 'second'].includes(String(value.turn)) && typeof value.note === 'string' && typeof value.manualTurn === 'boolean'
}
function validMatch(value: unknown): value is MatchRecord {
  if (!object(value) || typeof value.id !== 'string' || !['swiss', 'knockout'].includes(String(value.phase)) ||
    !Number.isSafeInteger(value.round) || Number(value.round) < 1 || typeof value.opponentDeck !== 'string' ||
    !Array.isArray(value.games)) return false
  const kind = value.kind ?? 'normal'
  if (!['normal', 'bye', 'no-show'].includes(String(kind))) return false
  return kind === 'normal' ? value.games.length > 0 && value.games.every(validGame) : value.phase === 'swiss' && value.games.length === 0
}
function validEvent(value: unknown): value is EventRecord {
  return object(value) && typeof value.id === 'string' && typeof value.name === 'string' &&
    typeof value.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.date) &&
    Number.isSafeInteger(value.participants) && Number(value.participants) >= 2 &&
    Number.isSafeInteger(value.plannedSwissRounds) && Number(value.plannedSwissRounds) >= 1 &&
    Number.isSafeInteger(value.cutSize) && Number(value.cutSize) >= 2 && Number(value.cutSize) <= Number(value.participants) &&
    typeof value.ownDeck === 'string' && ['active', 'finished'].includes(String(value.status)) &&
    ['undecided', 'out', 'in'].includes(String(value.advancement)) &&
    (value.firstKnockoutStage === null || Number.isSafeInteger(value.firstKnockoutStage)) &&
    typeof value.totalNote === 'string' && typeof value.createdAt === 'string' && typeof value.updatedAt === 'string' &&
    Array.isArray(value.matches) && value.matches.every(validMatch)
}
function validSetting(value: unknown): value is SettingRecord {
  return object(value) && typeof value.key === 'string' && (typeof value.value === 'string' || typeof value.value === 'number' || value.value === null)
}
function validatePayload(value: unknown): asserts value is BackupPayload {
  if (!object(value) || value.schemaVersion !== 1 || typeof value.exportedAt !== 'string' || !Number.isFinite(Date.parse(value.exportedAt)) || typeof value.appVersion !== 'string' || !object(value.data)) throw new Error('备份格式或版本不受支持。')
  const data = value.data
  if (!Array.isArray(data.events) || !data.events.every(validEvent) || !Array.isArray(data.settings) || !data.settings.every(validSetting) || !Array.isArray(data.images)) throw new Error('备份数据不完整或已损坏。')
  const eventIds = new Set<string>()
  for (const event of data.events as EventRecord[]) {
    if (eventIds.has(event.id)) throw new Error('备份中有重复赛事 ID。')
    eventIds.add(event.id)
    for (const phase of ['swiss', 'knockout'] as const) {
      const rounds = event.matches.filter(match => match.phase === phase).map(match => match.round).sort((a, b) => a - b)
      if (rounds.some((round, index) => round !== index + 1)) throw new Error('备份中的 Match 编号不连续。')
    }
  }
  const imageEvents = new Set<string>()
  for (const image of data.images) {
    if (!object(image) || typeof image.eventId !== 'string' || !eventIds.has(image.eventId) || imageEvents.has(image.eventId) ||
      typeof image.path !== 'string' || !/^images\/[a-zA-Z0-9-]+\.jpe?g$/.test(image.path) ||
      image.path !== `images/${image.eventId}.jpg` || image.mimeType !== 'image/jpeg' || typeof image.updatedAt !== 'string') throw new Error('备份图片清单无效。')
    imageEvents.add(image.eventId)
  }
}

export async function buildBackup(events: EventRecord[], photos: StoredPhoto[], settings: SettingRecord[], exportedAt: string): Promise<Blob> {
  const zip = new JSZip()
  const settingSnapshot = settings.filter(item => item.key !== 'lastBackupAt').concat({ key: 'lastBackupAt', value: exportedAt })
  const images = photos.map(photo => ({ eventId: photo.eventId, path: `images/${photo.eventId}.jpg`, mimeType: photo.mimeType, updatedAt: photo.updatedAt }))
  const payload: BackupPayload = { schemaVersion: 1, exportedAt, appVersion: packageInfo.version, data: { events, settings: settingSnapshot, images } }
  zip.file('data.json', JSON.stringify(payload, null, 2))
  for (const photo of photos) zip.file(`images/${photo.eventId}.jpg`, photo.blob, { compression: 'STORE' })
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}

export async function createBackup(): Promise<{ file: File; exportedAt: string }> {
  const snapshot = await db.transaction('r', db.events, db.photos, db.settings, async () => ({
    events: await db.events.toArray(), photos: await db.photos.toArray(), settings: await db.settings.toArray(),
  }))
  const exportedAt = new Date().toISOString()
  const blob = await buildBackup(snapshot.events, snapshot.photos, snapshot.settings, exportedAt)
  return { file: new File([blob], `OCG-Assistant-Backup-${localToday()}.zip`, { type: 'application/zip' }), exportedAt }
}

export async function deliverBackup(): Promise<string | null> {
  const { file, exportedAt } = await createBackup()
  let shared = false
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'OCG 比赛助手完整备份' }); shared = true }
    catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return null }
  }
  if (!shared) {
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url; link.download = file.name; document.body.append(link); link.click(); link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
  await setSetting('lastBackupAt', exportedAt)
  return exportedAt
}

export async function loadBackup(file: Blob): Promise<LoadedBackup> {
  let zip: JSZip
  try { zip = await JSZip.loadAsync(await file.arrayBuffer()) } catch { throw new Error('无法读取 ZIP 文件。') }
  const json = zip.file('data.json')
  if (!json) throw new Error('备份缺少 data.json。')
  let payload: unknown
  try { payload = JSON.parse(await json.async('string')) } catch { throw new Error('data.json 不是有效 JSON。') }
  validatePayload(payload)
  const photos: StoredPhoto[] = []
  for (const image of payload.data.images) {
    const zipped = zip.file(image.path)
    if (!zipped) throw new Error(`备份缺少图片：${image.path}`)
    const bytes = await zipped.async('uint8array')
    photos.push({ eventId: image.eventId, blob: new Blob([new Uint8Array(bytes)], { type: image.mimeType }), mimeType: image.mimeType, updatedAt: image.updatedAt })
  }
  return { exportedAt: payload.exportedAt, appVersion: payload.appVersion, events: payload.data.events, settings: payload.data.settings, photos }
}

export async function replaceFromBackup(snapshot: LoadedBackup): Promise<void> {
  await db.transaction('rw', db.events, db.photos, db.settings, async () => {
    await db.events.clear(); await db.photos.clear(); await db.settings.clear()
    await db.events.bulkPut(snapshot.events)
    await db.photos.bulkPut(snapshot.photos)
    await db.settings.bulkPut(snapshot.settings)
  })
}
