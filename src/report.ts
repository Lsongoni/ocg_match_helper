import { formatDate, matchLabel, placement, sortedMatches, swissRecord, totalRecord, type EventRecord } from './domain'

export function generateReport(event: EventRecord, includeNotes: boolean): string {
  const lines = [
    `${formatDate(event.date)} ${event.name}`,
    `${event.participants}人 / ${event.plannedSwissRounds}轮 / Top ${event.cutSize}`,
    `使用：${event.ownDeck}`,
    '',
  ]
  for (const match of sortedMatches(event)) {
    lines.push(`${matchLabel(match)} ${match.opponentDeck} ${match.games[0].turn === 'first' ? '先' : '后'} ${match.games.map(game => game.result).join('')}`)
    if (includeNotes) {
      const notes = match.games.flatMap((game, index) => game.note.trim() ? [`G${index + 1}：${game.note.trim()}`] : [])
      if (notes.length) lines.push('', ...notes, '')
    }
  }
  while (lines.at(-1) === '') lines.pop()
  lines.push('', `瑞士战绩：${swissRecord(event)}`, `总战绩：${totalRecord(event)}`, `最终：${placement(event)}`)
  if (includeNotes && event.totalNote.trim()) lines.push('', '总备注：', event.totalNote.trim())
  return lines.join('\n')
}

export function reportFilename(event: EventRecord): string {
  const name = event.name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim().slice(0, 50)
  return `${event.date}-${name || '战报'}.txt`
}
