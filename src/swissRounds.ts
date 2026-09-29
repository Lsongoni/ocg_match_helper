/** Generic suggestion only. Replace this function when an event rule table is known. */
export function recommendedRounds(participants: number): number {
  return Math.max(1, Math.ceil(Math.log2(Math.max(2, participants))))
}
