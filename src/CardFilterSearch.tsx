import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Search } from 'lucide-react'
import { getCardDetail, type CardInfo } from './cardSearch'
import { anyStat, appliedFilterSummary, arrows, attributes, emptyFilters, filterCardSummary, filterError, loadCardIndex, matchesCard, monsterTypes, races, spellTypes, trapTypes, TYPE, type CardFilters, type CardIndex, type FilterCard, type StatFilter } from './cardFilters'

function StatField({ label, value, onChange }: { label: string; value: StatFilter; onChange: (value: StatFilter) => void }) {
  return <div className="field filter-stat"><label><span className="field-label">{label}</span><select aria-label={`${label}条件`} value={value.mode} onChange={event => onChange({ ...value, mode: event.target.value as StatFilter['mode'] })}><option value="any">不限</option><option value="eq">等于</option><option value="min">至少</option><option value="max">至多</option><option value="range">范围</option><option value="unknown">?（不定）</option></select></label>
    {value.mode !== 'any' && value.mode !== 'unknown' && <div className="filter-range"><input aria-label={`${label}${value.mode === 'range' ? '下限' : '数值'}`} type="number" inputMode="numeric" min="0" step="1" value={value.value} onChange={event => onChange({ ...value, value: event.target.value })} placeholder="数值" required />{value.mode === 'range' && <><span>至</span><input aria-label={`${label}上限`} type="number" inputMode="numeric" min="0" step="1" value={value.upper} onChange={event => onChange({ ...value, upper: event.target.value })} placeholder="上限" required /></>}</div>}
  </div>
}

function FilterForm({ value, onChange, onSubmit, busy }: { value: CardFilters; onChange: (filters: CardFilters) => void; onSubmit: () => void; busy: boolean }) {
  const monster = value.category === TYPE.monster
  const link = value.types.includes(TYPE.link)
  const options = monster ? monsterTypes : value.category === TYPE.spell ? spellTypes : trapTypes
  const patch = (changes: Partial<CardFilters>) => onChange({ ...value, ...changes })
  function toggleType(type: number) {
    const types = value.types.includes(type) ? value.types.filter(item => item !== type) : [...value.types, type]
    const isLink = types.includes(TYPE.link)
    patch({ types, ...(isLink ? { def: anyStat() } : { arrows: 0, exactArrows: false }) })
  }
  return <form className="filter-form" onSubmit={event => { event.preventDefault(); onSubmit() }}>
    <div className="field"><span className="field-label">卡片大类</span><div className="chip-row">{[[TYPE.monster, '怪兽'], [TYPE.spell, '魔法'], [TYPE.trap, '陷阱']].map(([type, label]) => <button className={`chip ${value.category === type ? 'active' : ''}`} aria-pressed={value.category === type} type="button" key={type} onClick={() => onChange({ ...emptyFilters(), category: Number(type), name: value.name })}>{label}</button>)}</div></div>
    <div className="field"><span className="field-label">{monster ? '怪兽类型' : value.category === TYPE.spell ? '魔法类型' : '陷阱类型'}（多选需同时满足）</span><div className="chip-row">{options.map(([type, label]) => <button className={`chip ${value.types.includes(type) ? 'active' : ''}`} aria-pressed={value.types.includes(type)} type="button" key={type} onClick={() => toggleType(type)}>{label}</button>)}</div></div>
    {monster && <>
      <div className="form-grid"><label className="field"><span className="field-label">属性</span><select value={value.attribute} onChange={event => patch({ attribute: Number(event.target.value) })}><option value="0">不限</option>{attributes.map(([flag, label]) => <option value={flag} key={flag}>{label}</option>)}</select></label><label className="field"><span className="field-label">种族</span><select value={value.race} onChange={event => patch({ race: Number(event.target.value) })}><option value="0">不限</option>{races.map(([flag, label]) => <option value={flag} key={flag}>{label}族</option>)}</select></label></div>
      <label className="field"><span className="field-label">{link ? '连接值' : value.types.includes(TYPE.xyz) ? '阶级' : '等级 / 阶级 / 连接值'}</span><select value={value.level} onChange={event => patch({ level: event.target.value })}><option value="">不限</option>{Array.from({ length: 14 }, (_, index) => <option key={index} value={index}>{index}</option>)}</select></label>
      <div className={link ? '' : 'form-grid'}><StatField label="攻击力" value={value.atk} onChange={atk => patch({ atk })} />{!link && <StatField label="守备力" value={value.def} onChange={def => patch({ def })} />}</div>
      {link && <div className="field"><span className="field-label">连接箭头</span><div className="arrow-picker" role="group" aria-label="连接箭头方向">{arrows.map(([flag, arrow], index) => <button type="button" key={flag} style={{ gridArea: `${index < 3 ? 1 : index < 5 ? 2 : 3} / ${index < 3 ? index + 1 : index === 3 ? 1 : index === 4 ? 3 : index - 4}` }} aria-label={`箭头${arrow}`} aria-pressed={!!(value.arrows & flag)} className={`chip ${value.arrows & flag ? 'active' : ''}`} onClick={() => patch({ arrows: value.arrows ^ flag })}>{arrow}</button>)}<span className="arrow-center">LINK</span></div><label className="filter-checkbox"><input type="checkbox" checked={value.exactArrows} onChange={event => patch({ exactArrows: event.target.checked })} />箭头完全一致</label><p className="field-hint">默认需包含全部选中方向；勾选后不允许有其他箭头。不选方向时不限。</p></div>}
    </>}
    <label className="field"><span className="field-label">卡名 / 卡片密码（可选）</span><input type="search" placeholder="不记得名字可以留空" maxLength={200} value={value.name} onChange={event => patch({ name: event.target.value })} /></label>
    <p className="subtle-note">所有已选条件需同时满足。记得多少就填多少，其余留空。</p>
    <div className="form-actions"><button className="button quiet" type="button" onClick={() => onChange(emptyFilters())}>重置条件</button><button className="button primary" disabled={busy} type="submit"><Search size={17} />{busy ? '正在查询…' : '筛选卡片'}</button></div>
  </form>
}

