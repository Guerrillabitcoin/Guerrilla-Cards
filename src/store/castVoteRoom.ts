import { coerceGameState, type GameState } from '../engine/types';

export async function castVoteRoom(
  code: string,
  voterId: string,
  targetId: string
): Promise<{ ok: boolean; state?: GameState }> {
  const raw = String(code || '').trim().toUpperCase();
  if (!raw || !voterId || !targetId) return { ok: false };
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
    const data = (await res.json()) as { ok?: boolean; state?: unknown };
    if (!data.ok || !data.state) return { ok: false };
    return { ok: true, state: coerceGameState(data.state) };
  } catch {
    return { ok: false };
  }
}
