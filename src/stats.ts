import { matchKind, matchOutcome, placement, visibleMatches, type EventRecord, type GameRecord, type MatchRecord } from './domain'

export interface WinLossDraw { wins: number; losses: number; draws: number; total: number; rate: number }
export interface GroupedRecord { name: string; record: WinLossDraw }
export interface Statistics {
  eventCount: number
  matchCount: number
  swissMatchCount: number
  knockoutMatchCount: number
  matches: WinLossDraw
  topCount: number
  championCount: number
  ownDecks: GroupedRecord[]
  opponentDecks: GroupedRecord[]
  games: WinLossDraw
  firstGames: WinLossDraw
  secondGames: WinLossDraw
  gamePositions: [WinLossDraw, WinLossDraw, WinLossDraw]
  firstTurnMatches: WinLossDraw
  secondTurnMatches: WinLossDraw
}

function empty(): WinLossDraw { return { wins: 0, losses: 0, draws: 0, total: 0, rate: 0 } }
function add(record: WinLossDraw, result: 'win' | 'loss' | 'draw') {
  record.total += 1
  if (result === 'win') record.wins += 1
  if (result === 'loss') record.losses += 1
  if (result === 'draw') record.draws += 1
}
function finalize(record: WinLossDraw): WinLossDraw { record.rate = record.total ? record.wins / record.total : 0; return record }
function group(map: Map<string, WinLossDraw>, name: string, match: MatchRecord) {
  const key = name.trim().normalize('NFC') || '未知卡组'
  if (!map.has(key)) map.set(key, empty())
  add(map.get(key)!, matchOutcome(match))
}
function gameResult(game: GameRecord): 'win' | 'loss' | 'draw' {
  return game.result === 'O' ? 'win' : game.result === 'X' ? 'loss' : 'draw'
}
function grouped(map: Map<string, WinLossDraw>): GroupedRecord[] {
  return [...map].map(([name, record]) => ({ name, record: finalize(record) })).sort((a, b) => b.record.total - a.record.total || a.name.localeCompare(b.name))
}

export function calculateStats(events: EventRecord[]): Statistics {
  const stats: Statistics = {
    eventCount: events.length, matchCount: 0, swissMatchCount: 0, knockoutMatchCount: 0,
    matches: empty(), topCount: 0, championCount: 0,
    ownDecks: [], opponentDecks: [], games: empty(), firstGames: empty(), secondGames: empty(),
    gamePositions: [empty(), empty(), empty()], firstTurnMatches: empty(), secondTurnMatches: empty(),
  }
  const own = new Map<string, WinLossDraw>()
  const opponents = new Map<string, WinLossDraw>()
  for (const event of events) {
    if (event.advancement === 'in') stats.topCount += 1
    if (placement(event) === '冠军') stats.championCount += 1
    for (const match of visibleMatches(event)) {
      const outcome = matchOutcome(match)
      stats.matchCount += 1
      if (match.phase === 'swiss') stats.swissMatchCount += 1
      else stats.knockoutMatchCount += 1
      add(stats.matches, outcome)
      group(own, event.ownDeck, match)
      if (matchKind(match) !== 'normal') continue
      group(opponents, match.opponentDeck, match)
      add(match.games[0].turn === 'first' ? stats.firstTurnMatches : stats.secondTurnMatches, outcome)
      match.games.forEach((game, index) => {
        const result = gameResult(game)
        add(stats.games, result)
        add(game.turn === 'first' ? stats.firstGames : stats.secondGames, result)
        if (index < 3) add(stats.gamePositions[index], result)
      })
    }
  }
  for (const record of [stats.matches, stats.games, stats.firstGames, stats.secondGames, ...stats.gamePositions, stats.firstTurnMatches, stats.secondTurnMatches]) finalize(record)
  stats.ownDecks = grouped(own)
  stats.opponentDecks = grouped(opponents)
  return stats
}
