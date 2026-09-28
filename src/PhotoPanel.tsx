import { useEffect, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { db, type StoredPhoto } from './db'

async function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('无法压缩照片。')), 'image/jpeg', quality))
}

export async function compressPhoto(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file)
  const image = new Image()
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('无法读取照片，请选择 iPhone 可打开的图片。'))
      image.src = url
    })
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('照片尺寸无效。')
    let scale = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    while (true) {
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('设备无法处理照片。')
      context.fillStyle = '#fff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      for (const quality of [.82, .68, .55]) {
        const blob = await canvasBlob(canvas, quality)
        if (blob.size <= 2_000_000 || quality === .55 && Math.max(canvas.width, canvas.height) <= 1000) return blob
      }
      scale *= .8
    }
  } finally { URL.revokeObjectURL(url) }
}

export function PhotoPanel({ eventId }: { eventId: string }) {
  const [photo, setPhoto] = useState<StoredPhoto | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { void db.photos.get(eventId).then(value => setPhoto(value ?? null)).catch(() => setError('无法读取卡组照片。')) }, [eventId])
  useEffect(() => {
    if (!photo) { setUrl(null); return }
    const objectUrl = URL.createObjectURL(photo.blob)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [photo])

  async function upload(file?: File) {
    if (!file) return
    setBusy(true); setError('')
    try {
      const blob = await compressPhoto(file)
      const record = { eventId, blob, mimeType: 'image/jpeg', updatedAt: new Date().toISOString() }
      await db.photos.put(record)
      setPhoto(record)
    } catch (error) { setError(error instanceof Error ? error.message : '照片保存失败。') } finally { setBusy(false) }
  }
  async function remove() {
    if (!confirm('删除这张卡组照片？')) return
    try { await db.photos.delete(eventId); setPhoto(null) } catch { setError('照片删除失败。') }
  }

  return <section className="section-block"><div className="section-heading"><div><p className="eyebrow">DECK PROFILE</p><h3>卡组照片</h3></div></div>
    {url ? <img className="deck-photo" src={url} alt="该场赛事的卡组照片" /> : <div className="photo-empty"><ImagePlus size={24} /><span>为这场赛事保存一张卡组照片</span></div>}
    <div className="photo-actions"><label className="button secondary photo-upload"><ImagePlus size={17} />{busy ? '处理中…' : photo ? '更换照片' : '添加照片'}<input type="file" accept="image/*" disabled={busy} onChange={e => { void upload(e.target.files?.[0]); e.currentTarget.value = '' }} /></label>{photo && <button className="text-button muted" onClick={() => void remove()}><Trash2 size={15} />删除照片</button>}</div>
    <p className="field-hint">上传后转换为压缩 JPEG，仅保存在本机，并包含在完整备份中。</p>
    {error && <p className="error-message" role="alert">{error}</p>}
  </section>
}
