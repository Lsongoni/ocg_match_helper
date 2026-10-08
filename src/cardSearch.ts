export interface CardInfo {
  cid: number
  id: number
  cn_name: string
  sc_name?: string
  jp_name?: string
  en_name?: string
  text: { types: string; pdesc?: string; desc: string }
}

export interface CardSearchResult { result: CardInfo[]; next: number }

function isCard(value: unknown): value is CardInfo {
  if (!value || typeof value !== 'object') return false
  const card = value as Partial<CardInfo>
  return Number.isSafeInteger(card.cid) && Number.isSafeInteger(card.id)
    && typeof card.cn_name === 'string'
    && [card.sc_name, card.jp_name, card.en_name].every(name => name === undefined || typeof name === 'string')
    && !!card.text && typeof card.text.types === 'string' && typeof card.text.desc === 'string'
    && (card.text.pdesc === undefined || typeof card.text.pdesc === 'string')
}

export async function searchCards(query: string, start: number, signal: AbortSignal): Promise<CardSearchResult> {
  const url = new URL('https://ygocdb.com/api/v0/')
  url.searchParams.set('search', query.trim())
  url.searchParams.set('start', String(start))
  const response = await fetch(url, { signal, cache: 'no-store', credentials: 'omit' })
  if (!response.ok) throw new Error(`卡查服务返回错误（${response.status}），请稍后重试。`)
  const data: unknown = await response.json()
  if (!data || typeof data !== 'object') throw new Error('卡查返回的数据格式异常，请稍后重试。')
  const page = data as Partial<CardSearchResult>
  if (!Array.isArray(page.result) || !page.result.every(isCard)
    || !Number.isSafeInteger(page.next) || page.next! < 0 || (page.next !== 0 && page.next! <= start)) {
    throw new Error('卡查返回的数据格式异常，请稍后重试。')
  }
  return page as CardSearchResult
}

export function cardName(card: CardInfo): string { return card.sc_name || card.cn_name }

export async function getCardDetail(id: number, signal: AbortSignal): Promise<CardInfo> {
  const response = await fetch(`https://ygocdb.com/api/v0/card/${id}?show=all`, { signal, cache: 'no-store', credentials: 'omit' })
  if (!response.ok) throw new Error(`卡片详情加载失败（${response.status}），请重试。`)
  const raw: unknown = await response.json()
  const card = raw && typeof raw === 'object' ? { ...raw, cn_name: (raw as CardInfo).cn_name || (raw as CardInfo).sc_name || (raw as CardInfo).jp_name || (raw as CardInfo).en_name } : raw
  if (!isCard(card) || card.id !== id) throw new Error('卡片详情格式异常，请稍后重试。')
  return card
}
