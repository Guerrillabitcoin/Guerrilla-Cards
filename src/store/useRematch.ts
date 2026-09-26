import { useCallback, useRef } from 'react';
import type { GameState } from '../engine/types';
import { rematchRoom } from './rematchRoom';

/** Online rematch: server resets; ONLY host deals prompt + pushRoom. */
export function useRematch({
  code,
  actorId,
  matchCount,
  isHost,
  applyRemoteGame,
  restartSameSetup,
}: {
  code: string;
  actorId: string | null;
  matchCount: number;
  isHost: boolean;
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
    if (!isHost) return awarded.ok ? awarded.state : null;
    return restartSameSetup(code);
  }, [code, actorId, matchCount, isHost, applyRemoteGame, restartSameSetup]);

  return { runRematch: run };
}
