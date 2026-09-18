import type { GameState } from './types';
import * as Engine from './game';

export function isTwoPlayerVote(state: GameState): boolean {
  const humans = state.players.filter((p) => !p.isBot).length;
  return (
    (state.judgeMode ?? 'zar') === 'vote' &&
    state.mode !== 'solo' &&
    (state.maxPlayers === 2 || humans === 2)
  );
}

function twoPlayerVote(state: GameState): boolean {
  return isTwoPlayerVote(state);
}

/**
 * 1v1: you may vote your own answer. Each vote is +1 to that answer.
 * 2-0 → that player +2. 1-1 → each +1. No empate / no single-winner bonus.
 * 3+ keeps the old rule (no self-vote, majority +1).
 */
export function castVoteFlexible(
  state: GameState,
  voterId: string,
  submissionPlayerId: string
): GameState {
  if (!twoPlayerVote(state)) {
    return Engine.castVote(state, voterId, submissionPlayerId);
  }
  if (state.phase !== 'judging') throw new Error('No es fase de juicio.');
  state = Engine.ensureRevealOrder(state);
  if (!state.players.some((p) => p.id === voterId)) {
    throw new Error('Votante no encontrado.');
  }
  if (!state.submissions.some((s) => s.playerId === voterId && !s.rival)) {
    throw new Error('Solo quien envió respuesta puede votar.');
  }
  if (!state.submissions.some((s) => s.playerId === submissionPlayerId && !s.rival)) {
    throw new Error('Esa jugada no existe.');
  }
  const prev = state.votes ?? {};
  if (prev[voterId]) throw new Error('Ya has votado esta ronda.');

  const votes = { ...prev, [voterId]: submissionPlayerId };
  const eligible = state.submissions.filter((s) => !s.rival).map((s) => s.playerId);
  const pending = eligible.filter((id) => !votes[id]);

  if (pending.length) {
    const nextSeat =
      state.players.find((p) => pending.includes(p.id) && !p.isBot) ??
      state.players.find((p) => pending.includes(p.id));
    return {
      ...state,
      votes,
      activeSeatId: nextSeat?.id ?? state.activeSeatId,
      updatedAt: Date.now(),
    };
  }

  const tallies: Record<string, number> = {};
  for (const id of eligible) tallies[id] = 0;
  for (const target of Object.values(votes)) {
    tallies[target] = (tallies[target] ?? 0) + 1;
  }

  const players = state.players.map((p) =>
    p.id in tallies ? { ...p, score: p.score + (tallies[p.id] ?? 0) } : p
  );

  const hitTarget = players.some((p) => p.score >= state.targetScore);
  const hostId = state.players.find((p) => p.isHost)?.id ?? eligible[0] ?? null;

  return {
    ...state,
    players,
    votes,
    roundWinnerId: hostId,
    roundWinnerIds: [],
    phase: hitTarget ? 'results' : 'reveal',
    activeSeatId: hitTarget ? null : hostId,
    updatedAt: Date.now(),
  };
}

export function showOwnAnswerWhenVoting(state: GameState): boolean {
  return twoPlayerVote(state);
}

export function votesFor(state: GameState, playerId: string): number {
  const votes = state.votes ?? {};
  return Object.values(votes).filter((id) => id === playerId).length;
}
