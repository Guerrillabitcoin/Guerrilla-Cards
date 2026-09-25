import type { GameState } from './types';
import { MAX_PLAYERS, MIN_PLAYERS } from './types';
import * as Engine from './game';
import {
  bumpLeagueDeal,
  leagueFromState,
  leagueMatchCountOf,
  mergeLeague,
  writeLeague,
} from '../store/leagueSession';

function capOf(state: GameState): number {
  return Math.max(
    MIN_PLAYERS,
    Math.min(MAX_PLAYERS, state.maxPlayers ?? MAX_PLAYERS)
  );
}

export function withSeatCap(state: GameState, n: number): GameState {
  const cap = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, Math.floor(n)));
  return {
    ...state,
    maxPlayers: cap,
    judgeMode: cap === 2 ? 'vote' : state.judgeMode,
    updatedAt: Date.now(),
  };
}

export function addPlayerFlexible(state: GameState, nickname: string): GameState {
  const cap = capOf(state);
  if (state.phase !== 'lobby') throw new Error('La partida ya empezó.');
  if (state.players.length >= cap) {
    throw new Error(`Sala llena (${cap}).`);
  }
  const next = Engine.addPlayer({ ...state, mode: 'live' }, nickname);
  return { ...next, mode: state.mode, maxPlayers: cap };
}

export function startFlexible(state: GameState): GameState {
  if (state.mode === 'solo') {
    return Engine.startGame(state);
  }
  const cap = capOf(state);
  if (state.players.length < MIN_PLAYERS) {
    throw new Error(`Haz falta al menos ${MIN_PLAYERS} jugadores.`);
  }
  if (state.players.length > cap) {
    throw new Error(`Máximo ${cap} jugadores.`);
  }
  let next = state;
  if (next.players.length === 2 || cap === 2) {
    next = { ...next, judgeMode: 'vote', maxPlayers: cap === 2 ? 2 : next.maxPlayers };
  }
  const started = Engine.startGame({ ...next, mode: 'live' });
  return { ...started, mode: next.mode, maxPlayers: cap, judgeMode: next.judgeMode };
}

export function restartFlexible(
  state: GameState,
  opts?: { avoidPromptIds?: string[]; avoidAnswerIds?: string[] }
): GameState {
  const mode = state.mode;
  const cap = capOf(state);
  const judgeMode = state.judgeMode;
  let src = {
    ...state,
    leagueScores: leagueFromState(state),
  };
  if (src.phase === 'results' && src.mode !== 'solo') {
    const humans = src.players.filter((x) => !x.isBot);
    const top = [...humans].sort((a, b) => b.score - a.score)[0];
    if (top) src = Engine.awardLeagueWin(src, top.id);
  }
  const kept = mergeLeague(src.leagueScores);
  const matches = leagueMatchCountOf(src);
  writeLeague(state.code, kept);
  const started = Engine.restartMatch(
    { ...src, mode: mode === 'async' ? 'live' : mode, leagueScores: kept },
    opts
  );
  const leagueScores = mergeLeague(kept, started.leagueScores);
  writeLeague(state.code, leagueScores);
  bumpLeagueDeal(state.code);
  return {
    ...started,
    mode,
    maxPlayers: cap,
    judgeMode,
    currentPrompt: started.currentPrompt,
    leagueScores,
    leagueMatchCount: matches,
    leagueAwarded: false,
    restartReadyIds: [],
  };
}
