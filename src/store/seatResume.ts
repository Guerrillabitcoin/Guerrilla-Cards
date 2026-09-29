import type { GameState } from '../engine/types';
import { submissionsForRound } from '../engine/game';

export type SeatPending =
  | { kind: 'submit'; label: string }
  | { kind: 'vote'; label: string }
  | { kind: 'discard'; label: string }
  | { kind: 'ready'; label: string }
  | { kind: 'none'; label: string };

/** What this seat still owes on the live server board (for recovery banner). */
export function pendingActionForSeat(
  state: GameState | null | undefined,
  seatId: string | null | undefined
): SeatPending {
  if (!state || !seatId) return { kind: 'none', label: '' };
  const me = state.players.find((p) => p.id === seatId);
  if (!me || me.isBot) return { kind: 'none', label: '' };

  if (state.phase === 'discarding') {
    const done = (state.discardDonePlayerIds ?? []).includes(seatId);
    return done
      ? { kind: 'none', label: '' }
      : {
          kind: 'discard',
          label: 'Recuperación: te falta el descarte — elige cartas y confirma.',
        };
  }

  if (state.phase === 'submitting') {
    const voteMode = (state.judgeMode ?? 'zar') === 'vote';
    const zarId = state.players[state.zarIndex]?.id;
    if (!voteMode && seatId === zarId) {
      return {
        kind: 'ready',
        label: 'Eres el Comandante esta ronda — espera a que contesten los demás.',
      };
    }
    const has = submissionsForRound(state).some(
      (s) => s.playerId === seatId && !s.rival
    );
    return has
      ? { kind: 'none', label: '' }
      : {
          kind: 'submit',
          label: 'Recuperación: te falta enviar tu respuesta — toca cartas y envía.',
        };
  }

  if (state.phase === 'judging') {
    const voteMode = (state.judgeMode ?? 'zar') === 'vote';
    if (!voteMode) {
      const zarId = state.players[state.zarIndex]?.id;
      if (seatId === zarId) {
        return {
          kind: 'ready',
          label: 'Te toca juzgar — elige la mejor respuesta.',
        };
      }
      return { kind: 'none', label: '' };
    }
    // Vote: only humans who submitted must vote
    const submitted = submissionsForRound(state).some(
      (s) => s.playerId === seatId && !s.rival
    );
    if (!submitted) return { kind: 'none', label: '' };
    const voted = !!(state.votes && state.votes[seatId]);
    return voted
      ? { kind: 'none', label: '' }
      : {
          kind: 'vote',
          label: 'Recuperación: te falta votar — elige una opción.',
        };
  }

  if (state.phase === 'results') {
    const ready = (state.restartReadyIds ?? []).includes(seatId);
    return ready
      ? { kind: 'none', label: '' }
      : {
          kind: 'ready',
          label: 'Pulsa Listo si quieres otra manga.',
        };
  }

  return { kind: 'none', label: '' };
}
