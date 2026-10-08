import { describe, expect, it } from 'vitest'
import { emptyFilters, filterError, matchesCard, parseCardIndex, TYPE, type FilterCard } from './cardFilters'

const monster: FilterCard = { cid: 1, id: 100, name: '测试怪兽', alternateName: 'Test', type: TYPE.monster | TYPE.effect, level: 4, attribute: 32, race: 0x2000, atk: 2000, def: 0 }

describe('card filter intersection', () => {
  it('requires level 4 AND dark attribute, not either one', () => {
    const filters = { ...emptyFilters(), level: '4', attribute: 32 }
    expect(matchesCard(monster, filters)).toBe(true)
    expect(matchesCard({ ...monster, level: 3 }, filters)).toBe(false)
    expect(matchesCard({ ...monster, attribute: 16 }, filters)).toBe(false)
  })

  it('requires every selected monster subtype', () => {
    const filters = { ...emptyFilters(), types: [TYPE.fusion, TYPE.pendulum] }
    expect(matchesCard({ ...monster, type: monster.type | TYPE.fusion }, filters)).toBe(false)
    expect(matchesCard({ ...monster, type: monster.type | TYPE.pendulum }, filters)).toBe(false)
    expect(matchesCard({ ...monster, type: monster.type | TYPE.fusion | TYPE.pendulum }, filters)).toBe(true)
  })

  it('decodes packed pendulum levels and XYZ rank correctly', () => {
    const filters = { ...emptyFilters(), types: [TYPE.xyz], level: '4' }
    expect(matchesCard({ ...monster, type: monster.type | TYPE.xyz | TYPE.pendulum, level: 0x04040004 }, filters)).toBe(true)
    expect(matchesCard({ ...monster, level: 0x04040004 }, filters)).toBe(false)
  })

  it('normal spell/trap is category only and types never use OR', () => {
    const filters = { ...emptyFilters(), category: TYPE.spell, types: [0] }
    expect(matchesCard({ ...monster, type: TYPE.spell }, filters)).toBe(true)
    expect(matchesCard({ ...monster, type: TYPE.spell | 0x10000 }, filters)).toBe(false)
    expect(matchesCard({ ...monster, type: TYPE.spell | 0x10000 }, { ...filters, types: [0x10000, 0x20000] })).toBe(false)
    expect(matchesCard({ ...monster, type: TYPE.trap }, { ...filters, category: TYPE.trap })).toBe(true)
  })

  it('checks included and exact arrows and never treats arrows as defense', () => {
    const link = { ...monster, type: monster.type | TYPE.link, def: 0x85, level: 3 }
    const filters = { ...emptyFilters(), types: [TYPE.link], arrows: 5 }
    expect(matchesCard(link, filters)).toBe(true)
    expect(matchesCard(link, { ...filters, exactArrows: true })).toBe(false)
    expect(matchesCard(link, { ...filters, arrows: 0x85, exactArrows: true })).toBe(true)
    expect(matchesCard(link, { ...filters, arrows: 2 })).toBe(false)
    expect(matchesCard(monster, { ...filters, types: [] })).toBe(false)
    expect(matchesCard(link, { ...emptyFilters(), def: { mode: 'eq', value: '133', upper: '' } })).toBe(false)
  })

  it('does not mix unknown attack with zero and applies inclusive ranges', () => {
    const filters = { ...emptyFilters(), atk: { mode: 'range' as const, value: '0', upper: '2000' } }
    expect(matchesCard(monster, filters)).toBe(true)
    expect(matchesCard({ ...monster, atk: 0 }, filters)).toBe(true)
    expect(matchesCard({ ...monster, atk: -2 }, filters)).toBe(false)
    expect(matchesCard({ ...monster, atk: 2001 }, filters)).toBe(false)
    expect(matchesCard({ ...monster, atk: -2 }, { ...filters, atk: { mode: 'unknown', value: '', upper: '' } })).toBe(true)
  })

  it('combines optional name, race and stats with other conditions', () => {
    const filters = { ...emptyFilters(), name: 'test', race: 0x2000, atk: { mode: 'eq' as const, value: '2000', upper: '' } }
    expect(matchesCard(monster, filters)).toBe(true)
    expect(matchesCard({ ...monster, race: 1 }, filters)).toBe(false)
    expect(matchesCard({ ...monster, atk: 1000 }, filters)).toBe(false)
    expect(matchesCard(monster, { ...filters, name: '不存在' })).toBe(false)
  })

  it('reports missing and reversed numeric ranges', () => {
    expect(filterError({ ...emptyFilters(), atk: { mode: 'eq', value: '', upper: '' } })).toContain('攻击力')
    expect(filterError({ ...emptyFilters(), atk: { mode: 'range', value: '2000', upper: '1000' } })).toContain('上限')
    expect(filterError({ ...emptyFilters(), atk: { mode: 'range', value: '1000', upper: '2000' } })).toBeNull()
  })
})

describe('filter index validation', () => {
  const index = { schemaVersion: 1, md5: 'a'.repeat(32), updatedAt: '2026-10-08T00:00:00Z', excludedCount: 1, cards: [[1, 100, '测试', '', 33, 4, 32, 8192, 2000, -2]] }
  it('loads numeric fields without replacing missing/unknown values', () => {
    expect(parseCardIndex(index).cards[0]?.def).toBe(-2)
    expect(parseCardIndex(index).excludedCount).toBe(1)
  })
  it('rejects missing fields, duplicate cids and incompatible schemas', () => {
    expect(() => parseCardIndex({ ...index, schemaVersion: 2 })).toThrow('格式异常')
    expect(() => parseCardIndex({ ...index, cards: [[1, 100, '测试']] })).toThrow('格式异常')
    expect(() => parseCardIndex({ ...index, cards: [...index.cards, ...index.cards] })).toThrow('格式异常')
  })
})
