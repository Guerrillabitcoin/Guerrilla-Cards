import type { GameState } from './types';
import * as Engine from './game';

function twoPlayerVote(state: GameState): boolean {
  return (
    (state.judgeMode ?? 'zar') === 'vote' &&
    state.mode !== 'solo' &&
    state.players.filter((p) => !p.isBot).length === 2
  );
}

/**
 * 2 players: you may vote for your own answer. Each received vote is +1.
 * 2–0 → winner +2. 1–1 → both +1. 3+ players keep the old rule (no self-vote, +1).
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

  const best = Math.max(0, ...Object.values(tallies));
  const winners = Object.keys(tallies).filter((id) => tallies[id] === best && best > 0);
  const hitTarget = players.some((p) => p.score >= state.targetScore);

  return {
    ...state,
    players,
    votes,
    roundWinnerId: winners[0] ?? null,
    roundWinnerIds: winners.length > 1 ? winners : [],
    phase: hitTarget ? 'results' : 'reveal',
    activeSeatId: hitTarget ? null : state.activeSeatId,
    updatedAt: Date.now(),
  };
}

export function showOwnAnswerWhenVoting(state: GameState): boolean {
  return twoPlayerVote(state);
}
