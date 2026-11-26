import { useState } from 'react'
import { AlertTriangle, Info, Target } from 'lucide-react'
import { estimateLastRound, isStandingProblem, pointsOf, verdictLabel, type StandingScenario } from './standings'
import type { EventRecord } from './domain'

function tone(verdict: StandingScenario['verdict']): string {
  return verdict === 'safe' ? 'safe' : verdict === 'border' ? 'border' : 'out'
}

export function LastRoundStandings({ event, roundsPlayed, wins, draws }: { event: EventRecord; roundsPlayed: number; wins: number; draws: number }) {
  const [rank, setRank] = useState('')
  const [submitted, setSubmitted] = useState<number | null>(null)
  // 大分由已记录的胜负平直接算出：胜×3 + 平×1，不需要手填。
  const myPoints = pointsOf(wins, draws)
  function submit(formEvent: React.FormEvent) {
    formEvent.preventDefault()
    const nextRank = Number(rank)
    if (!Number.isSafeInteger(nextRank) || nextRank < 1 || nextRank > event.participants) return
    // 排名只存在于本次页面内，不写入 IndexedDB、不进备份与历史。
    setSubmitted(nextRank)
  }

  const result = submitted === null
    ? null
    : estimateLastRound({ participants: event.participants, roundsPlayed, cutSize: event.cutSize, myRank: submitted, myWins: wins, myDraws: draws })

  return <section className="section-block standings-panel">
    <div className="section-heading"><div><p className="eyebrow">IF I...</p><h3>最后一轮还能出轮吗</h3></div><Target size={20} /></div>
    <p className="subtle-note">大分已按前 {roundsPlayed} 轮战绩算出为 <strong>{myPoints} 分</strong>（{wins} 胜 {draws} 平），全场平局率按你的记录取 {Math.round((roundsPlayed ? draws / roundsPlayed : 0) * 100)}%。填一下第 {roundsPlayed} 轮结束后的排名，即可估算最后一轮赢、平、输三种情形的名次。排名只用于当次计算，不保存。</p>
    <form className="standings-form" onSubmit={submit}>
      <label className="field"><span className="field-label">我的排名</span><input type="number" min="1" max={event.participants} inputMode="numeric" value={rank} onChange={e => { setRank(e.target.value); setSubmitted(null) }} placeholder={`1–${event.participants}`} required /></label>
      <button className="button primary" type="submit">算一下</button>
    </form>
    {result && (isStandingProblem(result)
      ? <p className="error-message" role="alert">{result.error}</p>
      : <>
        <div className="standings-meta"><span>{event.participants} 人 · Top {event.cutSize}</span><span>{result.myPoints} 分组内第 {result.positionInGroup} 位（共 {result.groupSize} 人）</span></div>
        <div className="standings-list">{result.scenarios.map(scenario => <div className={`standings-row ${tone(scenario.verdict)}`} key={scenario.outcome}>
          <span className="standings-outcome">{scenario.label}</span>
          <span className="standings-points">{scenario.points} 分</span>
          <span className="standings-verdict">{verdictLabel(scenario.verdict)}</span>
          <small>{scenario.tied > 0 ? `约第 ${scenario.expected} 名 · ${scenario.above} 人分高、${scenario.tied} 人同分` : `约第 ${scenario.expected} 名`}</small>
        </div>)}</div>
        {result.scenarios.some(scenario => scenario.verdict === 'border') && <p className="notice amber"><AlertTriangle size={17} /><span>标为“看小分”的情形要与同分者比对小分。软件拿不到官方小分，实际结果可能偏向任一侧。</span></p>}
        <p className="subtle-note"><Info size={14} /> 估算假设：其余各桌按大分同组配对、胜者 +3 负者不加分，你的小分位置与排名对应。同分判定按估算名次给出区间，不代表官方排名。</p>
      </>)}
  </section>
}
