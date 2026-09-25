import type { GameState } from '../engine/types';
import { gameProgress } from '../engine/syncProgress';

/**
 * Fin de partida: cualquier asiento (2–8) debe aceptar results.
 * Solo se ignora si ese dispositivo ya está en results o ya arrancó Otra manga.
 */
export function incomingMatchOver(
  remote: GameState,
  local?: GameState | null
): boolean {
  if (!remote || remote.phase !== 'results') return false;
  if (!local) return true;
  if (local.phase === 'results' || local.phase === 'lobby') return false;
  const rematchStarted =
    (local.phase === 'submitting' || local.phase === 'discarding') &&
    (local.round ?? 0) <= 1 &&
    (local.updatedAt ?? 0) > (remote.updatedAt ?? 0);
  return !rematchStarted;
}

export function dropStaleRemote(
  local: GameState | undefined,
  remote: GameState
): boolean {
  if (!local) return false;
  if (incomingMatchOver(remote, local)) return false;
  const rematch =
    local.phase === 'results' &&
    remote.phase !== 'results' &&
    (remote.updatedAt ?? 0) >= (local.updatedAt ?? 0);
  if (rematch) return false;
  const richerLobby =
    local.phase === 'lobby' &&
    remote.phase === 'lobby' &&
    (remote.players?.length ?? 0) > (local.players?.length ?? 0);
  if (richerLobby) return false;
  return gameProgress(local) > gameProgress(remote);
}