export function CardFilterSearch({ onSelect }: { onSelect: (card: CardInfo) => void }) {
  const [filters, setFilters] = useState(emptyFilters)
  const [applied, setApplied] = useState<CardFilters | null>(null)
  const [index, setIndex] = useState<CardIndex | null>(null)
  const [visible, setVisible] = useState(30)
  const [open, setOpen] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [detailLoading, setDetailLoading] = useState<number | null>(null)
  const request = useRef<AbortController | null>(null)
  const resultHeading = useRef<HTMLParagraphElement | null>(null)
  useEffect(() => () => { request.current?.abort(); request.current = null }, [])
  useEffect(() => { if (applied) resultHeading.current?.scrollIntoView({ block: 'start' }) }, [applied])
  const results = useMemo(() => applied && index ? index.cards.filter(card => matchesCard(card, applied)) : [], [applied, index])

  async function submit() {
    setError('')
    const invalid = filterError(filters)
    if (invalid) { setError(invalid); return }
    if (!navigator.onLine) { setError('筛选卡查需要联网，请连接网络后重试。'); return }
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    const timeout = window.setTimeout(() => controller.abort(), 20000)
    try {
      const loaded = index ?? await loadCardIndex(controller.signal)
      if (request.current !== controller) return
      setIndex(loaded); setApplied(filters); setVisible(30); setOpen(false)
    } catch (cause) {
      if (request.current === controller) setError(controller.signal.aborted ? '筛选资料加载超时，请重试。' : cause instanceof TypeError ? '无法连接筛选服务，请检查网络后重试。' : cause instanceof Error ? cause.message : '筛选资料加载失败，请重试。')
    } finally { window.clearTimeout(timeout); if (request.current === controller) { request.current = null; setBusy(false) } }
  }

  async function select(card: FilterCard) {
    setError('')
    if (!navigator.onLine) { setError('卡片详情需要联网，请连接网络后重试。'); return }
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setDetailLoading(card.cid)
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    try {
      const detail = await getCardDetail(card.id, controller.signal)
      if (request.current === controller) onSelect(detail)
    } catch (cause) {
      if (request.current === controller) setError(controller.signal.aborted ? '详情加载超时，请重试。' : cause instanceof TypeError ? '无法连接卡查服务，请检查网络后重试。' : cause instanceof Error ? cause.message : '详情加载失败，请重试。')
    } finally { window.clearTimeout(timeout); if (request.current === controller) { request.current = null; setDetailLoading(null) } }
  }

  return <div className="page-stack">
    <button className="button secondary full-width" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '收起筛选条件' : '修改筛选条件'}</button>
    {open && <FilterForm value={filters} onChange={setFilters} onSubmit={() => void submit()} busy={busy} />}
    {error && <p role="alert" className="error-message">{error}</p>}
    {detailLoading !== null && <p role="status" className="subtle-note">正在加载卡片详情…</p>}
    {applied && index && <div aria-live="polite"><p ref={resultHeading} className="subtle-note card-results-label">符合条件 {results.length} 张 · 已显示 {Math.min(visible, results.length)} 张</p><p className="filter-applied">{appliedFilterSummary(applied)}</p>{results.length ? <div className="card-results">{results.slice(0, visible).map(card => <button className="card-result" key={card.cid} disabled={detailLoading !== null || busy} onClick={() => void select(card)}><div><strong>{card.name}</strong><p>{filterCardSummary(card)}</p></div><ChevronRight size={19} /></button>)}</div> : <div className="empty-panel"><Search size={25} /><strong>没有符合条件的卡片</strong><p>试着减少条件或扩大攻守范围。</p></div>}{visible < results.length && <button className="button secondary full-width filter-more" onClick={() => setVisible(visible + 30)}>加载更多</button>}<p className="subtle-note filter-index-note">筛选资料更新：{new Date(index.updatedAt).toLocaleDateString('zh-CN')}{index.excludedCount > 0 && `；${index.excludedCount} 条资料缺少筛选字段，未纳入筛选。`}</p></div>}
  </div>
}
