/**
 * 最后一轮出轮判断。
 *
 * 只用当场手输的排名 + 已记录的战绩做一次性估算，不读取也不保存排名或小分。
 *
 * 建模前提（已与用户确认）：
 * - 大分由已记录的胜负平直接算出（胜×3 + 平×1），不需要手填，带平局的战绩是精确的。
 * - 全场平局率从自己的记录反推，因此 10 分、13 分这类不在 3 分阶梯上的分数也能定位。
 * - 别人是否约平不影响我的名次：分数比我高的人无论输赢都留在我上面，
 *   同分时小分高的仍在前面。
 * - 最后一轮按大分同组配对，对手与我同组；我赢则对手没赢，我平则对手也平。
 */

export type Verdict = 'safe' | 'border' | 'out'
export type ScenarioOutcome = 'win' | 'draw' | 'loss'

export interface LastRoundInput {
  participants: number
  /** 已打完的瑞士轮轮数，也就是你拿到这个排名时的轮次。 */
  roundsPlayed: number
  cutSize: number
  /** 第 roundsPlayed 轮结束后的总排名，从 1 开始。 */
  myRank: number
  /** 已记录的瑞士轮胜场。 */
  myWins: number
  /** 已记录的瑞士轮平局数。 */
  myDraws: number
}

export interface StandingScenario {
  outcome: ScenarioOutcome
  label: string
  /** 我按这个情形打完最后一轮后的大分。 */
  points: number
  /** 大分严格高于我的人数。 */
  above: number
  /** 大分与我相同、需要比小分的人数。 */
  tied: number
  /** 偏乐观名次：同分的人都排在我后面。 */
  best: number
  /** 估算名次：按我当前的小分位置折算同分顺序。 */
  expected: number
  /** 偏悲观名次：同分的人都排在我前面。 */
  worst: number
  verdict: Verdict
}

export interface StandingEstimate {
  myPoints: number
  myRank: number
  /** 我所在大分组的人数（含我）。 */
  groupSize: number
  /** 我在大分组内的位次，从 1 开始。 */
  positionInGroup: number
  participants: number
  cutSize: number
  /** 估算所用的全场平局率，取自自己的记录。 */
  drawRate: number
  scenarios: StandingScenario[]
}

export interface StandingProblem {
  error: string
}

export const isStandingProblem = (value: StandingEstimate | StandingProblem): value is StandingProblem => 'error' in value

export function verdictLabel(verdict: Verdict): string {
  return verdict === 'safe' ? '稳' : verdict === 'border' ? '看小分' : '没戏'
}

/** 大分：胜×3 + 平×1。 */
export function pointsOf(wins: number, draws: number): number {
  return 3 * wins + draws
}

type Field = Map<number, number>

function add(field: Field, points: number, count: number) {
  if (count <= 0) return
  field.set(points, (field.get(points) ?? 0) + count)
}

/** 同分内两两配对推进一轮：一半胜 +3，一半负 +0，平局的那部分双方各 +1。 */
export function advance(field: Field, drawRate = 0): Field {
  const next: Field = new Map()
  const rate = Math.min(.5, Math.max(0, drawRate))
  for (const [points, count] of field) {
    const draws = count * rate
    const decided = count - draws
    add(next, points + 3, decided / 2)
    add(next, points + 1, draws)
    add(next, points, decided / 2)
  }
  return next
}

/** 从零分起推 rounds 轮后的分数分布。 */
export function fieldLadder(participants: number, rounds: number, drawRate = 0): Field {
  let field: Field = new Map([[0, participants]])
  for (let round = 0; round < rounds; round += 1) field = advance(field, drawRate)
  return field
}

function total(field: Field): number {
  let sum = 0
  for (const count of field.values()) sum += count
  return sum
}

function scaleTo(field: Field, target: number): Field {
  const result: Field = new Map()
  const sum = total(field)
  if (sum <= 0 || target <= 0) return result
  for (const [points, count] of field) add(result, points, (count / sum) * target)
  return result
}

