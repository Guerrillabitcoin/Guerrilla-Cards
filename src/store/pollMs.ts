import type { Phase } from '../engine/types';

/** Gameplay stays snappy (judging/reveal 1s, submitting/discard 2s). */
export function pollMs(phase?: Phase | string | null): number {
  if (phase === 'judging') return 1000;
  if (phase === 'submitting') return 2000;
  if (phase === 'discarding') return 2000; // detect peer discard sooner
  if (phase === 'reveal') return 1000; // pick up next-round advance fast
  if (phase === 'lobby') return 5000;
  return 6000; // results, idle
}

/** Lobby/results back off while nothing changes (max). Gameplay never backs off. */
export function pollMaxMs(phase?: Phase | string | null): number {
  if (phase === 'lobby') return 10000;
  if (phase === 'results') return 15000;
  return pollMs(phase);
}
