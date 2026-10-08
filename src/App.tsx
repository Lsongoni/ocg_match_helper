import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BarChart3, CalendarDays, Calculator, ChevronRight, ClipboardList, FileText, History, Pencil, Plus, Save, Settings2, Trash2, X } from 'lucide-react'
import { deleteEvent, getSetting, listEvents, saveEvent, setSetting } from './db'
import { CalculatorPage, LastRoundPanel } from './Calculator'
import { ReportSheet } from './ReportSheet'
import { PhotoPanel } from './PhotoPanel'
import { SettingsPage } from './SettingsPage'
import { StatsPage } from './StatsPage'
import { deliverBackup } from './backup'
import { shouldRemindBackup, snoozeDate } from './backupReminder'
import {
  countKnockout, countSwiss, formatDate, inferredNextTurn, knockoutStages, localToday,
  makeId, matchKind, matchKindLabel, matchLabel, matchOutcome, placement, sortedMatches, visibleMatches,
  stageName, swissRecord, totalRecord,
  type EventRecord, type GameRecord, type GameResult, type MatchKind, type MatchPhase, type MatchRecord, type Turn,
} from './domain'
import { getTournamentFormat } from './swissRounds'

type Tab = 'current' | 'calculator' | 'history' | 'stats' | 'settings'
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
  const [cutMode, setCutMode] = useState<'auto' | 'manual'>(initial ? 'manual' : 'auto')
  const [manualCut, setCutSize] = useState(initial?.cutSize?.toString() ?? '')
  const [ownDeck, setOwnDeck] = useState(initial?.ownDeck ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const recommended = getTournamentFormat(Number(participants))
  const finalRounds = roundMode === 'auto' ? recommended?.swissRounds ?? 0 : Number(rounds)
  const cutSize = cutMode === 'auto' ? String(recommended?.topCut ?? '') : manualCut

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const people = Number(participants)
    const cut = Number(cutSize)
    if (!recommended && (roundMode === 'auto' || cutMode === 'auto')) return setError('当前人数没有自动推荐规则，请手动设置瑞士轮轮数和晋级人数。')
    if (!name.trim() || !date || !ownDeck.trim()) return setError('请填写赛事名称、日期和使用卡组。')
    if (!Number.isSafeInteger(people) || people < 2) return setError('参赛人数须为至少 2 人的整数。')
    if (!Number.isSafeInteger(finalRounds) || finalRounds < 1) return setError('瑞士轮轮数须为正整数。')
    if (!Number.isSafeInteger(cut) || cut < 2 || cut > people) return setError('晋级人数须为 2 至参赛人数之间的整数。')
    if (initial && finalRounds < countSwiss(initial)) return setError('计划轮数不能少于已记录的瑞士轮数。')
    if ((initial?.advancement === 'in' || initial?.matches.some(match => match.phase === 'knockout')) && cut !== initial.cutSize) return setError('已有淘汰赛记录或已出轮的赛事不能修改晋级人数。')
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
    <Field label="赛事名称"><input value={name} onChange={e => setName(e.target.value)} placeholder="例如：周末店赛" /></Field>
    <div className="form-grid event-form-grid">
      <Field label="比赛日期"><span className="event-date-input"><span aria-hidden="true">{formatDate(date)}</span><input type="date" value={date} onChange={e => setDate(e.target.value)} /></span></Field>
      <Field label="参赛人数"><input inputMode="numeric" type="number" min="2" value={participants} onChange={e => setParticipants(e.target.value)} placeholder="例如 64" /></Field>
    </div>
    <div className="field">
      <span className="field-label">瑞士轮轮数</span>
      <div className="segmented" role="group" aria-label="瑞士轮轮数方式">
        <button type="button" className={roundMode === 'auto' ? 'selected' : ''} onClick={() => setRoundMode('auto')}>自动推荐</button>
        <button type="button" className={roundMode === 'manual' ? 'selected' : ''} onClick={() => { if (!rounds) setRounds(recommended ? String(recommended.swissRounds) : ''); setRoundMode('manual') }}>手动填写</button>
      </div>
      {roundMode === 'manual' && <input inputMode="numeric" type="number" min="1" value={rounds} onChange={e => setRounds(e.target.value)} placeholder="轮数" />}
      <span className="field-hint">{recommended ? `推荐 ${recommended.swissRounds} 轮，Top ${recommended.topCut}；按人数区间规则计算。` : '少于 8 人或人数无效时无自动推荐，请手动设置轮数和晋级人数。'}</span>
    </div>
    <Field label="晋级人数">
      <div className="segmented" role="group" aria-label="晋级人数方式">
        <button type="button" className={cutMode === 'auto' ? 'selected' : ''} onClick={() => setCutMode('auto')}>自动推荐</button>
        <button type="button" className={cutMode === 'manual' ? 'selected' : ''} onClick={() => { if (!manualCut) setCutSize(cutSize); setCutMode('manual') }}>手动填写</button>
      </div>
      <div className="chip-row">{[4, 8, 16, 32].filter(value => !participants || value <= Number(participants)).map(value =>
        <button key={value} type="button" className={`chip ${cutSize === String(value) ? 'active' : ''}`} onClick={() => { setCutSize(String(value)); setCutMode('manual') }}>Top {value}</button>,
      )}</div>
      <input inputMode="numeric" type="number" min="2" value={cutSize} onChange={e => { setCutSize(e.target.value); setCutMode('manual') }} aria-label="自定义晋级人数" placeholder="或输入自定义人数" />
    </Field>
    <Field label="使用卡组"><input value={ownDeck} onChange={e => setOwnDeck(e.target.value)} placeholder="例如：白森林" /></Field>
    {error && <p className="error-message" role="alert">{error}</p>}
    <div className="form-actions">
      {onCancel && <button type="button" className="button secondary" onClick={onCancel}>取消</button>}
      <button type="submit" className="button primary" disabled={busy}><Save size={18} />{busy ? '保存中…' : initial ? '保存修改' : '创建赛事'}</button>
    </div>
  </form>
}

