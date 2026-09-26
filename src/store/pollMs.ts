import type { Phase } from '../engine/types';

export function pollMs(phase?: Phase | string | null): number {
  return phase === 'judging' ? 1000 : 2000;
}
