export interface TournamentFormat {
  swissRounds: number
  topCut: number
}

/** No automatic recommendation exists for fewer than eight participants. */
export function getTournamentFormat(participantCount: number): TournamentFormat | null {
  if (!Number.isSafeInteger(participantCount) || participantCount < 8) return null
  if (participantCount === 8) return { swissRounds: 3, topCut: 4 }
  if (participantCount <= 16) return { swissRounds: 4, topCut: 4 }
  if (participantCount <= 32) return { swissRounds: 4, topCut: 8 }
  if (participantCount <= 48) return { swissRounds: 5, topCut: 8 }
  if (participantCount <= 64) return { swissRounds: 6, topCut: 8 }
  if (participantCount <= 128) return { swissRounds: 6, topCut: 16 }
  return { swissRounds: 7, topCut: 16 }
}
