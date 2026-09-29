import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Calculator, Info, RotateCcw, X } from 'lucide-react'
import { countSwiss, formatRecord, recordOf, type EventRecord } from './domain'
import { recommendedRounds } from './swissRounds'
import { findRecord, validateSimulationInput, type SimulationInput, type SimulationResult, type SimulationRow } from './simulation'

const cache = new Map<string, SimulationResult>()
const LARGE_WORK = 500_000_000

function keyOf(input: SimulationInput): string { return JSON.stringify(input) }
function rateText(row?: SimulationRow): string {
  if (!row) return '未观察到'
  if (row.appearances < 100) return '样本不足'
  const percent = row.rate * 100
  return `${percent > 0 && percent < .01 ? '<0.01' : percent.toFixed(percent < 1 ? 2 : 1)}%`
}
function recordText(row: Pick<SimulationRow, 'wins' | 'losses' | 'draws'>): string { return formatRecord(row) }

function SimulationView({ input, currentRecord, autoStart = false }: {
  input: SimulationInput
  currentRecord?: { wins: number; losses: number; draws: number }
  autoStart?: boolean
}) {
  const key = keyOf(input)
  const [result, setResult] = useState<SimulationResult | null>(cache.get(key) ?? null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)
  const workerRef = useRef<Worker | null>(null)
  const large = input.participants * input.rounds * input.iterations > LARGE_WORK
  const validRecord = currentRecord && currentRecord.wins + currentRecord.losses + currentRecord.draws === input.rounds - 1

  const start = useCallback(() => {
    const issue = validateSimulationInput(input)
    if (issue) { setError(issue); return }
    const cached = cache.get(key)
    if (cached) { setResult(cached); setError(''); return }
    if (workerRef.current) return
    const instance = new Worker(new URL('./swiss.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = instance; setRunning(true); setProgress(0); setError('')
    instance.onmessage = (message: MessageEvent<{ type: string; done?: number; result?: SimulationResult; message?: string }>) => {
      if (message.data.type === 'progress') setProgress(message.data.done ?? 0)
      if (message.data.type === 'complete' && message.data.result) {
        cache.set(key, message.data.result)
        if (cache.size > 6) cache.delete(cache.keys().next().value!)
        setResult(message.data.result); setRunning(false); workerRef.current = null; instance.terminate()
      }
      if (message.data.type === 'error') {
        setError(message.data.message ?? '模拟失败。'); setRunning(false); workerRef.current = null; instance.terminate()
      }
    }
    instance.onerror = () => { setError('模拟运行失败，请减少规模后重试。'); setRunning(false); workerRef.current = null; instance.terminate() }
    instance.postMessage(input)
  }, [input, key])

  useEffect(() => { if (autoStart && !large && !cache.has(key)) start() }, [autoStart, large, key, start])
  useEffect(() => () => { workerRef.current?.terminate(); workerRef.current = null }, [])

  function cancel() { workerRef.current?.terminate(); workerRef.current = null; setRunning(false); setProgress(0) }
  const scenarios = validRecord ? [
    { label: '赢', record: { wins: currentRecord.wins + 1, losses: currentRecord.losses, draws: currentRecord.draws } },
    { label: '平', record: { wins: currentRecord.wins, losses: currentRecord.losses, draws: currentRecord.draws + 1 } },
    { label: '输', record: { wins: currentRecord.wins, losses: currentRecord.losses + 1, draws: currentRecord.draws } },
  ] : []

  return <div className="sim-stack">
    {large && <div className="notice amber"><Info size={17} /><span>当前规模可能需要较长时间并消耗电量；可以随时取消。人数不设固定上限。</span></div>}
    {!result && !running && <button className="button primary full-width" onClick={start}><Calculator size={18} />开始模拟 {input.iterations.toLocaleString()} 次</button>}
    {running && <div className="sim-progress"><div><strong>正在模拟…</strong><span>{Math.round(progress / input.iterations * 100)}%</span></div><progress max={input.iterations} value={progress} /><button className="text-button" onClick={cancel}><X size={15} />取消计算</button></div>}
    {error && <div className="error-message" role="alert">{error}</div>}
    {result && <>
      {scenarios.length > 0 && <section className="forecast-card"><div className="section-heading"><div><p className="eyebrow">FINAL ROUND</p><h3>最后一轮</h3></div></div><p className="forecast-note">当前 {recordText(currentRecord!)} · 基于赛事整体模拟，不包含实时小分。</p><div className="forecast-list">{scenarios.map(scenario => {
        const row = findRecord(result, scenario.record.wins, scenario.record.losses, scenario.record.draws)
        return <div className="forecast-row" key={scenario.label}><span>{scenario.label}</span><ArrowRight size={16} /><strong>{recordText(scenario.record)}</strong><b>{rateText(row)}</b></div>
      })}</div></section>}
      <section className="section-block"><div className="section-heading"><div><p className="eyebrow">SIMULATION</p><h3>最终战绩与晋级率</h3></div><span className="count-pill">{result.completed.toLocaleString()} 次</span></div><div className="sim-table"><div className="sim-table-head"><span>战绩</span><span>出现次数</span><span>晋级率</span></div>{result.rows.map(row => <div className="sim-table-row" key={`${row.wins}-${row.losses}-${row.draws}`}><strong>{recordText(row)}</strong><span>{row.appearances.toLocaleString()}</span><b>{rateText(row)}</b></div>)}</div><p className="sim-disclaimer">模拟假设：同等实力、尽量同分配对、同分随机排序；平局率为设定参数。结果不代表真实比赛的小分或保证晋级。低于 100 个样本不展示百分比。</p></section>
      <button className="text-button" onClick={() => { cache.delete(key); setResult(null) }}><RotateCcw size={15} />重新模拟</button>
    </>}
  </div>
}

export function LastRoundPanel({ event, drawRate }: { event: EventRecord; drawRate: number }) {
  const currentRecord = recordOf(event.matches.filter(match => match.phase === 'swiss'))
  const input: SimulationInput = {
    participants: event.participants, rounds: event.plannedSwissRounds,
    cutSize: event.cutSize, drawRate, iterations: 100_000,
  }
  return <section className="section-block"><SimulationView input={input} currentRecord={currentRecord} autoStart /></section>
}

export function CalculatorPage({ active, savedDrawRate, onDrawRateChange }: { active?: EventRecord; savedDrawRate: number; onDrawRateChange: (rate: number) => void }) {
  const [people, setPeople] = useState(String(active?.participants ?? 64))
  const [roundMode, setRoundMode] = useState<'auto' | 'manual'>(active ? 'manual' : 'auto')
  const [rounds, setRounds] = useState(String(active?.plannedSwissRounds ?? 6))
  const [cut, setCut] = useState(String(active?.cutSize ?? 8))
  const [drawPercent, setDrawPercent] = useState(String(savedDrawRate * 100))
  const [iterations, setIterations] = useState<100000 | 1000000>(100000)
  const [currentWins, setCurrentWins] = useState('')
  const [currentLosses, setCurrentLosses] = useState('')
  const [currentDraws, setCurrentDraws] = useState('')
  const [requested, setRequested] = useState<SimulationInput | null>(null)
  const n = Number(people)
  const r = roundMode === 'auto' ? recommendedRounds(n) : Number(rounds)
  const current = useMemo(() => {
    if (active && countSwiss(active) === r - 1 && active.participants === n && active.plannedSwissRounds === r) return recordOf(active.matches.filter(match => match.phase === 'swiss'))
    const wins = Number(currentWins), losses = Number(currentLosses), draws = Number(currentDraws)
    if (currentWins !== '' && currentLosses !== '' && currentDraws !== '' && [wins, losses, draws].every(Number.isSafeInteger) && wins >= 0 && losses >= 0 && draws >= 0 && wins + losses + draws === r - 1) return { wins, losses, draws }
    return undefined
  }, [active, n, r, currentWins, currentLosses, currentDraws])

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const rate = Number(drawPercent) / 100
    if (Number.isFinite(rate) && rate >= 0 && rate <= 1) onDrawRateChange(rate)
    setRequested({ participants: n, rounds: r, cutSize: Number(cut), drawRate: rate, iterations })
  }

  return <div className="page-stack"><div className="intro-block"><p className="eyebrow">SWISS CALCULATOR</p><h2>瑞士轮计算器</h2><p>看看不同最终战绩大约有多大机会晋级。</p></div><form className="calculator-form" onSubmit={submit}>
    <div className="form-grid"><label className="field"><span className="field-label">参赛人数</span><input type="number" min="2" inputMode="numeric" value={people} onChange={e => setPeople(e.target.value)} /></label><label className="field"><span className="field-label">晋级人数</span><input type="number" min="1" inputMode="numeric" value={cut} onChange={e => setCut(e.target.value)} /></label></div>
    <div className="field"><span className="field-label">瑞士轮轮数</span><div className="segmented"><button type="button" className={roundMode === 'auto' ? 'selected' : ''} onClick={() => setRoundMode('auto')}>自动推荐 {recommendedRounds(n)}</button><button type="button" className={roundMode === 'manual' ? 'selected' : ''} onClick={() => setRoundMode('manual')}>手动输入</button></div>{roundMode === 'manual' && <input type="number" min="1" inputMode="numeric" value={rounds} onChange={e => setRounds(e.target.value)} />}</div>
    <div className="form-grid"><label className="field"><span className="field-label">平局率 · 模拟假设</span><div className="input-suffix"><input type="number" min="0" max="100" step="0.1" inputMode="decimal" value={drawPercent} onChange={e => setDrawPercent(e.target.value)} /><span>%</span></div></label><div className="field"><span className="field-label">模拟次数</span><div className="segmented"><button type="button" className={iterations === 100000 ? 'selected' : ''} onClick={() => setIterations(100000)}>10 万</button><button type="button" className={iterations === 1000000 ? 'selected' : ''} onClick={() => setIterations(1000000)}>100 万</button></div></div></div>
    <div className="field"><span className="field-label">最后一轮前战绩（可选）</span><div className="record-inputs"><input type="number" min="0" inputMode="numeric" value={currentWins} onChange={e => setCurrentWins(e.target.value)} placeholder="胜" /><span>-</span><input type="number" min="0" inputMode="numeric" value={currentLosses} onChange={e => setCurrentLosses(e.target.value)} placeholder="负" /><span>-</span><input type="number" min="0" inputMode="numeric" value={currentDraws} onChange={e => setCurrentDraws(e.target.value)} placeholder="平" /></div><span className="field-hint">填入已打 {Math.max(0, r - 1)} 轮的战绩；若当前赛事正好剩一轮，将自动使用记录。</span></div>
    <button type="submit" className="button primary full-width"><Calculator size={18} />查看模拟结果</button>
  </form>{requested && <SimulationView key={keyOf(requested)} input={requested} currentRecord={current} autoStart />}</div>
}
