import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CalendarDays, ChevronRight, ClipboardList, History, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { deleteEvent, listEvents, saveEvent } from './db'
import {
  countSwiss, formatDate, inferredNextTurn, localToday, makeId, matchLabel,
  matchOutcome, placement, recommendedRounds, sortedMatches, swissRecord, totalRecord,
  type EventRecord, type GameRecord, type GameResult, type MatchRecord, type Turn,
} from './domain'

type Tab = 'current' | 'history'
type DraftGame = Omit<GameRecord, 'turn'> & { turn: Turn | null }

const presets = ['OO', 'OXO', 'XOO', 'XX', 'OXX', 'XOX']

function trimDeck(value: string): string {
  return value.trim().normalize('NFC')
}

function turnText(turn: Turn): string {
  return turn === 'first' ? '先' : '后'
}

function outcomeText(match: MatchRecord): string {
  const outcome = matchOutcome(match)
  return outcome === 'win' ? '胜' : outcome === 'loss' ? '负' : '平'
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="field"><span className="field-label">{label}</span>{children}{hint && <span className="field-hint">{hint}</span>}</label>
}

function EventForm({ initial, onSave, onCancel }: {
  initial?: EventRecord
  onSave: (event: EventRecord) => Promise<void>
  onCancel?: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [date, setDate] = useState(initial?.date ?? localToday())
  const [participants, setParticipants] = useState(initial?.participants?.toString() ?? '')
  const [roundMode, setRoundMode] = useState<'auto' | 'manual'>(initial ? 'manual' : 'auto')
  const [rounds, setRounds] = useState(initial?.plannedSwissRounds?.toString() ?? '')
  const [cutSize, setCutSize] = useState(initial?.cutSize?.toString() ?? '8')
  const [ownDeck, setOwnDeck] = useState(initial?.ownDeck ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const recommended = recommendedRounds(Number(participants) || 2)
  const finalRounds = roundMode === 'auto' ? recommended : Number(rounds)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const people = Number(participants)
    const cut = Number(cutSize)
    if (!name.trim() || !date || !ownDeck.trim()) return setError('请填写赛事名称、日期和使用卡组。')
    if (!Number.isSafeInteger(people) || people < 2) return setError('参赛人数须为至少 2 人的整数。')
    if (!Number.isSafeInteger(finalRounds) || finalRounds < 1) return setError('瑞士轮轮数须为正整数。')
    if (!Number.isSafeInteger(cut) || cut < 2 || cut > people) return setError('晋级人数须为 2 至参赛人数之间的整数。')
    if (initial && finalRounds < countSwiss(initial)) return setError('计划轮数不能少于已记录的瑞士轮数。')
    const now = new Date().toISOString()
    const record: EventRecord = initial ? {
      ...initial, name: name.trim(), date, participants: people,
      plannedSwissRounds: finalRounds, cutSize: cut, ownDeck: trimDeck(ownDeck),
    } : {
      id: makeId(), name: name.trim(), date, participants: people,
      plannedSwissRounds: finalRounds, cutSize: cut, ownDeck: trimDeck(ownDeck),
      status: 'active', advancement: 'undecided', firstKnockoutStage: null,
      totalNote: '', matches: [], createdAt: now, updatedAt: now,
    }
    setBusy(true)
    try { await onSave(record) } catch { setError('保存失败，请检查设备存储空间后重试。') } finally { setBusy(false) }
  }

  return <form className="form-stack" onSubmit={submit}>
    <div className="intro-block">
      <p className="eyebrow">{initial ? '编辑赛事' : '开始记录'}</p>
      <h2>{initial ? '赛事信息' : '新建一场比赛'}</h2>
      <p>比赛结束一个 Match 后，再打开这里一次性记录。</p>
    </div>
    <Field label="赛事名称"><input autoFocus={!initial} value={name} onChange={e => setName(e.target.value)} placeholder="例如：周末店赛" /></Field>
    <div className="form-grid">
      <Field label="比赛日期"><input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
      <Field label="参赛人数"><input inputMode="numeric" type="number" min="2" value={participants} onChange={e => { const next = e.target.value; setParticipants(next); const people = Number(next); if (people >= 2 && Number(cutSize) > people) setCutSize(String(Math.max(2, 2 ** Math.floor(Math.log2(people))))) }} placeholder="例如 64" /></Field>
    </div>
    <div className="field">
      <span className="field-label">瑞士轮轮数</span>
      <div className="segmented" role="group" aria-label="瑞士轮轮数方式">
        <button type="button" className={roundMode === 'auto' ? 'selected' : ''} onClick={() => setRoundMode('auto')}>自动推荐</button>
        <button type="button" className={roundMode === 'manual' ? 'selected' : ''} onClick={() => setRoundMode('manual')}>手动填写</button>
      </div>
      {roundMode === 'manual' && <input inputMode="numeric" type="number" min="1" value={rounds} onChange={e => setRounds(e.target.value)} placeholder="轮数" />}
      <span className="field-hint">推荐 {recommended} 轮，按 ceil(log₂ 人数) 估算；不是官方固定规则。</span>
    </div>
    <Field label="晋级人数">
      <div className="chip-row">{[4, 8, 16, 32].filter(value => !participants || value <= Number(participants)).map(value =>
        <button key={value} type="button" className={`chip ${cutSize === String(value) ? 'active' : ''}`} onClick={() => setCutSize(String(value))}>Top {value}</button>,
      )}</div>
      <input inputMode="numeric" type="number" min="2" value={cutSize} onChange={e => setCutSize(e.target.value)} aria-label="自定义晋级人数" placeholder="或输入自定义人数" />
    </Field>
    <Field label="使用卡组"><input value={ownDeck} onChange={e => setOwnDeck(e.target.value)} placeholder="例如：白森林" /></Field>
    {error && <p className="error-message" role="alert">{error}</p>}
    <div className="form-actions">
      {onCancel && <button type="button" className="button secondary" onClick={onCancel}>取消</button>}
      <button type="submit" className="button primary" disabled={busy}><Save size={18} />{busy ? '保存中…' : initial ? '保存修改' : '创建赛事'}</button>
    </div>
  </form>
}

function gamesFromSequence(sequence: string, previous: DraftGame[], firstTurn: Turn): DraftGame[] {
  return [...sequence].map((result, index) => {
    const old = previous[index]
    const manualTurn = index === 0 || Boolean(old?.manualTurn)
    const turn = index === 0 ? firstTurn : manualTurn ? old.turn : inferredNextTurn(sequence[index - 1] as GameResult)
    return { id: old?.id ?? makeId(), result: result as GameResult, turn, manualTurn, note: old?.note ?? '' }
  })
}

function MatchEditor({ event, match, suggestions, onSave, onClose }: {
  event: EventRecord
  match?: MatchRecord
  suggestions: string[]
  onSave: (record: MatchRecord) => Promise<void>
  onClose: () => void
}) {
  const phase = match?.phase ?? 'swiss'
  const round = match?.round ?? countSwiss(event) + 1
  const [opponentDeck, setOpponentDeck] = useState(match?.opponentDeck ?? '')
  const [games, setGames] = useState<DraftGame[]>(() => match?.games.map(game => ({ ...game })) ?? gamesFromSequence('OO', [], 'first'))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const sequence = games.map(game => game.result).join('')
  const preview = matchOutcome({ games: games.map(game => ({ ...game, turn: game.turn ?? 'first' })) })

  function setSequence(next: string) {
    setGames(current => gamesFromSequence(next, current, current[0]?.turn ?? 'first'))
  }
  function changeResult(index: number, result: GameResult) {
    const next = games.map((game, i) => i === index ? { ...game, result } : game)
    setGames(gamesFromSequence(next.map(game => game.result).join(''), next, next[0]?.turn ?? 'first'))
  }
  function changeFirstTurn(turn: Turn) {
    setGames(current => gamesFromSequence(current.map(game => game.result).join(''), current, turn))
  }
  function changeTurn(index: number, turn: Turn) {
    setGames(current => current.map((game, i) => i === index ? { ...game, turn, manualTurn: true } : game))
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!trimDeck(opponentDeck)) return setError('请填写对手卡组。')
    if (games.some(game => !game.turn)) return setError('平局后的下一局，请确认先后攻。')
    if (phase === 'knockout' && preview === 'draw') return setError('淘汰赛 Match 需要分出胜负。')
    setBusy(true)
    try {
      await onSave({ id: match?.id ?? makeId(), phase, round, opponentDeck: trimDeck(opponentDeck), games: games as GameRecord[] })
    } catch { setError('保存失败，请检查设备存储空间后重试。') } finally { setBusy(false) }
  }

  return <div className="sheet-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <section className="editor-sheet" role="dialog" aria-modal="true" aria-label={`记录 ${phase === 'swiss' ? 'R' : 'M'}${round}`}>
      <header className="sheet-header"><div><p className="eyebrow">{phase === 'swiss' ? '瑞士轮' : '淘汰赛'}</p><h2>{match ? '编辑' : '记录'} {phase === 'swiss' ? 'R' : 'M'}{round}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="关闭"><X size={22} /></button></header>
      <form className="sheet-body form-stack" onSubmit={submit}>
        <Field label="对手卡组"><input autoFocus value={opponentDeck} onChange={e => setOpponentDeck(e.target.value)} placeholder="例如：M∀LICE" list="deck-suggestions" /><datalist id="deck-suggestions">{suggestions.map(deck => <option key={deck} value={deck} />)}</datalist></Field>
        <div className="field"><span className="field-label">小局结果</span><div className="chip-row">{presets.map(value => <button type="button" key={value} className={`chip result-chip ${sequence === value ? 'active' : ''}`} onClick={() => setSequence(value)}>{value}</button>)}</div><span className="field-hint">常见结果一键选择；也可以逐局修改或添加。</span></div>
        <div className="game-list">{games.map((game, index) => <div className="game-card" key={game.id}>
          <div className="game-heading"><strong>G{index + 1}</strong><div className="segmented compact" role="group" aria-label={`G${index + 1}结果`}>{(['O', 'X', 'D'] as const).map(result => <button key={result} type="button" className={game.result === result ? 'selected' : ''} onClick={() => changeResult(index, result)}>{result}</button>)}</div></div>
          <div className="turn-line"><span>先后攻</span><div className="segmented compact" role="group" aria-label={`G${index + 1}先后攻`}>{(['first', 'second'] as const).map(turn => <button key={turn} type="button" className={game.turn === turn ? 'selected' : ''} onClick={() => index === 0 ? changeFirstTurn(turn) : changeTurn(index, turn)}>{turnText(turn)}</button>)}</div></div>
          {index > 0 && <p className="micro-copy">{games[index - 1].result === 'D' ? '上一局平局，请手动确认。' : game.manualTurn ? '已手动调整' : '根据上一局结果自动推断，可修改。'}</p>}
          <textarea value={game.note} onChange={e => setGames(current => current.map((item, i) => i === index ? { ...item, note: e.target.value } : item))} placeholder={`G${index + 1} 备注（可选）`} rows={2} />
        </div>)}</div>
        <div className="inline-actions"><button className="text-button" type="button" onClick={() => setSequence(`${sequence}O`)}><Plus size={16} />添加小局</button>{games.length > 1 && <button className="text-button muted" type="button" onClick={() => setSequence(sequence.slice(0, -1))}>移除末局</button>}</div>
        <div className="result-preview"><span>自动判断 Match</span><strong>{preview === 'win' ? '胜' : preview === 'loss' ? '负' : '平'}</strong></div>
        {error && <p className="error-message" role="alert">{error}</p>}
        <button className="button primary full-width" type="submit" disabled={busy}><Save size={18} />{busy ? '保存中…' : '保存 Match'}</button>
      </form>
    </section>
  </div>
}

