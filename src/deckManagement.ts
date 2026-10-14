import { db } from './db'
import { matchKind, type EventRecord } from './domain'
import { normalizeDeck } from './eventFilters'

export function planDeckMerge(events: EventRecord[], sources: string[], target: string) {
  const name = normalizeDeck(target)
  const selected = new Set(sources.map(normalizeDeck).filter(source => source && source !== name))
  let ownCount = 0
  let opponentCount = 0
  let hiddenCount = 0
  const originals: EventRecord[] = []
  const updates: EventRecord[] = []
  if (!name || !selected.size) return { originals, updates, ownCount, opponentCount, hiddenCount }
  for (const event of events) {
    const ownChanged = selected.has(normalizeDeck(event.ownDeck))
    let changed = ownChanged
    if (ownChanged) ownCount++
    const matches = event.matches.map(match => {
      if (matchKind(match) !== 'normal' || !selected.has(normalizeDeck(match.opponentDeck))) return match
      changed = true
      opponentCount++
      if (event.advancement === 'out' && match.phase === 'knockout') hiddenCount++
      return { ...match, opponentDeck: name }
    })
    if (changed) {
      originals.push(event)
      updates.push({ ...event, ownDeck: ownChanged ? name : event.ownDeck, matches })
    }
  }
  return { originals, updates, ownCount, opponentCount, hiddenCount }
}

export async function mergeDeckNames(sources: string[], target: string, preview: ReturnType<typeof planDeckMerge>): Promise<void> {
  if (!normalizeDeck(target) || !preview.updates.length) throw new Error('请选择旧名称并填写不同的统一名称。')
  await db.transaction('rw', db.events, async () => {
    const current = planDeckMerge(await db.events.toArray(), sources, target)
    const byId = (events: EventRecord[]) => [...events].sort((a, b) => a.id.localeCompare(b.id))
    if (JSON.stringify(byId(current.originals)) !== JSON.stringify(byId(preview.originals))) {
      throw new Error('赛事记录已发生变化，请刷新页面后重新预览合并。')
    }
    const now = new Date().toISOString()
    await db.events.bulkPut(current.updates.map(event => ({ ...event, updatedAt: now })))
  })
}