function gamesFromSequence(sequence: string, previous: DraftGame[], firstTurn: Turn | null): DraftGame[] {
  return [...sequence].map((result, index) => {
    const old = previous[index]
    const manualTurn = index === 0 || Boolean(old?.manualTurn)
    const turn = index === 0 ? firstTurn : manualTurn ? old.turn : inferredNextTurn(sequence[index - 1] as GameResult)
    return { id: old?.id ?? makeId(), result: result as GameResult, turn, manualTurn, note: old?.note ?? '' }
  })
}

function MatchEditor({ event, match, newPhase = 'swiss', suggestions, onSave, onDelete, onClose }: {
  event: EventRecord
  match?: MatchRecord
  newPhase?: MatchPhase
  suggestions: string[]
  onSave: (record: MatchRecord) => Promise<void>
  onDelete?: (record: MatchRecord) => Promise<void>
  onClose: () => void
}) {
  const phase = match?.phase ?? newPhase
  const round = match?.round ?? (phase === 'swiss' ? countSwiss(event) : countKnockout(event)) + 1
  const [kind, setKind] = useState<MatchKind>(match ? matchKind(match) : 'normal')
  const [opponentDeck, setOpponentDeck] = useState(match?.opponentDeck ?? '')
  const [games, setGames] = useState<DraftGame[]>(() => match?.games.length ? match.games.map(game => ({ ...game })) : gamesFromSequence('OO', [], null))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const sequence = games.map(game => game.result).join('')
  const preview = matchOutcome({ games: games.map(game => ({ ...game, turn: game.turn ?? 'first' })) })

  function setSequence(next: string) {
    setGames(current => gamesFromSequence(next, current, current[0]?.turn ?? null))
  }
  function changeResult(index: number, result: GameResult) {
    const next = games.map((game, i) => i === index ? { ...game, result } : game)
    setGames(gamesFromSequence(next.map(game => game.result).join(''), next, next[0]?.turn ?? null))
  }
  function changeFirstTurn(turn: Turn) {
    setGames(current => gamesFromSequence(current.map(game => game.result).join(''), current, turn))
  }
  function changeTurn(index: number, turn: Turn) {
    setGames(current => current.map((game, i) => i === index ? { ...game, turn, manualTurn: true } : game))
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (kind === 'normal') {
      if (!trimDeck(opponentDeck)) return setError('请填写对手卡组。')
      if (!games[0].turn) return setError('请选择 G1 先后攻。')
      if (games.some(game => !game.turn)) return setError('平局后的下一局，请确认先后攻。')
      if (phase === 'knockout' && preview === 'draw') return setError('淘汰赛 Match 需要分出胜负。')
    } else if (match?.games.length && !confirm('改为轮空或对手未到会移除原有 Game 记录与备注。确定保存吗？')) return
    setBusy(true)
    try {
      await onSave({ id: match?.id ?? makeId(), phase, round, kind, opponentDeck: kind === 'normal' ? trimDeck(opponentDeck) : '', games: kind === 'normal' ? games as GameRecord[] : [] })
    } catch (error) { setError(error instanceof Error ? error.message : '保存失败，请检查设备存储空间后重试。') } finally { setBusy(false) }
  }
  async function deleteMatch() {
    if (!match || !onDelete || !confirm(`删除 ${matchLabel(match)}？后续编号将自动调整。`)) return
    setBusy(true)
    try { await onDelete(match) } catch (error) { setError(error instanceof Error ? error.message : '删除失败。') } finally { setBusy(false) }
  }

  return <div className="sheet-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <section className="editor-sheet" role="dialog" aria-modal="true" aria-label={`记录 ${phase === 'swiss' ? 'R' : 'M'}${round}`}>
      <header className="sheet-header"><div><p className="eyebrow">{phase === 'swiss' ? '瑞士轮' : '淘汰赛'}</p><h2>{match ? '编辑' : '记录'} {phase === 'swiss' ? 'R' : 'M'}{round}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="关闭"><X size={22} /></button></header>
      <form className="sheet-body form-stack" onSubmit={submit}>
        {phase === 'swiss' && <div className="field"><span className="field-label">对局类型</span><div className="chip-row" role="group" aria-label="对局类型">{([['normal', '正常对局'], ['bye', '轮空'], ['no-show', '对手未到']] as const).map(([value, label]) => <button key={value} type="button" className={`chip ${kind === value ? 'active' : ''}`} onClick={() => { setKind(value); setError('') }}>{label}</button>)}</div></div>}
        {kind === 'normal' && <><Field label="对手卡组"><input value={opponentDeck} onChange={e => setOpponentDeck(e.target.value)} placeholder="例如：M∀LICE" list="deck-suggestions" /><datalist id="deck-suggestions">{suggestions.map(deck => <option key={deck} value={deck} />)}</datalist></Field>
        <div className="field"><span className="field-label">小局结果</span><div className="chip-row">{presets.map(value => <button type="button" key={value} className={`chip result-chip ${sequence === value ? 'active' : ''}`} onClick={() => setSequence(value)}>{value}</button>)}</div><span className="field-hint">常见结果一键选择；也可以逐局修改或添加。</span></div>
        <div className="game-list">{games.map((game, index) => <div className="game-card" key={game.id}>
          <div className="game-heading"><strong>G{index + 1}</strong><div className="segmented compact" role="group" aria-label={`G${index + 1}结果`}>{(['O', 'X', 'D'] as const).map(result => <button key={result} type="button" className={game.result === result ? 'selected' : ''} onClick={() => changeResult(index, result)}>{result}</button>)}</div></div>
          <div className="turn-line"><span>先后攻</span><div className="segmented compact" role="group" aria-label={`G${index + 1}先后攻`}>{(['first', 'second'] as const).map(turn => <button key={turn} type="button" className={game.turn === turn ? 'selected' : ''} onClick={() => index === 0 ? changeFirstTurn(turn) : changeTurn(index, turn)}>{turnText(turn)}</button>)}</div></div>
          {index > 0 && <p className="micro-copy">{games[index - 1].result === 'D' ? '上一局平局，请手动确认。' : game.manualTurn ? '已手动调整' : '根据上一局结果自动推断，可修改。'}</p>}
          <textarea value={game.note} onChange={e => setGames(current => current.map((item, i) => i === index ? { ...item, note: e.target.value } : item))} placeholder={`G${index + 1} 备注（可选）`} rows={2} />
        </div>)}</div>
        <div className="inline-actions"><button className="text-button" type="button" onClick={() => setSequence(`${sequence}O`)}><Plus size={16} />添加小局</button>{games.length > 1 && <button className="text-button muted" type="button" onClick={() => setSequence(sequence.slice(0, -1))}>移除末局</button>}</div>
        </>}
        <div className="result-preview"><span>Match 结果</span><strong>{kind !== 'normal' || preview === 'win' ? '胜' : preview === 'loss' ? '负' : '平'}</strong></div>
        {error && <p className="error-message" role="alert">{error}</p>}
        <button className="button primary full-width" type="submit" disabled={busy}><Save size={18} />{busy ? '保存中…' : '保存 Match'}</button>
        {match && <button className="danger-link" type="button" onClick={() => void deleteMatch()} disabled={busy}><Trash2 size={16} />删除这场 Match</button>}
      </form>
    </section>
  </div>
}