function MatchList({ event, onEdit }: { event: EventRecord; onEdit: (match: MatchRecord) => void }) {
  const matches = sortedMatches(event)
  if (!matches.length) return <div className="empty-panel"><ClipboardList size={25} /><strong>还没有 Match 记录</strong><p>打完一整场 Match 后，在这里一次性填写结果。</p></div>
  return <div className="match-list">{matches.map(match => <button className="match-row" type="button" key={match.id} onClick={() => onEdit(match)}>
    <span className="round-badge">{matchLabel(match)}</span><span className="match-main"><strong>{match.opponentDeck}</strong><small>{turnText(match.games[0].turn)} · {match.games.map(game => game.result).join('')}</small></span><span className={`outcome ${matchOutcome(match)}`}>{outcomeText(match)}</span><ChevronRight size={18} className="chevron" />
  </button>)}</div>
}

function EventDetail({ event, onBack, onEditEvent, onEditMatch, onAddMatch, onEndEarly, onDelete }: {
  event: EventRecord
  onBack?: () => void
  onEditEvent: () => void
  onEditMatch: (match: MatchRecord) => void
  onAddMatch: () => void
  onEndEarly: () => void
  onDelete?: () => void
}) {
  const played = countSwiss(event)
  const canAdd = event.status === 'active' && played < event.plannedSwissRounds
  return <div className="page-stack">
    {onBack && <button className="text-button back-link" onClick={onBack}><ArrowLeft size={17} />返回历史</button>}
    <section className="event-hero">
      <div className="event-topline"><span className="eyebrow">{event.status === 'active' ? '正在进行' : '已结束'}</span><button type="button" className="icon-button light" onClick={onEditEvent} aria-label="编辑赛事"><Pencil size={18} /></button></div>
      <h2>{event.name}</h2><p className="event-meta"><CalendarDays size={15} />{formatDate(event.date)} <span className="dot" /> {event.participants} 人 · {event.plannedSwissRounds} 轮 · Top {event.cutSize}</p>
      <div className="hero-deck"><span>使用卡组</span><strong>{event.ownDeck}</strong></div>
    </section>
    <section className="score-strip"><div><span>瑞士战绩</span><strong>{swissRecord(event)}</strong></div><div><span>已完成轮数</span><strong>{played} <small>/ {event.plannedSwissRounds}</small></strong></div><div><span>最终成绩</span><strong className="small-score">{placement(event)}</strong></div></section>
    <section className="section-block"><div className="section-heading"><div><p className="eyebrow">MATCH LOG</p><h3>对局记录</h3></div><span className="count-pill">{event.matches.length} 场</span></div><MatchList event={event} onEdit={onEditMatch} /></section>
    {canAdd && <button className="button primary full-width add-match" onClick={onAddMatch}><Plus size={20} />记录 R{played + 1} Match</button>}
    {event.status === 'active' && played > 0 && <button className="button quiet full-width" onClick={onEndEarly}>结束赛事 · 没出轮</button>}
    {event.status === 'finished' && <div className="end-summary"><span>赛事已结束</span><strong>总战绩 {totalRecord(event)} · {placement(event)}</strong></div>}
    {onDelete && <button className="danger-link" onClick={onDelete}><Trash2 size={16} />删除这场赛事</button>}
  </div>
}

