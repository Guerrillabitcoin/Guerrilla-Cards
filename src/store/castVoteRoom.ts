import { coerceGameState, type GameState } from '../engine/types';

export async function castVoteRoom(
  code: string,
  voterId: string,
  targetId: string
): Promise<{ ok: boolean; state?: GameState }> {
  const raw = String(code || '').trim().toUpperCase();
  if (!raw || !voterId || !targetId) return { ok: false };
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 250 * 2 ** (attempt - 1)));
    }
    const out = await castVoteOnce(raw, voterId, targetId);
    if (out.retry) continue;
    return { ok: out.ok, state: out.state };
  }
  return { ok: false };
}

async function castVoteOnce(
  raw: string,
  voterId: string,
  targetId: string
): Promise<{ ok: boolean; state?: GameState; retry?: boolean }> {
  try {
    const res = await fetch('/api/room', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'vote',
        code: raw,
        voterId,
        targetId,
      }),
    });
    if (res.status >= 500) return { ok: false, retry: true };
    const data = (await res.json()) as { ok?: boolean; state?: unknown };
    if (!data.ok || !data.state) return { ok: false };
    const state = coerceGameState(data.state as GameState);
    // Server still judging but my ballot is not there → retry.
    if (state.phase === 'judging' && !state.votes?.[voterId]) {
      return { ok: false, state, retry: true };
    }
    return { ok: true, state };
  } catch {
    return { ok: false, retry: true };
  }
}
