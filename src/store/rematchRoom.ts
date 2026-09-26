import { Platform } from 'react-native';
import { coerceGameState, type GameState } from '../engine/types';

export async function rematchRoom(
  code: string,
  actorId: string | null
): Promise<{ ok: true; state: GameState } | { ok: false; error: string }> {
  if (Platform.OS !== 'web') return { ok: false, error: 'not_web' };
  const room = String(code || '').trim().toUpperCase();
  if (room.length < 3) return { ok: false, error: 'bad_code' };
  try {
    const res = await fetch('/api/room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'rematch',
        code: room,
        actorId: actorId || undefined,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      state?: GameState;
    };
    if (!res.ok || !data.ok || !data.state) {
      return { ok: false, error: data.error || `http_${res.status}` };
    }
    return { ok: true, state: coerceGameState(data.state) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network_error' };
  }
}
