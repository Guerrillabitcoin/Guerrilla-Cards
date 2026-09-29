import type { GameState } from '../engine/types';
import { gameProgress } from '../engine/syncProgress';

/** True while a rematch deal is live (round 1 submitting/discarding). */
export function rematchLive(g?: GameState | null): boolean {
  if (!g) return false;
  const r = Number(g.round) || 0;
  return (
    r <= 1 &&
    (g.phase === 'submitting' || g.phase === 'discarding')
  );
}

/** Fin de partida: aceptar results salvo si este dispositivo ya reinició. */
export function incomingMatchOver(
  remote: GameState,
  local?: GameState | null
): boolean {
  if (!remote || remote.phase !== 'results') return false;
  if (!local) return true;
  if (local.phase === 'results' || local.phase === 'lobby') return false;
  if (rematchLive(local)) return false;
  return true;
}

export function dropStaleRemote(
  local: GameState | undefined,
  remote: GameState
): boolean {
  if (!local) return false;
  // Live rematch must ignore leftover results (high gameProgress, old match).
  if (rematchLive(local) && remote.phase === 'results') return true;
  if (incomingMatchOver(remote, local)) return false;
  // Rematch after results: accept even if local liga award bumped updatedAt later.
  const rematch =
    local.phase === 'results' && rematchLive(remote);
  if (rematch) return false;
  const richerLobby =
    local.phase === 'lobby' &&
    remote.phase === 'lobby' &&
    (remote.players?.length ?? 0) > (local.players?.length ?? 0);
  if (richerLobby) return false;
  return gameProgress(local) > gameProgress(remote);
}
