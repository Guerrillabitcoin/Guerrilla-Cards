import type { GameState } from './types';
import * as Engine from './game';

/** True when vote mode has exactly 2 human players (special 2p scoring). */
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

export function votesFor(state: GameState, playerId: string): number {
  const votes = state.votes ?? {};
  return Object.values(votes).filter((id) => id === playerId).length;
}

/**
 * 2-player vote finish: each gets +votesReceived (not annul).
 * Split ties keep roundWinnerIds; roundWinnerId falls back to host for advance.
 * Solo is never routed here.
 */
function finishTwoPlayerVotes(
  state: GameState,
  votes: Record<string, string>
): GameState {
  const eligible = state.submissions
    .filter((s) => !s.rival)
    .map((s) => s.playerId);
  const tallies: Record<string, number> = {};
  for (const id of eligible) tallies[id] = 0;
  for (const target of Object.values(votes)) {
    tallies[target] = (tallies[target] ?? 0) + 1;
  }
  const players = state.players.map((p) =>
    p.id in tallies ? { ...p, score: p.score + (tallies[p.id] ?? 0) } : p
  );
  const hitTarget = players.some((p) => p.score >= state.targetScore);
  const best = Math.max(0, ...Object.values(tallies));
  const winners = eligible.filter(
    (id) => (tallies[id] ?? 0) === best && best > 0
  );
  const isSplit = winners.length > 1;
  const hostId =
    state.players.find((p) => p.isHost)?.id ?? eligible[0] ?? null;
  return {
    ...state,
    players,
    votes,
    roundWinnerId: isSplit ? hostId : winners[0] ?? hostId,
    roundWinnerIds: isSplit ? winners : [],
    phase: hitTarget ? 'results' : 'reveal',
    activeSeatId: hitTarget ? null : hostId,
    updatedAt: Date.now(),
  };
}

/**
 * After room merge: if all votes are in, finalize.
 * - 2p: special scoring (unchanged).
 * - >2p: Engine.tallyVotesIfComplete (annuls ties).
 * Prevents hang when the last vote arrived via sync rather than local castVote.
 */
export function resolveVotesIfComplete(state: GameState): GameState {
  if ((state.judgeMode ?? 'zar') !== 'vote' || state.mode === 'solo') {
    return state;
  }
  if (state.phase !== 'judging') return state;
  const votes = state.votes ?? {};
  const eligible = state.submissions
    .filter((s) => !s.rival)
    .map((s) => s.playerId);
  if (!eligible.length || !eligible.every((id) => !!votes[id])) return state;

  if (twoPlayerVote(state)) {
    return finishTwoPlayerVotes(state, votes);
  }
  return Engine.tallyVotesIfComplete({ ...state, votes });
}

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
  if (
    !state.submissions.some(
      (s) => s.playerId === submissionPlayerId && !s.rival
    )
  ) {
    throw new Error('Esa jugada no existe.');
  }
  const prev = state.votes ?? {};
  if (prev[voterId]) throw new Error('Ya has votado esta ronda.');

  const votes = { ...prev, [voterId]: submissionPlayerId };
  const eligible = state.submissions
    .filter((s) => !s.rival)
    .map((s) => s.playerId);
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
  return finishTwoPlayerVotes(state, votes);
}

/** 2p vote UI may show own answer among options. */
export function showOwnAnswerWhenVoting(state: GameState): boolean {
  return twoPlayerVote(state);
}
