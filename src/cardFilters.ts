// YGOPro constants: https://github.com/Fluorohydride/ygopro-scripts/blob/master/constant.lua
export const TYPE = { monster: 1, spell: 2, trap: 4, normal: 0x10, effect: 0x20, fusion: 0x40, ritual: 0x80, tuner: 0x1000, synchro: 0x2000, xyz: 0x800000, pendulum: 0x1000000, link: 0x4000000 }
export const monsterTypes: [number, string][] = [
  [TYPE.normal, '通常'], [TYPE.effect, '效果'], [TYPE.fusion, '融合'], [TYPE.ritual, '仪式'],
  [TYPE.synchro, '同调'], [TYPE.xyz, '超量'], [TYPE.link, '连接'], [TYPE.pendulum, '灵摆'],
  [TYPE.tuner, '调整'], [0x200, '灵魂'], [0x400, '同盟'], [0x800, '二重'],
  [0x200000, '反转'], [0x400000, '卡通'], [0x2000000, '特殊召唤'], [0x4000, '衍生物'],
]
export const spellTypes: [number, string][] = [[0, '通常'], [0x20000, '永续'], [0x10000, '速攻'], [0x40000, '装备'], [0x80, '仪式'], [0x80000, '场地']]
export const trapTypes: [number, string][] = [[0, '通常'], [0x20000, '永续'], [0x100000, '反击']]
export const attributes: [number, string][] = [[1, '地'], [2, '水'], [4, '炎'], [8, '风'], [16, '光'], [32, '暗'], [64, '神']]
export const races: [number, string][] = ['战士', '魔法师', '天使', '恶魔', '不死', '机械', '水', '炎', '岩石', '鸟兽', '植物', '昆虫', '雷', '龙', '兽', '兽战士', '恐龙', '鱼', '海龙', '爬虫类', '念动力', '幻神兽', '创造神', '幻龙', '电子界', '幻想魔'].map((name, index) => [2 ** index, name])
export const arrows: [number, string][] = [[0x40, '↖'], [0x80, '↑'], [0x100, '↗'], [8, '←'], [0x20, '→'], [1, '↙'], [2, '↓'], [4, '↘']]

export interface FilterCard { cid: number; id: number; name: string; alternateName: string; type: number; level: number; attribute: number; race: number; atk: number; def: number }
export type FilterRow = [number, number, string, string, number, number, number, number, number, number]
export interface CardIndex { schemaVersion: 1; md5: string; updatedAt: string; excludedCount: number; cards: FilterCard[] }
export interface StatFilter { mode: 'any' | 'eq' | 'min' | 'max' | 'range' | 'unknown'; value: string; upper: string }
export interface CardFilters { category: number; types: number[]; attribute: number; race: number; level: string; atk: StatFilter; def: StatFilter; arrows: number; exactArrows: boolean; name: string }
export const anyStat = (): StatFilter => ({ mode: 'any', value: '', upper: '' })
export const emptyFilters = (): CardFilters => ({ category: TYPE.monster, types: [], attribute: 0, race: 0, level: '', atk: anyStat(), def: anyStat(), arrows: 0, exactArrows: false, name: '' })

function matchesStat(value: number, filter: StatFilter): boolean {
  if (filter.mode === 'any') return true
  if (filter.mode === 'unknown') return value === -2
  if (value < 0) return false
  const target = Number(filter.value)
  if (filter.mode === 'eq') return value === target
  if (filter.mode === 'min') return value >= target
  if (filter.mode === 'max') return value <= target
  return value >= target && value <= Number(filter.upper)
}

export function filterError(filters: CardFilters): string | null {
  for (const [label, filter] of [['攻击力', filters.atk], ['守备力', filters.def]] as const) {
    if (filters.category !== TYPE.monster || (label === '守备力' && filters.types.includes(TYPE.link))) continue
    if (filter.mode === 'any' || filter.mode === 'unknown') continue
    if (!/^\d+$/.test(filter.value) || !Number.isSafeInteger(Number(filter.value))) return `请填写${label}的非负整数。`
    if (filter.mode === 'range' && (!/^\d+$/.test(filter.upper) || !Number.isSafeInteger(Number(filter.upper)) || Number(filter.upper) < Number(filter.value))) return `${label}范围的上限不能小于下限。`
  }
  return null
}

export function matchesCard(card: FilterCard, filters: CardFilters): boolean {
  if ((card.type & filters.category) === 0) return false
  // Normal spells/traps have only the category bit, not TYPE_NORMAL.
  if (!filters.types.every(type => type === 0 ? card.type === filters.category : (card.type & type) === type)) return false
  const name = filters.name.trim().normalize('NFKC').toLocaleLowerCase()
  if (name && ![card.name, card.alternateName, String(card.id), String(card.cid)].some(value => value.normalize('NFKC').toLocaleLowerCase().includes(name))) return false
  if (filters.category !== TYPE.monster) return true
  if (filters.attribute && card.attribute !== filters.attribute) return false
  if (filters.race && card.race !== filters.race) return false
  if (filters.level && (card.level & 0xff) !== Number(filters.level)) return false
  if (!matchesStat(card.atk, filters.atk)) return false
  const isLink = (card.type & TYPE.link) !== 0
  if (filters.def.mode !== 'any' && (isLink || !matchesStat(card.def, filters.def))) return false
  if (filters.arrows && (!isLink || (filters.exactArrows ? card.def !== filters.arrows : (card.def & filters.arrows) !== filters.arrows))) return false
  return true
}