function MatchList({ event, onEdit }: { event: EventRecord; onEdit: (match: MatchRecord) => void }) {
  const matches = sortedMatches(event)
  if (!matches.length) return <div className="empty-panel"><ClipboardList size={25} /><strong>还没有 Match 记录</strong><p>打完一整场 Match 后，在这里一次性填写结果。</p></div>
  return <div className="match-list">{matches.map(match => <button className="match-row" type="button" key={match.id} onClick={() => onEdit(match)}>
    <span className="round-badge">{matchLabel(match)}</span><span className="match-main"><strong>{matchKindLabel(match) ?? match.opponentDeck}</strong>{matchKind(match) === 'normal' && <small>{turnText(match.games[0].turn)} · {match.games.map(game => game.result).join('')}</small>}</span><span className={`outcome ${matchOutcome(match)}`}>{outcomeText(match)}</span><ChevronRight size={18} className="chevron" />
  </button>)}</div>
}

function AdvancementPanel({ event, onAdvanced, onOut }: { event: EventRecord; onAdvanced: (stage: number) => void; onOut: () => void }) {
  const stages = knockoutStages(event.cutSize)
  const standard = Number.isInteger(Math.log2(event.cutSize))
  const [firstStage, setFirstStage] = useState(event.firstKnockoutStage ?? stages[0])
  return <section className="decision-panel"><p className="eyebrow">SWISS FINISHED</p><h3>是否出轮</h3><p>按正式赛事结果选择，可在这里修正。模拟概率不会自动决定出轮。</p>
    {!standard && event.advancement !== 'in' && <label className="field"><span className="field-label">自己的首场淘汰赛阶段</span><select value={firstStage} onChange={e => setFirstStage(Number(e.target.value))}>{stages.map(stage => <option value={stage} key={stage}>{stageName(stage)}</option>)}</select><span className="field-hint">自定义 Top 可能包含轮空，按实际首战选择。</span></label>}
    <div className="decision-actions"><button className="button primary" onClick={() => onAdvanced(firstStage)} disabled={event.advancement === 'in'}>{event.advancement === 'in' ? '已选择：出轮' : '已出轮 · 进入 M1'}</button><button className="button secondary" onClick={onOut} disabled={event.advancement === 'out'}>{event.advancement === 'out' ? '已选择：没出轮' : '改为没出轮'}</button></div>
  </section>
}

