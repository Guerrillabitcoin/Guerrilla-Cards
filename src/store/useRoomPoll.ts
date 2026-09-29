import { useEffect } from 'react';
import type { GameState, Phase } from '../engine/types';
import { pollMs } from './pollMs';
import { pullRoom } from './roomSync';

function tabVisible(): boolean {
  if (typeof document === 'undefined') return true;
  return document.visibilityState !== 'hidden';
}

/** Poll room KV only while the tab is visible. Rhythm from pollMs(phase). */
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
    let id: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      if (cancelled) return;
      if (!tabVisible()) return;
      const res = await pullRoom(code);
      if (cancelled || !res.ok) return;
      applyRemoteGame(res.state);
    };

    const start = () => {
      if (cancelled || id != null) return;
      void tick();
      id = setInterval(tick, pollMs(phase));
    };

    const stop = () => {
      if (id != null) {
        clearInterval(id);
        id = null;
      }
    };

    const onVis = () => {
      if (tabVisible()) start();
      else stop();
    };

    if (tabVisible()) start();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVis);
    }

    return () => {
      cancelled = true;
      stop();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVis);
      }
    };
  }, [ready, code, enabled, phase, applyRemoteGame]);
}
