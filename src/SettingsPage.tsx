import { useEffect, useState } from 'react'
import { ArchiveRestore, Download, HardDriveDownload, Info } from 'lucide-react'
import { deliverBackup, loadBackup, replaceFromBackup, type LoadedBackup } from './backup'
import { getSetting } from './db'

function dateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }) : '尚未备份'
}

export function SettingsPage({ onRestored, onBackupSaved }: { onRestored: () => Promise<void>; onBackupSaved: (at: string) => void }) {
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null)
  const [pending, setPending] = useState<LoadedBackup | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  useEffect(() => { void getSetting<string | null>('lastBackupAt', null).then(setLastBackupAt) }, [])

  async function backup() {
    setBusy(true); setError(''); setSuccess('')
    try {
      const exportedAt = await deliverBackup()
      if (!exportedAt) return
      setLastBackupAt(exportedAt); onBackupSaved(exportedAt)
      setSuccess('备份文件已交给系统文件/分享界面，请确认保存到 Files 或 iCloud Drive。')
    } catch (error) { setError(error instanceof Error ? error.message : '备份失败，请重试。') } finally { setBusy(false) }
  }

  async function choose(file?: File) {
    if (!file) return
    setBusy(true); setError(''); setSuccess(''); setPending(null)
    try { setPending(await loadBackup(file)) } catch (error) { setError(error instanceof Error ? error.message : '无法读取备份文件。') } finally { setBusy(false) }
  }

  async function restore() {
    if (!pending || !confirm(`将用备份中的 ${pending.events.length} 场赛事整体替换本机现有数据和照片。确定恢复吗？`)) return
    setBusy(true); setError(''); setSuccess('')
    try {
      await replaceFromBackup(pending)
      setLastBackupAt((pending.settings.find(setting => setting.key === 'lastBackupAt')?.value as string | null) ?? null)
      setPending(null)
      await onRestored()
      setSuccess('恢复完成。赛事、Match、备注、图片和设置已写入本机。')
    } catch (error) { setError(error instanceof Error ? error.message : '恢复未完成，请重新打开应用并检查本机记录。') } finally { setBusy(false) }
  }

  return <div className="page-stack"><div className="intro-block"><p className="eyebrow">LOCAL DATA</p><h2>设置与备份</h2><p>记录首先存在这台设备上。定期把完整 ZIP 备份保存到 Files 或 iCloud Drive。</p></div>
    <section className="settings-card"><div className="settings-heading"><HardDriveDownload size={22} /><div><h3>完整备份</h3><p>上次备份：{dateTime(lastBackupAt)}</p></div></div><p>包含所有赛事、Match、Game、备注、设置和卡组照片。战报 TXT 不能用于恢复。</p><button className="button primary full-width" onClick={() => void backup()} disabled={busy}><Download size={18} />{busy ? '处理中…' : '立即备份 ZIP'}</button></section>
    <section className="settings-card"><div className="settings-heading"><ArchiveRestore size={22} /><div><h3>恢复备份</h3><p>从 Files / iCloud Drive 选择 ZIP 文件</p></div></div><p>先校验并预览内容。确认后，备份会整体替换本机现有记录。</p><label className="button secondary full-width photo-upload">选择备份 ZIP<input type="file" accept=".zip,application/zip" disabled={busy} onChange={e => { void choose(e.target.files?.[0]); e.currentTarget.value = '' }} /></label>
      {pending && <div className="restore-preview"><strong>待恢复备份</strong><span>导出时间：{dateTime(pending.exportedAt)}</span><span>App 版本：{pending.appVersion}</span><span>赛事：{pending.events.length} 场 · 照片：{pending.photos.length} 张</span><button className="button danger full-width" onClick={() => void restore()} disabled={busy}>确认覆盖并恢复</button><button className="text-button muted" onClick={() => setPending(null)}>取消</button></div>}
    </section>
    <div className="notice"><Info size={17} /><span>本地浏览器数据可能因换手机或清理网站数据而丢失。备份提示只会在打开 App 时出现，不使用推送通知。</span></div>
    {error && <p className="error-message" role="alert">{error}</p>}{success && <p className="success-message" role="status">{success}</p>}
  </div>
}
