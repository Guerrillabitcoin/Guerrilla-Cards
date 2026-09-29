import type { Phase } from '../engine/types';

/** Do not go below 1000 judging / 2000 submitting (sync). */
export function pollMs(phase?: Phase | string | null): number {
  if (phase === 'judging') return 1000;
  if (phase === 'submitting') return 2000;
  if (phase === 'discarding') return 2000; // detect peer discard sooner
  if (phase === 'reveal') return 2000; // pick up next-round advance
  if (phase === 'lobby') return 3000;
  return 4000; // results, idle
}
