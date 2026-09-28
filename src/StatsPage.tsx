import { BarChart3 } from 'lucide-react'
import { formatRecord, type EventRecord } from './domain'
import { calculateStats, type GroupedRecord, type WinLossDraw } from './stats'

function percent(record: WinLossDraw) { return record.total ? `${(record.rate * 100).toFixed(1)}%` : '—' }

function Group({ title, rows }: { title: string; rows: GroupedRecord[] }) {
  return <section className="section-block"><div className="section-heading"><div><p className="eyebrow">MATCH RECORD</p><h3>{title}</h3></div></div>{rows.length ? <div className="stats-list">{rows.map(row => <div className="stats-row" key={row.name}><strong>{row.name}</strong><span>{formatRecord(row.record)}</span><b>{percent(row.record)}</b></div>)}</div> : <p className="subtle-note">记录 Match 后，这里会自动汇总。</p>}</section>
}

export function StatsPage({ events }: { events: EventRecord[] }) {
  const stats = calculateStats(events)
  if (!events.length) return <div className="page-stack"><div className="intro-block"><p className="eyebrow">YOUR NUMBERS</p><h2>比赛统计</h2></div><div className="empty-panel"><BarChart3 size={25} /><strong>还没有统计数据</strong><p>创建赛事并记录 Match 后自动生成。</p></div></div>
  const games = [
    ['总 Game 胜率', stats.games], ['先攻 Game 胜率', stats.firstGames], ['后攻 Game 胜率', stats.secondGames],
    ['G1 胜率', stats.gamePositions[0]], ['G2 胜率', stats.gamePositions[1]], ['G3 胜率', stats.gamePositions[2]],
  ] as const
  return <div className="page-stack"><div className="intro-block"><p className="eyebrow">YOUR NUMBERS</p><h2>比赛统计</h2><p>所有数字由本机赛事记录自动计算。</p></div>
    <section className="stats-overview"><div><span>赛事</span><strong>{stats.eventCount}</strong></div><div><span>Match</span><strong>{stats.matchCount}</strong></div><div><span>Match 胜率</span><strong>{percent(stats.matches)}</strong></div><div><span>上位</span><strong>{stats.topCount}</strong></div></section>
    <section className="stats-details"><div><span>瑞士轮 Match</span><strong>{stats.swissMatchCount}</strong></div><div><span>淘汰赛 Match</span><strong>{stats.knockoutMatchCount}</strong></div><div><span>总战绩</span><strong>{formatRecord(stats.matches)}</strong></div><div><span>冠军</span><strong>{stats.championCount}</strong></div></section>
    <Group title="自己使用的卡组" rows={stats.ownDecks} />
    <Group title="对手卡组" rows={stats.opponentDecks.map(row => ({ ...row, name: `vs ${row.name}` }))} />
    <section className="section-block"><div className="section-heading"><div><p className="eyebrow">GAME SPLIT</p><h3>小局统计</h3></div></div><div className="stats-list">{games.map(([name, record]) => <div className="stats-row" key={name}><strong>{name}</strong><span>{formatRecord(record)}</span><b>{percent(record)}</b></div>)}</div></section>
    <section className="section-block"><div className="section-heading"><div><p className="eyebrow">OPENING TURN</p><h3>G1 先后攻 Match 胜率</h3></div></div><div className="stats-list"><div className="stats-row"><strong>G1 先攻</strong><span>{formatRecord(stats.firstTurnMatches)}</span><b>{percent(stats.firstTurnMatches)}</b></div><div className="stats-row"><strong>G1 后攻</strong><span>{formatRecord(stats.secondTurnMatches)}</span><b>{percent(stats.secondTurnMatches)}</b></div></div></section>
    <p className="subtle-note">胜率 = 胜场 ÷ 总场数；平局计入总场数。卡组按去掉首尾空格后的名称汇总。</p>
  </div>
}
