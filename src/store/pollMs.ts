import type { Phase } from '../engine/types';

/** Do not go below 1000 judging / 2000 submitting (sync). */
export function pollMs(phase?: Phase | string | null): number {
  if (phase === 'judging') return 1000;
  if (phase === 'submitting') return 2000;
  if (phase === 'lobby') return 3000;
  return 4000; // reveal, results, discarding, idle
}
