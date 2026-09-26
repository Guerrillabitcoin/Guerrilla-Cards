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

export function votesFor(state: GameState, playerId: string): number {
  const votes = state.votes ?? {};
  return Object.values(votes).filter((id) => id === playerId).length;
}

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
  const best = Math.max(0, ...Object.values(tallies));
  const winners = eligible.filter(
    (id) => (tallies[id] ?? 0) === best && best > 0
  );
  const isSplit = winners.length > 1;
  // Norma: exactamente +1 al ganador claro; empate 1–1 → 0 (no +votos).
  const winnerId = !isSplit ? winners[0] ?? null : null;
  const players = winnerId
    ? state.players.map((p) =>
        p.id === winnerId ? { ...p, score: p.score + 1 } : p
      )
    : state.players;
  const hitTarget = players.some((p) => p.score >= state.targetScore);
  const hostId =
    state.players.find((p) => p.isHost)?.id ?? eligible[0] ?? null;
  const base = {
    ...state,
    players,
    votes,
    roundWinnerId: isSplit ? null : winnerId ?? hostId,
    roundWinnerIds: isSplit ? winners : [],
    phase: (hitTarget ? 'results' : 'reveal') as GameState['phase'],
    activeSeatId: hitTarget ? null : hostId,
    updatedAt: Date.now(),
  };
  if (!hitTarget) return base;
  const humans = base.players.filter((x) => !x.isBot);
  const top = [...humans].sort((a, b) => b.score - a.score)[0];
  return Engine.awardLeagueWin(base, top?.id ?? null);
}

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

export function showOwnAnswerWhenVoting(state: GameState): boolean {
  return twoPlayerVote(state);
}
