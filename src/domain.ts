export type GameResult = 'O' | 'X' | 'D'
export type Turn = 'first' | 'second'
export type MatchPhase = 'swiss' | 'knockout'
export type MatchKind = 'normal' | 'bye' | 'no-show'
export type MatchOutcome = 'win' | 'draw' | 'loss'

export interface GameRecord {
  id: string
  result: GameResult
  turn: Turn
  manualTurn: boolean
  note: string
}

export interface MatchRecord {
  id: string
  phase: MatchPhase
  round: number
  kind?: MatchKind
  opponentDeck: string
  games: GameRecord[]
}

export interface EventRecord {
  id: string
  name: string
  date: string
  participants: number
  plannedSwissRounds: number
  cutSize: number
  ownDeck: string
  status: 'active' | 'finished'
  advancement: 'undecided' | 'out' | 'in'
  firstKnockoutStage: number | null
  totalNote: string
  matches: MatchRecord[]
  createdAt: string
  updatedAt: string
}

export const makeId = () => crypto.randomUUID()

export function localToday(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

export function countSwiss(event: EventRecord): number {
  return event.matches.filter(match => match.phase === 'swiss').length
}

export function countKnockout(event: EventRecord): number {
  return visibleMatches(event).filter(match => match.phase === 'knockout').length
}

export function matchKind(match: Pick<MatchRecord, 'kind'>): MatchKind {
  return match.kind ?? 'normal'
}

export function matchKindLabel(match: Pick<MatchRecord, 'kind'>): string | null {
  const kind = matchKind(match)
  return kind === 'bye' ? '轮空' : kind === 'no-show' ? '对手未到' : null
}

export function visibleMatches(event: EventRecord): MatchRecord[] {
  return event.advancement === 'out' ? event.matches.filter(match => match.phase === 'swiss') : event.matches
}

export function matchOutcome(match: Pick<MatchRecord, 'games' | 'kind'>): MatchOutcome {
  if (matchKind(match) !== 'normal') return 'win'
  const wins = match.games.filter(game => game.result === 'O').length
  const losses = match.games.filter(game => game.result === 'X').length
  return wins > losses ? 'win' : losses > wins ? 'loss' : 'draw'
}

export function oppositeTurn(turn: Turn): Turn {
  return turn === 'first' ? 'second' : 'first'
}

export function inferredNextTurn(previous: GameResult): Turn | null {
  return previous === 'O' ? 'second' : previous === 'X' ? 'first' : null
}

export function recordOf(matches: MatchRecord[]): { wins: number; losses: number; draws: number } {
  return matches.reduce((record, match) => {
    const outcome = matchOutcome(match)
    if (outcome === 'win') record.wins += 1
    if (outcome === 'loss') record.losses += 1
    if (outcome === 'draw') record.draws += 1
    return record
  }, { wins: 0, losses: 0, draws: 0 })
}

export function formatRecord(record: { wins: number; losses: number; draws: number }): string {
  return `${record.wins}-${record.losses}${record.draws ? `-${record.draws}` : ''}`
}

export function swissRecord(event: EventRecord): string {
  return formatRecord(recordOf(event.matches.filter(match => match.phase === 'swiss')))
}

export function totalRecord(event: EventRecord): string {
  return formatRecord(recordOf(visibleMatches(event)))
}

export function stageName(stage: number): string {
  if (stage === 2) return '决赛'
  return `${stage}强`
}

export function knockoutStages(cutSize: number): number[] {
  const stages: number[] = []
  let stage = 2 ** Math.ceil(Math.log2(Math.max(2, cutSize)))
  while (stage >= 2) {
    stages.push(stage)
    stage /= 2
  }
  return stages
}

export function placement(event: EventRecord): string {
  if (event.advancement === 'out') return '没出轮'
  if (event.advancement !== 'in' || !event.firstKnockoutStage) return '待确认'
  const knockouts = event.matches.filter(match => match.phase === 'knockout')
  for (let index = 0; index < knockouts.length; index += 1) {
    const stage = event.firstKnockoutStage / 2 ** index
    if (matchOutcome(knockouts[index]) === 'loss') return stage === 2 ? '亚军' : stageName(stage)
    if (stage === 2 && matchOutcome(knockouts[index]) === 'win') return '冠军'
  }
  return '淘汰赛进行中'
}

export function formatDate(date: string): string {
  return date.replaceAll('-', '.')
}

export function sortedMatches(event: EventRecord): MatchRecord[] {
  return [...visibleMatches(event)].sort((a, b) => {
    if (a.phase !== b.phase) return a.phase === 'swiss' ? -1 : 1
    return a.round - b.round
  })
}

export function matchLabel(match: MatchRecord): string {
  return `${match.phase === 'swiss' ? 'R' : 'M'}${match.round}`
}
