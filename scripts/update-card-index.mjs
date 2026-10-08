import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises'
import JSZip from 'jszip'

const output = new URL('../public/card-filter-index.json', import.meta.url)
const response = await fetch('https://ygocdb.com/api/v0/cards.zip.md5', { signal: AbortSignal.timeout(30000) })
if (!response.ok) throw new Error(`MD5 request failed: ${response.status}`)
const md5 = JSON.parse(await response.text())
if (typeof md5 !== 'string' || !/^[a-f0-9]{32}$/.test(md5)) throw new Error('Invalid upstream MD5')
if (process.argv.includes('--checksum')) {
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `md5=${md5}\n`)
  console.log(md5)
} else {
  let existing
  try { existing = JSON.parse(await readFile(output, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
  if (existing?.schemaVersion === 1 && existing.md5 === md5 && Array.isArray(existing.cards) && existing.cards.length > 0) {
    console.log(`Card index unchanged: ${existing.cards.length} cards`)
  } else {
    const zipResponse = await fetch('https://ygocdb.com/api/v0/cards.zip', { signal: AbortSignal.timeout(60000) })
    if (!zipResponse.ok) throw new Error(`Card download failed: ${zipResponse.status}`)
    const zip = await JSZip.loadAsync(await zipResponse.arrayBuffer())
    const file = zip.file('cards.json')
    if (!file) throw new Error('cards.json missing')
    const json = await file.async('nodebuffer')
    if (createHash('md5').update(json).digest('hex') !== md5) throw new Error('Card data checksum mismatch; retry when upstream update completes')
    const source = JSON.parse(json.toString('utf8'))
    const cards = []
    let excludedCount = 0
    for (const card of Object.values(source)) {
      const data = card.data
      const name = card.sc_name || card.cn_name || card.jp_name || card.en_name
      if (!data || !Number.isSafeInteger(card.cid) || card.cid <= 0 || !Number.isSafeInteger(card.id) || card.id <= 0 || typeof name !== 'string' || !name) { excludedCount++; continue }
      const fields = ['type', 'level', 'attribute', 'race', 'atk', 'def'].map(key => data[key])
      if (!fields.every(Number.isSafeInteger)) throw new Error(`Invalid numeric fields for card ${card.cid}`)
      cards.push([card.cid, card.id, name, card.cn_name || '', ...fields])
    }
    if (!cards.length) throw new Error('No filterable cards')
    cards.sort((a, b) => a[0] - b[0])
    const index = { schemaVersion: 1, md5, updatedAt: new Date().toISOString(), excludedCount, cards }
    await mkdir(new URL('../public/', import.meta.url), { recursive: true })
    await writeFile(output, JSON.stringify(index))
    console.log(`Card index: ${cards.length} cards, ${excludedCount} without searchable fields, ${JSON.stringify(index).length} characters`)
  }
}