/** 用我自己的排名与战绩锚定全场，估算最后一轮赢/平/输三种情形的名次。 */
export function estimateLastRound(input: LastRoundInput): StandingEstimate | StandingProblem {
  const { participants, roundsPlayed, cutSize, myRank, myWins, myDraws } = input
  if (!Number.isSafeInteger(participants) || participants < 4) return { error: '参赛人数须为至少 4 人的整数。' }
  if (!Number.isSafeInteger(roundsPlayed) || roundsPlayed < 1) return { error: '请先记录至少一轮瑞士轮，再使用本判断。' }
  if (!Number.isSafeInteger(cutSize) || cutSize < 1 || cutSize > participants) return { error: '晋级人数须在参赛人数范围内。' }
  if (!Number.isSafeInteger(myRank) || myRank < 1 || myRank > participants) return { error: `排名须在 1 至 ${participants} 之间。` }
  if (!Number.isSafeInteger(myWins) || myWins < 0 || !Number.isSafeInteger(myDraws) || myDraws < 0) return { error: '战绩须为非负整数。' }
  if (myWins + myDraws > roundsPlayed) return { error: `胜场与平局数之和不能超过已打的 ${roundsPlayed} 轮。` }

  const myPoints = pointsOf(myWins, myDraws)
  // 自己的平局率就是全场平局率的最佳估计；它让 10 分、13 分这类分数在阶梯上有位置。
  const drawRate = Math.min(.5, myDraws / roundsPlayed)
  const ladder = fieldLadder(participants, roundsPlayed, drawRate)

  // 排名是小分的真值来源：模型给出分数分布，名次给出我在这份分布里的落点。
  let modelAbove = 0
  let groupFromLadder = 0
  for (const [points, count] of ladder) {
    if (points > myPoints) modelAbove += count
    else if (points === myPoints) groupFromLadder += count
  }
  const aheadTotal = myRank - 1
  const tiedAhead = Math.max(0, Math.min(aheadTotal - Math.round(modelAbove), Math.max(0, Math.round(groupFromLadder) - 1)))
  const groupSize = Math.max(1, Math.round(groupFromLadder))
  const positionInGroup = tiedAhead + 1

  // 最后一轮与我同组配对：我和对手都从本组拿掉，其余人照常推进一轮。
  const opponentPoints = groupSize >= 2 ? myPoints : Math.max(0, myPoints - 3)
  const others: Field = new Map()
  for (const [points, count] of ladder) {
    add(others, points, points === myPoints ? count - (groupSize >= 2 ? 2 : 1) : count)
  }
  const after = advance(scaleTo(others, Math.max(0, participants - 2)), drawRate)

  const tieRank = groupSize > 1 ? (positionInGroup - 1) / (groupSize - 1) : 0
  const scenarios = (['win', 'draw', 'loss'] as const).map(outcome => {
    const points = myPoints + (outcome === 'win' ? 3 : outcome === 'draw' ? 1 : 0)
    // 我赢则对手没赢，我输则对手赢，我平则对手也平。
    const rival = opponentPoints + (outcome === 'win' ? 0 : outcome === 'draw' ? 1 : 3)

    let above = 0
    let tied = 0
    for (const [value, count] of after) {
      if (value > points) above += count
      else if (value === points) tied += count
    }
    if (rival > points) above += 1
    else if (rival === points) tied += 1
    above = Math.round(above)
    tied = Math.round(tied)

    const best = above + 1
    const worst = above + 1 + tied
    const expected = above + 1 + Math.round(tieRank * tied)
    // 同分的人全排在我前面也仍在名额内，才算真的稳。
    const verdict: Verdict = worst <= cutSize ? 'safe' : expected > cutSize + 2 ? 'out' : 'border'
    return {
      outcome,
      label: outcome === 'win' ? '赢' : outcome === 'draw' ? '平' : '输',
      points, above, tied, best, expected, worst, verdict,
    }
  })

  return { myPoints, myRank, groupSize, positionInGroup, participants, cutSize, drawRate, scenarios }
}
