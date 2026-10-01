import { useEffect } from 'react';
import type { GameState, Phase } from '../engine/types';
import { pollMaxMs, pollMs } from './pollMs';
import { pullRoom } from './roomSync';

function tabVisible(): boolean {
  if (typeof document === 'undefined') return true;
  return document.visibilityState !== 'hidden';
}

/** Poll room KV only while the tab is visible. Rhythm from pollMs(phase); lobby/results back off when idle. */
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
    let id: ReturnType<typeof setTimeout> | null = null;
    let running = false;
    const base = pollMs(phase);
    const max = pollMaxMs(phase);
    let delay = base;
    let lastStamp = '';

    const tick = async () => {
      id = null;
      if (cancelled) return;
      if (!tabVisible()) {
        running = false; // onVis restarts
        return;
      }
      const res = await pullRoom(code);
      if (cancelled) return;
      if (res.ok) {
        const st = res.state;
        const stamp = `${st.updatedAt ?? 0}|${st.phase}|${st.players?.length ?? 0}|${(st.restartReadyIds ?? []).length}`;
        // Idle backoff (lobby/results only): ×1.5 while unchanged, reset on change.
        delay = stamp === lastStamp ? Math.min(max, Math.round(delay * 1.5)) : base;
        lastStamp = stamp;
        applyRemoteGame(st);
      }
      if (!cancelled && running) id = setTimeout(tick, delay);
    };

    const start = () => {
      if (cancelled || running) return;
      running = true;
      delay = base;
      void tick();
    };

    const stop = () => {
      running = false;
      if (id != null) {
        clearTimeout(id);
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
