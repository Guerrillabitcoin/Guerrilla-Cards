import { useEffect } from 'react';
import type { GameState, Phase } from '../engine/types';
import { pollMs } from './pollMs';
import { pullRoom } from './roomSync';

/** One poll loop. 1s in judging, 2.5s otherwise. */
export function useRoomPoll({
  ready,
  code,
  enabled,
  phase,
  applyRemoteGame,
}: {
  ready: boolean;
  code: string;
  enabled: boolean;
  phase?: Phase | string | null;
  applyRemoteGame: (state: GameState) => boolean;
}) {
  useEffect(() => {
    if (!ready || !code || !enabled) return;
    let cancelled = false;
    const tick = async () => {
      const res = await pullRoom(code);
      if (cancelled || !res.ok) return;
      applyRemoteGame(res.state);
    };
    void tick();
    const id = setInterval(tick, pollMs(phase));
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [ready, code, enabled, phase, applyRemoteGame]);
}
