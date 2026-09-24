import type { GameState } from './types';

function isVoteMode(state: GameState): boolean {
  return (state.judgeMode ?? 'zar') === 'vote';
}

function isIndexPerm(order: unknown, n: number): order is number[] {
  if (!Array.isArray(order) || !n || order.length !== n) return false;
  const nums = order.map((x) => Number(x));
  return (
    nums.every((i) => Number.isInteger(i) && i >= 0 && i < n) &&
    new Set(nums).size === n
  );
}

/**
 * Drop leftover answers from past rounds and freeze the Zar board.
 * Never reshuffle a live judging list — that swapped Opción 1/2 on every poll.
 */
export function ensureRevealOrder(state: GameState): GameState {
  const round = state.round ?? 0;
  const voteMode = isVoteMode(state);
  const zar = state.players[state.zarIndex] ?? state.players[0];
  let subs = (state.submissions ?? []).filter(
    (s) => !s.rival && (s.round == null || s.round === round)
  );
  if (
    !voteMode &&
    zar?.id &&
    (state.phase === 'judging' || state.phase === 'reveal')
  ) {
    subs = subs.filter((s) => s.playerId !== zar.id);
  }
  subs = [...subs].sort((a, b) =>
    String(a.playerId).localeCompare(String(b.playerId))
  );
  const n = subs.length;
  const order = isIndexPerm(state.revealOrder, n)
    ? state.revealOrder.map((i) => Number(i))
    : [...Array(n).keys()];
  const sameSubs =
    subs.length === (state.submissions?.length ?? 0) &&
    subs.every((s, i) => s.playerId === state.submissions[i]?.playerId);
  const sameOrder =
    order.length === (state.revealOrder?.length ?? 0) &&
    order.every((v, i) => v === state.revealOrder[i]);
  if (sameSubs && sameOrder) return state;
  return { ...state, submissions: subs, revealOrder: order };
}