function TotalNote({ value, onSave }: { value: string; onSave: (note: string) => Promise<void> }) {
  const [note, setNote] = useState(value)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => setNote(value), [value])
  async function save() {
    setBusy(true)
    try { await onSave(note); setError('') } catch { setError('总备注保存失败。') } finally { setBusy(false) }
  }
  return <section className="section-block"><div className="section-heading"><div><p className="eyebrow">EVENT NOTE</p><h3>赛事总备注</h3></div></div><textarea className="event-note" rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="整场赛事的复盘，可选" />{note !== value && <button className="text-button" onClick={() => void save()} disabled={busy}><Save size={16} />保存总备注</button>}{error && <p className="error-message">{error}</p>}</section>
}

function EventDetail({ event, onBack, onEditEvent, onEditMatch, onAddMatch, onEndEarly, onOut, onAdvanced, onSaveNote, onReport, onDelete, drawRate }: {
  event: EventRecord
  onBack?: () => void
  onEditEvent: () => void
  onEditMatch: (match: MatchRecord) => void
  onAddMatch: (phase: MatchPhase) => void
  onEndEarly: () => void
  onOut: () => void
  onAdvanced: (stage: number) => void
  onSaveNote: (note: string) => Promise<void>
  onReport: () => void
  onDelete?: () => void
  drawRate: number
}) {
  const played = countSwiss(event)
  const knockouts = countKnockout(event)
  const canAddSwiss = event.status === 'active' && event.advancement === 'undecided' && played < event.plannedSwissRounds
  const canAddKnockout = event.status === 'active' && event.advancement === 'in'
  const nextStage = event.firstKnockoutStage ? event.firstKnockoutStage / 2 ** knockouts : null
  return <div className="page-stack">
    {onBack && <button className="text-button back-link" onClick={onBack}><ArrowLeft size={17} />返回历史</button>}
    <section className="event-hero">
      <div className="event-topline"><span className="eyebrow">{event.status === 'active' ? '正在进行' : '已结束'}</span><button type="button" className="icon-button light" onClick={onEditEvent} aria-label="编辑赛事"><Pencil size={18} /></button></div>
      <h2>{event.name}</h2><p className="event-meta"><CalendarDays size={15} />{formatDate(event.date)} <span className="dot" /> {event.participants} 人 · {event.plannedSwissRounds} 轮 · Top {event.cutSize}</p>
      <div className="hero-deck"><span>使用卡组</span><strong>{event.ownDeck}</strong></div>
    </section>
    <section className="score-strip"><div><span>瑞士战绩</span><strong>{swissRecord(event)}</strong></div><div><span>已完成轮数</span><strong>{played} <small>/ {event.plannedSwissRounds}</small></strong></div><div><span>最终成绩</span><strong className="small-score">{placement(event)}</strong></div></section>
    {event.status === 'active' && event.advancement === 'undecided' && played === event.plannedSwissRounds - 1 && <LastRoundPanel event={event} drawRate={drawRate} />}
    <section className="section-block"><div className="section-heading"><div><p className="eyebrow">MATCH LOG</p><h3>对局记录</h3></div><span className="count-pill">{visibleMatches(event).length} 场</span></div><MatchList event={event} onEdit={onEditMatch} /></section>
    {canAddSwiss && <button className="button primary full-width add-match" onClick={() => onAddMatch('swiss')}><Plus size={20} />记录 R{played + 1} Match</button>}
    {(played >= event.plannedSwissRounds || event.advancement !== 'undecided') && <AdvancementPanel key={`${event.id}-${event.cutSize}`} event={event} onAdvanced={onAdvanced} onOut={onOut} />}
    {canAddKnockout && nextStage && nextStage >= 2 && <button className="button primary full-width add-match" onClick={() => onAddMatch('knockout')}><Plus size={20} />记录 M{knockouts + 1} Match <small>· {stageName(nextStage)}</small></button>}
    {event.status === 'active' && event.advancement === 'undecided' && played > 0 && played < event.plannedSwissRounds && <button className="button quiet full-width" onClick={onEndEarly}>提前结束 · 没出轮</button>}
    {event.status === 'active' && event.advancement === 'out' && <button className="button quiet full-width" onClick={onEndEarly}>结束赛事</button>}
    {(visibleMatches(event).length > 0 || event.status === 'finished') && <TotalNote value={event.totalNote} onSave={onSaveNote} />}
    {event.status === 'finished' && <PhotoPanel eventId={event.id} />}
    {event.status === 'finished' && <><div className="end-summary"><span>赛事已结束</span><strong>总战绩 {totalRecord(event)} · {placement(event)}</strong></div><button className="button primary full-width" onClick={onReport}><FileText size={18} />生成战报</button></>}
    {onDelete && <button className="danger-link" onClick={onDelete}><Trash2 size={16} />删除这场赛事</button>}
  </div>
}

