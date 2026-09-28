import type { GameState } from './types';
import { shuffle } from './deck';

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

function isPlayerIdPerm(
  order: unknown,
  playerIds: string[]
): boolean {
  if (!Array.isArray(order) || !playerIds.length) return false;
  if (order.length !== playerIds.length) return false;
  const ids = new Set(playerIds.map(String));
  if (ids.size !== playerIds.length) return false;
  const seen = new Set<string>();
  for (const x of order) {
    const id = String(x);
    if (!ids.has(id) || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}

/**
 * Drop leftover answers from past rounds and freeze the Zar board.
 * Never reshuffle or alphabetically re-sort a live judging list — that
 * swapped Opción 1/2 on every poll when revealOrder was index-based.
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
  // Keep existing submissions order (frozen). Do not localeCompare sort.
  const n = subs.length;
  const playerIds = subs.map((s) => s.playerId);
  const existing = state.revealOrder ?? [];
  let order: Array<number | string>;
  if (isPlayerIdPerm(existing, playerIds)) {
    order = existing.slice();
  } else if (isIndexPerm(existing, n)) {
    order = (existing as Array<number | string>).map((i) => Number(i));
  } else {
    order = shuffle([...playerIds]);
  }
  const sameSubs =
    subs.length === (state.submissions?.length ?? 0) &&
    subs.every((s, i) => s.playerId === state.submissions[i]?.playerId);
  const sameOrder =
    order.length === (state.revealOrder?.length ?? 0) &&
    order.every((v, i) => v === state.revealOrder[i]);
  if (sameSubs && sameOrder) return state;
  return { ...state, submissions: subs, revealOrder: order };
}
