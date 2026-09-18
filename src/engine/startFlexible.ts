import type { GameState } from './types';
import { MAX_PLAYERS, MIN_PLAYERS } from './types';
import * as Engine from './game';

/**
 * startGame() still requires exactly 4 in async mode.
 * Temporarily run the live start path (2–8), then keep mode async
 * so online room sync continues to work.
 */
export function startFlexible(state: GameState): GameState {
  if (state.mode === 'solo') {
    return Engine.startGame(state);
  }

  const cap = Math.max(
    MIN_PLAYERS,
    Math.min(MAX_PLAYERS, state.maxPlayers ?? MAX_PLAYERS)
  );
  if (state.players.length < MIN_PLAYERS) {
    throw new Error(`Haz falta al menos ${MIN_PLAYERS} jugadores.`);
  }
  if (state.players.length > cap) {
    throw new Error(`Máximo ${cap} jugadores.`);
  }

  let next = state;
  if (next.players.length === 2 && next.judgeMode !== 'vote') {
    next = { ...next, judgeMode: 'vote' };
  }

  const started = Engine.startGame({ ...next, mode: 'live' });
  return { ...started, mode: next.mode, maxPlayers: cap };
}
