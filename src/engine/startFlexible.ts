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
  const humans = state.players.filter((p) => !p.isBot);
  if (humans.length >= cap) {
    throw new Error(`Sala llena (${cap}).`);
  }
  if (state.players.length >= MAX_PLAYERS) {
    throw new Error(`Máximo ${MAX_PLAYERS} (humanos + bots).`);
  }
  const next = Engine.addPlayer({ ...state, mode: 'live' }, nickname);
  return { ...next, mode: state.mode, maxPlayers: cap };
}

export function startFlexible(state: GameState): GameState {
  if (state.mode === 'solo') {
    return Engine.startGame(state);
  }
  const cap = capOf(state);
  const humans = state.players.filter((p) => !p.isBot);
  if (humans.length < MIN_PLAYERS) {
    throw new Error(`Haz falta al menos ${MIN_PLAYERS} jugadores humanos.`);
  }
  // Start when human roster is full (bots do not advance Empezar)
  if (humans.length < cap) {
    throw new Error(`Faltan jugadores: ${humans.length}/${cap}.`);
  }
  if (state.players.length > MAX_PLAYERS) {
    throw new Error(`Máximo ${MAX_PLAYERS} (humanos + bots).`);
  }
  let next = state;
  if (humans.length === 2 || cap === 2) {
    next = { ...next, judgeMode: 'vote', maxPlayers: cap === 2 ? 2 : next.maxPlayers };
  }
  const started = Engine.startGame({ ...next, mode: 'live' });
  // Host path: fill bot answers immediately
  const withBots = Engine.autoSubmitBots(started);
  return {
    ...withBots,
    mode: next.mode,
    maxPlayers: cap,
    judgeMode: next.judgeMode,
  };
}

export function restartFlexible(
  state: GameState,
  opts?: { avoidPromptIds?: string[]; avoidAnswerIds?: string[] }
): GameState {
  const mode = state.mode;
  const cap = capOf(state);
  const judgeMode = state.judgeMode;
  let src: GameState = {
    ...state,
    leagueScores: leagueFromState(state),
  };
  const top = [...src.players].sort(
    (a, b) => (b.score || 0) - (a.score || 0)
  )[0];
  if (src.phase === 'results' && src.mode !== 'solo' && top) {
    src = Engine.awardLeagueWin(src, top.id);
  }
  // Prefer human for zar seat (bots never Zar); beginRound also enforces
  const humans = src.players.filter((x) => !x.isBot);
  const zarSeat =
    (top && !top.isBot ? top : null) ||
    [...humans].sort((a, b) => (b.score || 0) - (a.score || 0))[0] ||
    humans[0];
  const zarIndex = Math.max(
    0,
    src.players.findIndex((p) => zarSeat && p.id === zarSeat.id)
  );
  const kept = mergeLeague(src.leagueScores);
  const matches = leagueMatchCountOf(src);
  writeLeague(state.code, kept);
  const started = Engine.restartMatch(
    {
      ...src,
      zarIndex,
      mode: mode === 'async' ? 'live' : mode,
      leagueScores: kept,
    },
    opts
  );
  const leagueScores = mergeLeague(kept, started.leagueScores);
  writeLeague(state.code, leagueScores);
  bumpLeagueDeal(state.code);
  const dealt = Engine.autoSubmitBots({
    ...started,
    mode,
    maxPlayers: cap,
    judgeMode,
    zarIndex,
    currentPrompt: started.currentPrompt,
    leagueScores,
    leagueMatchCount: matches,
    leagueAwarded: false,
    restartReadyIds: [],
  });
  return dealt;
}
