import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchCards } from './cardSearch'

afterEach(() => vi.unstubAllGlobals())

describe('online card search contract', () => {
  const card = { cid: 4007, id: 89631139, cn_name: '青眼白龙', text: { types: '[怪兽|通常]', desc: '卡片文本' } }

  it('encodes keywords, forwards pagination and disables persistent fetch caching', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: [card], next: 3 }) })
    vi.stubGlobal('fetch', fetchMock)
    const signal = new AbortController().signal
    expect(await searchCards(' 青眼 & 白龙 ', 2, signal)).toEqual({ result: [card], next: 3 })
    const [url, options] = fetchMock.mock.calls[0]!
    expect(url.searchParams.get('search')).toBe('青眼 & 白龙')
    expect(url.searchParams.get('start')).toBe('2')
    expect(options).toEqual({ signal, cache: 'no-store', credentials: 'omit' })
  })

  it('accepts an empty final page', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: [], next: 0 }) }))
    expect(await searchCards('不存在', 0, new AbortController().signal)).toEqual({ result: [], next: 0 })
  })

  it('reports service errors instead of presenting empty results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    await expect(searchCards('青眼', 0, new AbortController().signal)).rejects.toThrow('503')
  })

  it.each([
    { result: [{ ...card, text: null }], next: 0 },
    { result: [card], next: 2 },
    { result: [card], next: -1 },
    { result: [card] },
  ])('rejects malformed cards or non-advancing pagination: %j', async data => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }))
    await expect(searchCards('青眼', 2, new AbortController().signal)).rejects.toThrow('数据格式异常')
  })
})
