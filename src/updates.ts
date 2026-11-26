/**
 * 应用更新。
 *
 * Service Worker 只在页面初始化时检查一次新版本，iOS 上从后台切回来不会再查，
 * 所以这里额外提供：手动检查、回到前台时按间隔复检、以及一个不会打断操作的更新条。
 */

import { registerSW } from 'virtual:pwa-register'

export type UpdateStatus = 'idle' | 'checking' | 'latest' | 'ready' | 'unsupported' | 'error'

export interface UpdateSnapshot {
  status: UpdateStatus
  /** 上次完成检查的时间戳，毫秒。 */
  checkedAt: number | null
  message: string
}

/** 回到前台时两次检查之间的最小间隔，避免频繁触发。 */
export const AUTO_CHECK_INTERVAL = 60_000

/** 是否应当在这次回到前台时检查更新。 */
export function shouldAutoCheck(lastCheckedAt: number | null, now: number, interval = AUTO_CHECK_INTERVAL): boolean {
  if (lastCheckedAt === null) return true
  if (!Number.isFinite(lastCheckedAt)) return true
  return now - lastCheckedAt >= interval
}

/** 把运行时状态翻译成给人看的文案。 */
export function statusText(status: UpdateStatus, buildTime: string): string {
  switch (status) {
    case 'checking': return '正在检查更新…'
    case 'latest': return '已是最新版本'
    case 'ready': return '新版本已下载，点“立即更新”完成切换'
    case 'unsupported': return '当前浏览器不支持离线更新，请重新打开页面'
    case 'error': return '检查失败，请确认网络后重试'
    default: return buildTime ? `构建于 ${buildTime}` : '等待检查'
  }
}

/** 把构建时间格式化成适合展示的本地文案。 */
export function formatBuildTime(iso: string): string {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

type Listener = () => void

let registration: ServiceWorkerRegistration | undefined
let applyUpdate: ((reloadPage?: boolean) => Promise<void>) | undefined
let snapshot: UpdateSnapshot = { status: 'idle', checkedAt: null, message: '' }
const listeners = new Set<Listener>()

function set(patch: Partial<UpdateSnapshot>) {
  snapshot = { ...snapshot, ...patch }
  for (const listener of listeners) listener()
}

export function getUpdateSnapshot(): UpdateSnapshot {
  return snapshot
}

export function subscribeUpdates(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** 启动时注册 Service Worker，并接住首次发现的新版本。 */
export function registerUpdates(): void {
  try {
    applyUpdate = registerSW({
      onRegisteredSW(_url, value) { registration = value },
      onNeedRefresh() { set({ status: 'ready' }) },
      onOfflineReady() { set({ message: '已可离线使用' }) },
    })
  } catch {
    set({ status: 'unsupported' })
  }
}

/** 主动检查更新；不传则使用已注册的 Service Worker。 */
export async function checkForUpdate(): Promise<UpdateStatus> {
  if (!registration) {
    set({ status: 'unsupported' })
    return 'unsupported'
  }
  set({ status: 'checking' })
  try {
    await registration.update()
    const status: UpdateStatus = registration.waiting || registration.installing ? 'ready' : 'latest'
    set({ status, checkedAt: Date.now() })
    return status
  } catch {
    set({ status: 'error', checkedAt: Date.now() })
    return 'error'
  }
}

/** 应用已就绪的新版本：交给 Service Worker 接管并刷新页面。 */
export async function activateUpdate(): Promise<void> {
  if (!applyUpdate) return
  await applyUpdate(true)
}

/** 回到前台时按间隔自动检查，返回清理函数。 */
export function watchVisibility(): () => void {
  const onVisible = () => {
    if (document.visibilityState !== 'visible') return
    if (!shouldAutoCheck(snapshot.checkedAt, Date.now())) return
    void checkForUpdate()
  }
  document.addEventListener('visibilitychange', onVisible)
  return () => document.removeEventListener('visibilitychange', onVisible)
}