export function App() {
  const [events, setEvents] = useState<EventRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('current')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingEvent, setEditingEvent] = useState<EventRecord | null>(null)
  const [editingMatch, setEditingMatch] = useState<MatchRecord | 'new' | null>(null)
  const active = events.find(event => event.status === 'active')
  const selected = events.find(event => event.id === selectedId)
  const viewed = tab === 'current' ? active : selected
  const suggestions = useMemo(() => [...new Set(events.flatMap(event => event.matches.map(match => match.opponentDeck)))].sort(), [events])

  async function refresh() {
    try { setEvents(await listEvents()); setError('') } catch { setError('无法读取本地记录，请检查浏览器存储权限。') } finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [])

  async function handleEventSave(record: EventRecord) {
    await saveEvent(record)
    await refresh()
    setEditingEvent(null)
    setSelectedId(record.id)
    setTab(record.status === 'active' ? 'current' : 'history')
  }
  async function handleMatchSave(record: MatchRecord) {
    if (!viewed) return
    const matches = viewed.matches.filter(match => match.id !== record.id)
    matches.push(record)
    await saveEvent({ ...viewed, matches })
    await refresh()
    setEditingMatch(null)
  }
  async function handleEnd(event: EventRecord) {
    if (!confirm('结束这场赛事并记录为“没出轮”？之后仍可在历史比赛中编辑。')) return
    await saveEvent({ ...event, status: 'finished', advancement: 'out' })
    await refresh()
    setTab('history')
    setSelectedId(event.id)
  }
  async function handleDelete(event: EventRecord) {
    if (!confirm(`确定删除“${event.name}”及其全部记录？此操作不可撤销。`)) return
    await deleteEvent(event.id)
    setSelectedId(null)
    await refresh()
  }

  return <div className="app-shell">
    <header className="topbar"><div className="brand-mark">OCG<span>.</span></div><span className="topbar-subtitle">比赛助手</span></header>
    <main className="main-content">
      {loading ? <div className="loading-panel">正在读取本地赛事…</div> : error ? <div className="error-panel" role="alert">{error}<button className="button secondary" onClick={() => void refresh()}>重试</button></div> :
        editingEvent ? <EventForm initial={editingEvent} onSave={handleEventSave} onCancel={() => setEditingEvent(null)} /> :
        tab === 'current' ? (active ? <EventDetail event={active} onEditEvent={() => setEditingEvent(active)} onEditMatch={setEditingMatch} onAddMatch={() => setEditingMatch('new')} onEndEarly={() => void handleEnd(active)} /> : <EventForm onSave={handleEventSave} />) :
        selected ? <EventDetail event={selected} onBack={() => setSelectedId(null)} onEditEvent={() => setEditingEvent(selected)} onEditMatch={setEditingMatch} onAddMatch={() => setEditingMatch('new')} onEndEarly={() => void handleEnd(selected)} onDelete={() => void handleDelete(selected)} /> :
        <div className="page-stack"><div className="intro-block history-intro"><p className="eyebrow">YOUR ARCHIVE</p><h2>历史比赛</h2><p>每一场赛事都留在设备里，随时查看和修改。</p></div>{events.length ? <div className="history-list">{events.map(event => <button key={event.id} className="history-card" onClick={() => setSelectedId(event.id)}><span>{formatDate(event.date)} · {event.participants} 人</span><div><strong>{event.name}</strong><ChevronRight size={20} /></div><p>{event.ownDeck} · {totalRecord(event)} · {placement(event)}</p></button>)}</div> : <div className="empty-panel"><History size={25} /><strong>还没有历史比赛</strong><p>创建赛事后，记录会保存在这台设备上。</p></div>}</div>}
    </main>
    <nav className="bottom-nav" aria-label="主导航"><button className={tab === 'current' ? 'active' : ''} onClick={() => { setTab('current'); setSelectedId(null); setEditingEvent(null) }}><ClipboardList size={21} /><span>当前比赛</span></button><button className={tab === 'history' ? 'active' : ''} onClick={() => { setTab('history'); setSelectedId(null); setEditingEvent(null) }}><History size={21} /><span>历史比赛</span></button></nav>
    {editingMatch && viewed && <MatchEditor event={viewed} match={editingMatch === 'new' ? undefined : editingMatch} suggestions={suggestions} onSave={handleMatchSave} onClose={() => setEditingMatch(null)} />}
  </div>
}
