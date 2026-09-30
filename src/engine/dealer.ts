/**
 * Single dealer (online rooms): only the host deals / advances rounds
 * (reveal → next round, discard → next round). If the host is away, ONE
 * designated fallback seat may deal after a grace period. Mirrored on the
 * server in api/dealer.js.
 */
import type { GameState } from './types';

export const HOST_GRACE_MS = 10_000;

/** Next Comandante if human, else the first non-host human seat. */
export function fallbackDealerId(state: GameState): string | null {
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const w = state.roundWinnerId ? byId.get(state.roundWinnerId) : undefined;
  if (state.phase === 'reveal' && w && !w.isBot && !w.isHost) return w.id;
  const guest = state.players.find((p) => !p.isBot && !p.isHost);
  return guest?.id ?? null;
}

export function mayDeal(state: GameState, seatId: string | null | undefined): boolean {
  if (state.mode !== 'async') return true;
  const host = state.players.find((p) => p.isHost);
  if (!host || (seatId && host.id === seatId)) return true;
  if (!seatId || fallbackDealerId(state) !== seatId) return false;
  const now = Date.now();
  if (state.phase === 'reveal') {
    const base = state.revealEndsAt || state.updatedAt || 0;
    return now > base + HOST_GRACE_MS;
  }
  if (state.phase === 'discarding') {
    return now > (state.updatedAt || 0) + HOST_GRACE_MS + 5_000;
  }
  return true;
}