export function filterCardSummary(card: FilterCard): string {
  if (!(card.type & TYPE.monster)) return [...spellTypes, ...trapTypes].find(([flag]) => flag ? (card.type & flag) !== 0 : card.type === TYPE.spell || card.type === TYPE.trap)?.[1] ?? ''
  const isLink = (card.type & TYPE.link) !== 0
  const kind = isLink ? 'LINK' : card.type & TYPE.xyz ? '阶级' : '等级'
  const stat = (value: number) => value === -2 ? '?' : String(value)
  return `${monsterTypes.filter(([flag]) => card.type & flag).map(([, label]) => label).join(' / ')} · ${races.find(([flag]) => flag === card.race)?.[1] ?? '未知种族'} / ${attributes.find(([flag]) => flag === card.attribute)?.[1] ?? '未知属性'}\n${kind} ${card.level & 0xff} · ${stat(card.atk)} / ${isLink ? '—' : stat(card.def)}`
}

export function appliedFilterSummary(filters: CardFilters): string {
  const options = filters.category === TYPE.monster ? monsterTypes : filters.category === TYPE.spell ? spellTypes : trapTypes
  const parts = [filters.category === TYPE.monster ? '怪兽' : filters.category === TYPE.spell ? '魔法' : '陷阱', ...filters.types.map(type => options.find(([flag]) => flag === type)?.[1] ?? '')]
  if (filters.category === TYPE.monster) {
    if (filters.attribute) parts.push(`${attributes.find(([flag]) => flag === filters.attribute)?.[1]}属性`)
    if (filters.race) parts.push(`${races.find(([flag]) => flag === filters.race)?.[1]}族`)
    if (filters.level) parts.push(`${filters.types.includes(TYPE.link) ? 'LINK' : filters.types.includes(TYPE.xyz) ? '阶级' : '等级/阶级/连接值'} ${filters.level}`)
    for (const [label, stat] of [['攻击力', filters.atk], ['守备力', filters.def]] as const) {
      if (stat.mode !== 'any') parts.push(`${label}${stat.mode === 'unknown' ? ' ?' : stat.mode === 'range' ? ` ${stat.value}–${stat.upper}` : `${stat.mode === 'eq' ? ' = ' : stat.mode === 'min' ? ' ≥ ' : ' ≤ '}${stat.value}`}`)
    }
    if (filters.arrows) parts.push(`${filters.exactArrows ? '箭头一致' : '包含箭头'} ${arrows.filter(([flag]) => filters.arrows & flag).map(([, arrow]) => arrow).join('')}`)
  }
  if (filters.name.trim()) parts.push(`“${filters.name.trim()}”`)
  return parts.filter(Boolean).join(' · ')
}

export function parseCardIndex(value: unknown): CardIndex {
  const error = () => new Error('筛选资料格式异常，请稍后重试。')
  if (!value || typeof value !== 'object') throw error()
  const data = value as Record<string, unknown>
  if (data.schemaVersion !== 1 || typeof data.md5 !== 'string' || !/^[a-f0-9]{32}$/.test(data.md5) || typeof data.updatedAt !== 'string' || !Number.isFinite(Date.parse(data.updatedAt)) || !Number.isSafeInteger(data.excludedCount) || Number(data.excludedCount) < 0 || !Array.isArray(data.cards) || !data.cards.length) throw error()
  const cids = new Set<number>()
  const cards = data.cards.map((row: unknown) => {
    if (!Array.isArray(row) || row.length !== 10 || typeof row[2] !== 'string' || !row[2] || typeof row[3] !== 'string' || ![0, 1, 4, 5, 6, 7, 8, 9].every(index => Number.isSafeInteger(row[index])) || row[0] <= 0 || row[1] <= 0 || row[4] <= 0 || row[5] < 0 || row[6] < 0 || row[7] < 0 || row[8] < -2 || row[9] < -2 || cids.has(row[0])) throw error()
    cids.add(row[0])
    const [cid, id, name, alternateName, type, level, attribute, race, atk, def] = row as FilterRow
    return { cid, id, name, alternateName, type, level, attribute, race, atk, def }
  })
  return { schemaVersion: 1, md5: data.md5, updatedAt: data.updatedAt, excludedCount: Number(data.excludedCount), cards }
}

export async function loadCardIndex(signal: AbortSignal): Promise<CardIndex> {
  const response = await fetch(`${import.meta.env.BASE_URL}card-filter-index.json`, { signal, cache: 'no-store', credentials: 'omit' })
  if (!response.ok) throw new Error('筛选资料暂时无法加载，请稍后重试。')
  return parseCardIndex(await response.json())
}
