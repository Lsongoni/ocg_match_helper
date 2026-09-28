import { useMemo, useState } from 'react'
import { Check, ClipboardCopy, Download, X } from 'lucide-react'
import { generateReport, reportFilename } from './report'
import type { EventRecord } from './domain'

export function ReportSheet({ event, onClose }: { event: EventRecord; onClose: () => void }) {
  const [includeNotes, setIncludeNotes] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const report = useMemo(() => generateReport(event, includeNotes), [event, includeNotes])

  async function copy() {
    try {
      await navigator.clipboard.writeText(report)
      setCopied(true); setError('')
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      setError('自动复制失败。请长按下方战报文字手动复制。')
    }
  }

  async function exportTxt() {
    const file = new File([`\ufeff${report}`], reportFilename(event), { type: 'text/plain;charset=utf-8' })
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'OCG 战报' }); setError(''); return }
      catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return }
    }
    try {
      const url = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = url; link.download = file.name; document.body.append(link); link.click(); link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      setError('')
    } catch { setError('导出失败，请使用复制战报。') }
  }

  return <div className="sheet-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <section className="editor-sheet report-sheet" role="dialog" aria-modal="true" aria-label="生成战报">
      <header className="sheet-header"><div><p className="eyebrow">MATCH REPORT</p><h2>生成战报</h2></div><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={22} /></button></header>
      <div className="sheet-body form-stack">
        <div className="field"><span className="field-label">导出内容</span><div className="segmented"><button className={!includeNotes ? 'selected' : ''} onClick={() => setIncludeNotes(false)}>不包含备注</button><button className={includeNotes ? 'selected' : ''} onClick={() => setIncludeNotes(true)}>包含备注</button></div></div>
        <textarea className="report-preview" readOnly value={report} aria-label="战报预览" />
        {error && <p className="error-message" role="alert">{error}</p>}
        <div className="report-actions"><button className="button primary" onClick={() => void copy()}>{copied ? <Check size={18} /> : <ClipboardCopy size={18} />}{copied ? '已复制' : '复制战报'}</button><button className="button secondary" onClick={() => void exportTxt()}><Download size={18} />导出 TXT</button></div>
      </div>
    </section>
  </div>
}
