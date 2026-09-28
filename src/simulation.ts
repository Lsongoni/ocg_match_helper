export interface SimulationInput {
  participants: number
  rounds: number
  cutSize: number
  drawRate: number
  iterations: number
}

export interface SimulationRow {
  wins: number
  losses: number
  draws: number
  points: number
  appearances: number
  qualifications: number
  rate: number
}

export interface SimulationResult {
  input: SimulationInput
  rows: SimulationRow[]
  completed: number
}

export function validateSimulationInput(input: SimulationInput): string | null {
  if (!Number.isSafeInteger(input.participants) || input.participants < 2) return '参赛人数须为至少 2 人的整数。'
  if (!Number.isSafeInteger(input.rounds) || input.rounds < 1) return '轮数须为正整数。'
  if (!Number.isSafeInteger(input.cutSize) || input.cutSize < 1 || input.cutSize > input.participants) return '晋级人数须在 1 至参赛人数之间。'
  if (!Number.isFinite(input.drawRate) || input.drawRate < 0 || input.drawRate > 1) return '平局率须为 0% 至 100%。'
  if (input.iterations !== 100_000 && input.iterations !== 1_000_000 && input.iterations < 1) return '模拟次数无效。'
  return null
}

function seedFor(input: SimulationInput): number {
  const text = `${input.participants}|${input.rounds}|${input.cutSize}|${input.drawRate}|${input.iterations}`
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash || 1
}

export function runSwissSimulation(input: SimulationInput, onProgress?: (done: number) => void): SimulationResult {
  const issue = validateSimulationInput(input)
  if (issue) throw new Error(issue)

  const { participants: count, rounds, cutSize, drawRate, iterations } = input
  const wins = new Uint16Array(count)
  const losses = new Uint16Array(count)
  const draws = new Uint16Array(count)
  const points = new Uint16Array(count)
  const hadBye = new Uint8Array(count)
  const pairing = new Uint32Array(count)
  const qualified = new Uint8Array(count)
  const buckets: number[][] = Array.from({ length: 3 * rounds + 1 }, () => [])
  const totals = new Map<number, { appearances: number; qualifications: number }>()
  const stride = rounds + 1
  let seed = seedFor(input)
  let lastProgress = performance.now()

  function random(): number {
    seed ^= seed << 13
    seed ^= seed >>> 17
    seed ^= seed << 5
    return (seed >>> 0) / 4_294_967_296
  }

  function shuffle(bucket: number[]): void {
    for (let i = bucket.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1))
      const temp = bucket[i]
      bucket[i] = bucket[j]
      bucket[j] = temp
    }
  }

  function orderedPlayers(excluded = -1): number {
    for (const bucket of buckets) bucket.length = 0
    for (let player = 0; player < count; player += 1) if (player !== excluded) buckets[points[player]].push(player)
    let length = 0
    for (let score = buckets.length - 1; score >= 0; score -= 1) {
      shuffle(buckets[score])
      for (const player of buckets[score]) pairing[length++] = player
    }
    return length
  }

  for (let trial = 0; trial < iterations; trial += 1) {
    wins.fill(0); losses.fill(0); draws.fill(0); points.fill(0); hadBye.fill(0)
    for (let round = 0; round < rounds; round += 1) {
      let bye = -1
      if (count % 2) {
        let lowest = Infinity
        let tied = 0
        for (let player = 0; player < count; player += 1) {
          if (hadBye[player]) continue
          if (points[player] < lowest) { lowest = points[player]; bye = player; tied = 1 }
          else if (points[player] === lowest && random() < 1 / ++tied) bye = player
        }
        if (bye < 0) {
          for (let player = 0; player < count; player += 1) {
            if (points[player] < lowest) { lowest = points[player]; bye = player }
          }
        }
        hadBye[bye] = 1; wins[bye] += 1; points[bye] += 3
      }

      const length = orderedPlayers(bye)
      for (let i = 0; i < length; i += 2) {
        const first = pairing[i]
        const second = pairing[i + 1]
        const outcome = random()
        if (outcome < drawRate) {
          draws[first] += 1; draws[second] += 1
          points[first] += 1; points[second] += 1
        } else if (outcome < drawRate + (1 - drawRate) / 2) {
          wins[first] += 1; losses[second] += 1; points[first] += 3
        } else {
          wins[second] += 1; losses[first] += 1; points[second] += 3
        }
      }
    }

    orderedPlayers()
    qualified.fill(0)
    for (let index = 0; index < cutSize; index += 1) qualified[pairing[index]] = 1
    for (let player = 0; player < count; player += 1) {
      const key = wins[player] * stride * stride + losses[player] * stride + draws[player]
      const record = totals.get(key)
      if (record) {
        record.appearances += 1
        record.qualifications += qualified[player]
      } else totals.set(key, { appearances: 1, qualifications: qualified[player] })
    }
    if (onProgress && (trial + 1 === iterations || performance.now() - lastProgress > 200)) {
      lastProgress = performance.now()
      onProgress(trial + 1)
    }
  }

  const rows = [...totals].map(([key, total]) => {
    const winCount = Math.floor(key / (stride * stride))
    const lossCount = Math.floor((key % (stride * stride)) / stride)
    const drawCount = key % stride
    return {
      wins: winCount, losses: lossCount, draws: drawCount,
      points: 3 * winCount + drawCount,
      appearances: total.appearances, qualifications: total.qualifications,
      rate: total.qualifications / total.appearances,
    }
  }).sort((a, b) => b.points - a.points || b.wins - a.wins || a.draws - b.draws)
  return { input, rows, completed: iterations }
}

export function findRecord(result: SimulationResult, wins: number, losses: number, draws: number): SimulationRow | undefined {
  return result.rows.find(row => row.wins === wins && row.losses === losses && row.draws === draws)
}
