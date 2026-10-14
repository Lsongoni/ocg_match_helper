import { useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { formatDate, formatRecord, matchLabel, matchOutcome, sortedMatches, type EventRecord } from './domain'
import { calculateStats, type GroupedRecord, type WinLossDraw } from './stats'
import { EventFilterControls } from './EventFilterControls'
import { deckNames, emptyEventFilters, filterEvents, matchupEvents } from './eventFilters'

function percent(record: WinLossDraw) { return record.total ? `${(record.rate * 100).toFixed(1)}%` : '—' }
function sample(record: WinLossDraw) { return `${record.total} 场${record.total > 0 && record.total < 10 ? ' · 样本少' : ''}` }

function Group({ title, rows, onSelect }: { title: string; rows: GroupedRecord[]; onSelect?: (name: string) => void }) {
  return <section className="section-block"><div className="section-heading"><div><p className="eyebrow">MATCH RECORD</p><h3>{title}</h3></div></div>{onSelect && <p className="subtle-note">点击卡组查看先后攻表现和对应 Match。</p>}{rows.length ? <div className="stats-list">{rows.map(row => {
    const content = <><strong>{row.name}<small>{sample(row.record)}</small></strong><span>{formatRecord(row.record)}</span><b>{percent(row.record)}</b></>
    return onSelect ? <button className="stats-row stats-link" key={row.name} onClick={() => onSelect(row.name)} aria-label={`分析对局 ${row.name}`}>{content}</button> : <div className="stats-row" key={row.name}>{content}</div>
  })}</div> : <p className="subtle-note">当前范围内没有对局记录。</p>}</section>
}

export function StatsPage({ events }: { events: EventRecord[] }) {
  const [filters, setFilters] = useState({ ...emptyEventFilters })
  const [opponent, setOpponent] = useState<string | null>(null)
  const filtered = filterEvents(events, filters)
  const stats = calculateStats(filtered)
  if (!events.length) return <div className="page-stack"><div className="intro-block"><p className="eyebrow">YOUR NUMBERS</p><h2>比赛统计</h2></div><div className="empty-panel"><BarChart3 size={25} /><strong>还没有统计数据</strong><p>创建赛事并记录 Match 后自动生成。</p></div></div>
  const games = [
    ['总 Game 胜率', stats.games], ['先攻 Game 胜率', stats.firstGames], ['后攻 Game 胜率', stats.secondGames],
    ['G1 胜率', stats.gamePositions[0]], ['G2 胜率', stats.gamePositions[1]], ['G3 胜率', stats.gamePositions[2]],
  ] as const
  return <div className="page-stack"><div className="intro-block"><p className="eyebrow">YOUR NUMBERS</p><h2>比赛统计</h2><p>所有数字由本机赛事记录自动计算。</p></div>
    <EventFilterControls value={filters} onChange={value => { setFilters(value); setOpponent(null) }} decks={deckNames(events, true)} />
    <p className="subtle-note" role="status">当前范围：{filtered.length} 场赛事 · {stats.matchCount} 场 Match{stats.matchCount > 0 && stats.matchCount < 10 ? ' · 样本少' : ''}</p>
    {!filtered.length && <div className="empty-panel"><strong>没有符合条件的比赛</strong><p>试试调整或重置筛选条件。</p></div>}
    <section className="stats-overview"><div><span>赛事</span><strong>{stats.eventCount}</strong></div><div><span>Match</span><strong>{stats.matchCount}</strong></div><div><span>Match 胜率</span><strong>{percent(stats.matches)}</strong><span>{sample(stats.matches)}</span></div><div><span>上位</span><strong>{stats.topCount}</strong></div></section>
    <section className="stats-details"><div><span>瑞士轮 Match</span><strong>{stats.swissMatchCount}</strong></div><div><span>淘汰赛 Match</span><strong>{stats.knockoutMatchCount}</strong></div><div><span>总战绩</span><strong>{formatRecord(stats.matches)}</strong></div><div><span>冠军</span><strong>{stats.championCount}</strong></div></section>
    <Group title="自己使用的卡组" rows={stats.ownDecks} />
    <Group title="对手卡组" rows={stats.opponentDecks} onSelect={setOpponent} />
    <section className="section-block"><div className="section-heading"><div><p className="eyebrow">GAME SPLIT</p><h3>小局统计</h3></div></div><div className="stats-list">{games.map(([name, record]) => <div className="stats-row" key={name}><strong>{name}<small>{sample(record)}</small></strong><span>{formatRecord(record)}</span><b>{percent(record)}</b></div>)}</div></section>
    <section className="section-block"><div className="section-heading"><div><p className="eyebrow">OPENING TURN</p><h3>G1 先后攻 Match 胜率</h3></div></div><div className="stats-list"><div className="stats-row"><strong>G1 先攻<small>{sample(stats.firstTurnMatches)}</small></strong><span>{formatRecord(stats.firstTurnMatches)}</span><b>{percent(stats.firstTurnMatches)}</b></div><div className="stats-row"><strong>G1 后攻<small>{sample(stats.secondTurnMatches)}</small></strong><span>{formatRecord(stats.secondTurnMatches)}</span><b>{percent(stats.secondTurnMatches)}</b></div></div></section>
    <p className="subtle-note">胜率 = 胜场 ÷ 总场数；平局计入总场数。少于 10 场标记“样本少”，仅供复盘，不代表稳定水平。卡组按去掉首尾空格后的名称汇总，可在设置中统一别名。</p>
    {opponent !== null && <MatchupDetail events={matchupEvents(filtered, opponent)} opponent={opponent} ownDeck={filters.ownDeck} onClose={() => setOpponent(null)} />}
  </div>
}

function MatchupDetail({ events, opponent, ownDeck, onClose }: { events: EventRecord[]; opponent: string; ownDeck: string; onClose: () => void }) {
  const stats = calculateStats(events)
  const rows = [['Match 胜率', stats.matches], ['G1 先攻 Match', stats.firstTurnMatches], ['G1 后攻 Match', stats.secondTurnMatches], ['先攻 Game', stats.firstGames], ['后攻 Game', stats.secondGames]] as const
  return <div className="sheet-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <section className="editor-sheet" role="dialog" aria-modal="true" aria-label={`对局分析 ${opponent}`}>
      <header className="sheet-header"><div className="matchup-heading"><p className="eyebrow">MATCHUP</p><h2>vs {opponent}</h2><p className="subtle-note">{ownDeck || '全部自己的卡组'} · 当前筛选范围</p></div><button className="text-button" onClick={onClose}>返回统计</button></header>
      <div className="sheet-body page-stack matchup-body"><div className="stats-list">{rows.map(([label, record]) => <div className="stats-row" key={label}><strong>{label}<small>{sample(record)}</small></strong><span>{formatRecord(record)}</span><b>{percent(record)}</b></div>)}</div>
        <p className="subtle-note">战绩按胜-负-平显示；胜率含平局分母。少于 10 场为小样本，仅供参考。</p>
        <h3>对应 Match · {stats.matchCount} 场</h3>
        {events.map(event => <section className="section-block" key={event.id}><div><h3>{event.name}</h3><p className="subtle-note">{formatDate(event.date)} · 使用 {event.ownDeck}</p></div><div className="matchup-records">{sortedMatches(event).map(match => <details key={match.id}><summary><strong>{matchLabel(match)} · {match.games.map(game => game.result).join('')}</strong><span>G1 {match.games[0].turn === 'first' ? '先攻' : '后攻'} · {{ win: '胜', loss: '负', draw: '平' }[matchOutcome(match)]}</span></summary><div>{match.games.map((game, index) => <p key={game.id}>G{index + 1} · {game.turn === 'first' ? '先攻' : '后攻'} · {game.result}{game.note ? ` · ${game.note}` : ''}</p>)}</div></details>)}</div></section>)}
      </div>
    </section>
  </div>
}
