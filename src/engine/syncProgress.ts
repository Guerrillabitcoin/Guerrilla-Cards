/**
 * Monotonic progress across rounds for online room sync.
 * reveal(r) < discarding(r) < submitting(r+1) so next-round pushes are forward,
 * not treated as a phase "downgrade" vs reveal.
 * Mirrored in api/room.js (serverless cannot import this module).
 */
export function gameProgress(
  state: { round?: number; phase?: string } | null | undefined
): number {
  if (!state) return 0;
  const round = Number(state.round) || 0;
  switch (state.phase) {
    case 'lobby':
      return round * 10 + 0;
    case 'submitting':
      return round * 10 + 1;
    case 'judging':
      return round * 10 + 2;
    case 'reveal':
      return round * 10 + 3;
    case 'discarding':
      return round * 10 + 4;
    case 'results':
      return round * 10 + 9;
    default:
      return round * 10;
  }
}
