import { useCallback, useRef } from 'react';
import type { GameState } from '../engine/types';
import { rematchRoom } from './rematchRoom';

export function useRematch({
  code,
  actorId,
  matchCount,
  applyRemoteGame,
  restartSameSetup,
}: {
  code: string;
  actorId: string | null;
  matchCount: number;
  applyRemoteGame: (state: GameState) => boolean;
  restartSameSetup: (code: string) => GameState | null;
}) {
  const once = useRef<string | null>(null);

  const run = useCallback(async () => {
    const stamp = `${code}:${matchCount}:dealt`;
    if (once.current === stamp) return null;
    once.current = stamp;
    const awarded = await rematchRoom(code, actorId);
    if (awarded.ok) applyRemoteGame(awarded.state);
    return restartSameSetup(code);
  }, [code, actorId, matchCount, applyRemoteGame, restartSameSetup]);

  return { runRematch: run };
}
