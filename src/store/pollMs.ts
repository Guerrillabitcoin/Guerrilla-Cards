import type { Phase } from '../engine/types';

/** Lobby/reveal/play: 2.5s. Judging needs faster roster. */
export function pollMs(phase?: Phase | string | null): number {
  return phase === 'judging' ? 1000 : 2500;
}
