import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ChevronRight, Search } from 'lucide-react'
import { cardName, searchCards, type CardInfo } from './cardSearch'

function CardDetail({ card, onBack }: { card: CardInfo; onBack: () => void }) {
  const [imageFailed, setImageFailed] = useState(false)
  return <div className="page-stack">
    <button className="text-button" onClick={onBack}><ArrowLeft size={17} />返回搜索结果</button>
    <div className="intro-block"><p className="eyebrow">CARD DETAIL</p><h2>{cardName(card)}</h2></div>
    <section className="card-detail">
      {imageFailed ? <p className="subtle-note">卡图暂时无法加载，文字资料仍可查看。</p> : <img className="card-art" src={`https://cdn.233.momobako.com/ygopro/pics/${card.id}.jpg!half`} alt={cardName(card)} onError={() => setImageFailed(true)} />}
      <div className="card-names">{card.cn_name !== cardName(card) && <p>其他译名：{card.cn_name}</p>}{card.jp_name && <p>{card.jp_name}</p>}{card.en_name && <p>{card.en_name}</p>}<p>卡片密码：{card.id}</p></div>
      <p className="card-text">{card.text.types}</p>
      {card.text.pdesc && <div><h3>灵摆效果</h3><p className="card-text">{card.text.pdesc}</p></div>}
      <div><h3>卡片文本</h3><p className="card-text">{card.text.desc || '暂无卡片文本。'}</p></div>
      <a className="text-button" href={`https://ygocdb.com/card/cid/${card.cid}`} target="_blank" rel="noopener noreferrer">在百鸽查看详情与裁定<ChevronRight size={16} /></a>
    </section>
  </div>
}

export function CardSearchPage() {
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [cards, setCards] = useState<CardInfo[]>([])
  const [next, setNext] = useState(0)
  const [searched, setSearched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<CardInfo | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  const request = useRef<AbortController | null>(null)

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine)
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    return () => {
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
      request.current?.abort()
      request.current = null
    }
  }, [])

  async function load(term: string, start = 0) {
    if (!term.trim()) return
    request.current?.abort()
    request.current = null
    setBusy(false)
    setError('')
    if (!navigator.onLine) { setError('卡查需要联网，请连接网络后重试。'); return }
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    if (start === 0) { setQuery(term.trim()); setCards([]); setNext(0); setSearched(false) }
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    try {
      const page = await searchCards(term, start, controller.signal)
      if (request.current !== controller) return
      setCards(previous => start === 0 ? page.result : [...previous, ...page.result.filter(card => !previous.some(item => item.cid === card.cid))])
      setNext(page.next)
      setSearched(true)
    } catch (cause) {
      if (request.current !== controller) return
      setError(!navigator.onLine ? '卡查需要联网，请连接网络后重试。' : controller.signal.aborted ? '搜索超时，请重试。' : cause instanceof TypeError ? '无法连接卡查服务，请检查网络或稍后重试。' : cause instanceof Error ? cause.message : '搜索失败，请稍后重试。')
    } finally {
      window.clearTimeout(timeout)
      if (request.current === controller) { setBusy(false); request.current = null }
    }
  }

  if (selected) return <CardDetail key={selected.cid} card={selected} onBack={() => setSelected(null)} />
  return <div className="page-stack">
    <div className="intro-block"><p className="eyebrow">ONLINE CARD SEARCH</p><h2>在线卡查</h2><p>输入卡名、效果关键词或卡片密码。需要联网使用。</p></div>
    <form className="card-search-form" onSubmit={event => { event.preventDefault(); void load(input) }}>
      <label className="field"><span className="field-label">搜索卡片</span><input type="search" value={input} onChange={event => setInput(event.target.value)} placeholder="例如：灰流丽、青眼白龙" enterKeyHint="search" maxLength={200} /></label>
      <button className="button primary" type="submit" disabled={!input.trim()}><Search size={18} />搜索</button>
    </form>
    {!online && <p className="error-message" role="status">当前处于离线状态，卡查需要联网。比赛记录等功能仍可离线使用。</p>}
    {error && <p className="error-message" role="alert">{error}</p>}
    <div aria-live="polite" aria-busy={busy}>
      {cards.length > 0 && <><p className="subtle-note card-results-label">“{query}” · 已显示 {cards.length} 张</p><div className="card-results">{cards.map(card => <button type="button" className="card-result" key={card.cid} onClick={() => setSelected(card)}><div><strong>{cardName(card)}</strong><p>{card.text.types}</p></div><ChevronRight size={19} /></button>)}</div></>}
      {busy && <p className="loading-panel" role="status">正在搜索…</p>}
      {searched && !cards.length && !busy && <div className="empty-panel"><Search size={25} /><strong>没有找到相关卡片</strong><p>试试其他卡名、关键词或卡片密码。</p></div>}
      {!searched && !busy && !error && <div className="empty-panel"><Search size={25} /><strong>查一下卡片效果</strong><p>点击结果查看卡片文字和卡图。</p></div>}
    </div>
    {next > 0 && <button className="button secondary full-width" disabled={busy} onClick={() => void load(query, next)}>加载更多</button>}
    <p className="subtle-note">资料来源：<a href="https://ygocdb.com/api" target="_blank" rel="noopener noreferrer">百鸽</a>。按需联网查询，不下载离线卡库。</p>
  </div>
}