function BackupReminder({ onBackup, onLater, busy, error }: { onBackup: () => void; onLater: () => void; busy: boolean; error: string }) {
  return <div className="sheet-backdrop reminder-backdrop"><section className="reminder-dialog" role="dialog" aria-modal="true" aria-label="备份提醒"><p className="eyebrow">BACKUP REMINDER</p><h2>记得备份比赛记录</h2><p>距离首次记录或上次备份已超过 30 天。建议保存完整 ZIP，避免换手机或浏览器数据丢失。</p>{error && <p className="error-message" role="alert">{error}</p>}<button className="button primary full-width" onClick={onBackup} disabled={busy}>{busy ? '正在生成备份…' : '立即备份'}</button><button className="button quiet full-width" onClick={onLater} disabled={busy}>稍后提醒</button></section></div>
}

export function App() {
  const [events, setEvents] = useState<EventRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('current')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingEvent, setEditingEvent] = useState<EventRecord | null>(null)
  const [editingMatch, setEditingMatch] = useState<MatchRecord | 'new-swiss' | 'new-knockout' | null>(null)
  const [reportEventId, setReportEventId] = useState<string | null>(null)
  const [drawRate, setDrawRate] = useState(.03)
  const [backupReminder, setBackupReminder] = useState(false)
  const [backupBusy, setBackupBusy] = useState(false)
  const [backupError, setBackupError] = useState('')
  const active = events.find(event => event.status === 'active')
  const selected = events.find(event => event.id === selectedId)
  const reportEvent = events.find(event => event.id === reportEventId)
  const viewed = tab === 'current' ? active : selected
  const suggestions = useMemo(() => [...new Set(events.flatMap(event => visibleMatches(event).filter(match => matchKind(match) === 'normal').map(match => match.opponentDeck)))].sort(), [events])

  async function refresh() {
    try { setEvents(await listEvents()); setError('') } catch { setError('无法读取本地记录，请检查浏览器存储权限。') } finally { setLoading(false) }
  }
  useEffect(() => {
    void refresh()
    void Promise.all([getSetting('drawRate', .03), getSetting<string | null>('lastBackupAt', null), getSetting<string | null>('backupReminderSnoozeUntil', null), listEvents()])
      .then(([rate, last, snooze, all]) => { setDrawRate(rate); setBackupReminder(shouldRemindBackup(all, last, snooze)) })
      .catch(() => {})
  }, [])
  function updateDrawRate(rate: number) { setDrawRate(rate); void setSetting('drawRate', rate) }
  async function remindBackup() {
    setBackupBusy(true); setBackupError('')
    try { const exportedAt = await deliverBackup(); if (exportedAt) setBackupReminder(false) }
    catch (error) { setBackupError(error instanceof Error ? error.message : '备份失败，请重试。') }
    finally { setBackupBusy(false) }
  }
  async function remindLater() {
    try { await setSetting('backupReminderSnoozeUntil', snoozeDate()); setBackupReminder(false) }
    catch { setBackupError('无法保存提醒设置，请检查设备存储空间。') }
  }
  async function afterRestore() {
    await refresh(); setDrawRate(await getSetting('drawRate', .03)); setBackupReminder(false); setSelectedId(null); setTab('history')
  }

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
    if (record.phase === 'knockout' && matchOutcome(record) === 'loss' && matches.some(match => match.phase === 'knockout' && match.round > record.round)) throw new Error('已有后续淘汰赛记录；请先删除后续 M 场次。')
    const next = { ...viewed, matches }
    if (record.phase === 'knockout') next.status = placement(next) === '淘汰赛进行中' ? 'active' : 'finished'
    await saveEvent(next)
    await refresh()
    setEditingMatch(null)
    if (next.status === 'finished') { setTab('history'); setSelectedId(next.id) }
  }
  async function handleMatchDelete(record: MatchRecord) {
    if (!viewed) return
    if (record.phase === 'knockout' && record.round !== countKnockout(viewed)) throw new Error('请先删除后面的淘汰赛 Match。')
    const matches = viewed.matches.filter(match => match.id !== record.id).map(match => match.phase === record.phase && match.round > record.round ? { ...match, round: match.round - 1 } : match)
    const next = { ...viewed, matches }
    if (record.phase === 'knockout') next.status = 'active'
    await saveEvent(next)
    await refresh()
    setEditingMatch(null)
  }
  async function handleAdvanced(event: EventRecord, stage: number) {
    const next: EventRecord = { ...event, advancement: 'in', firstKnockoutStage: stage }
    next.status = placement(next) === '淘汰赛进行中' ? 'active' : 'finished'
    await saveEvent(next)
    await refresh()
    setTab(next.status === 'active' ? 'current' : 'history')
    setSelectedId(next.status === 'active' ? null : next.id)
  }
  async function handleOut(event: EventRecord) {
    const knockouts = event.matches.filter(match => match.phase === 'knockout').length
    if (knockouts && !confirm(`已有 ${knockouts} 场淘汰赛 Match。改为“没出轮”后会暂时隐藏这些记录，战报和统计不计入；重新选择“已出轮”可恢复。确定修改吗？`)) return
    await saveEvent({ ...event, advancement: 'out' })
    await refresh()
  }
  async function handleNote(event: EventRecord, note: string) {
    await saveEvent({ ...event, totalNote: note })
    await refresh()
  }
  async function handleEnd(event: EventRecord) {
    if (!confirm(event.advancement === 'out' ? '确定结束这场赛事？之后仍可在历史比赛中修正出轮状态。' : '提前结束这场赛事并记录为“没出轮”？之后仍可在历史比赛中修正。')) return
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
        tab === 'current' ? (active ? <EventDetail event={active} drawRate={drawRate} onEditEvent={() => setEditingEvent(active)} onEditMatch={setEditingMatch} onAddMatch={phase => setEditingMatch(phase === 'swiss' ? 'new-swiss' : 'new-knockout')} onEndEarly={() => void handleEnd(active)} onOut={() => void handleOut(active)} onAdvanced={stage => void handleAdvanced(active, stage)} onSaveNote={note => handleNote(active, note)} onReport={() => setReportEventId(active.id)} /> : <EventForm onSave={handleEventSave} />) :
        tab === 'calculator' ? <CalculatorPage active={active} savedDrawRate={drawRate} onDrawRateChange={updateDrawRate} /> :
        tab === 'stats' ? <StatsPage events={events} /> :
        tab === 'settings' ? <SettingsPage onRestored={afterRestore} onBackupSaved={() => setBackupReminder(false)} /> :
        selected ? <EventDetail event={selected} drawRate={drawRate} onBack={() => setSelectedId(null)} onEditEvent={() => setEditingEvent(selected)} onEditMatch={setEditingMatch} onAddMatch={phase => setEditingMatch(phase === 'swiss' ? 'new-swiss' : 'new-knockout')} onEndEarly={() => void handleEnd(selected)} onOut={() => void handleOut(selected)} onAdvanced={stage => void handleAdvanced(selected, stage)} onSaveNote={note => handleNote(selected, note)} onReport={() => setReportEventId(selected.id)} onDelete={() => void handleDelete(selected)} /> :
        <div className="page-stack"><div className="intro-block history-intro"><p className="eyebrow">YOUR ARCHIVE</p><h2>历史比赛</h2><p>每一场赛事都留在设备里，随时查看和修改。</p></div>{events.length ? <div className="history-list">{events.map(event => <button key={event.id} className="history-card" onClick={() => setSelectedId(event.id)}><span>{formatDate(event.date)} · {event.participants} 人</span><div><strong>{event.name}</strong><ChevronRight size={20} /></div><p>{event.ownDeck} · {totalRecord(event)} · {placement(event)}</p></button>)}</div> : <div className="empty-panel"><History size={25} /><strong>还没有历史比赛</strong><p>创建赛事后，记录会保存在这台设备上。</p></div>}</div>}
    </main>
    <nav className="bottom-nav" aria-label="主导航"><button className={tab === 'current' ? 'active' : ''} onClick={() => { setTab('current'); setSelectedId(null); setEditingEvent(null) }}><ClipboardList size={21} /><span>当前比赛</span></button><button className={tab === 'calculator' ? 'active' : ''} onClick={() => { setTab('calculator'); setSelectedId(null); setEditingEvent(null) }}><Calculator size={21} /><span>计算器</span></button><button className={tab === 'history' ? 'active' : ''} onClick={() => { setTab('history'); setSelectedId(null); setEditingEvent(null) }}><History size={21} /><span>历史比赛</span></button><button className={tab === 'stats' ? 'active' : ''} onClick={() => { setTab('stats'); setSelectedId(null); setEditingEvent(null) }}><BarChart3 size={21} /><span>统计</span></button><button className={tab === 'settings' ? 'active' : ''} onClick={() => { setTab('settings'); setSelectedId(null); setEditingEvent(null) }}><Settings2 size={21} /><span>设置</span></button></nav>
    {editingMatch && viewed && <MatchEditor event={viewed} match={typeof editingMatch === 'string' ? undefined : editingMatch} newPhase={editingMatch === 'new-knockout' ? 'knockout' : 'swiss'} suggestions={suggestions} onSave={handleMatchSave} onDelete={handleMatchDelete} onClose={() => setEditingMatch(null)} />}
    {reportEvent && <ReportSheet event={reportEvent} onClose={() => setReportEventId(null)} />}
    {backupReminder && <BackupReminder onBackup={() => void remindBackup()} onLater={() => void remindLater()} busy={backupBusy} error={backupError} />}
  </div>
}
