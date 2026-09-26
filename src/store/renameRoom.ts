import { Platform } from 'react-native';
import { coerceGameState, type GameState } from '../engine/types';

export async function renameRoom(
  code: string,
  playerId: string,
  nickname: string
): Promise<{ ok: true; state: GameState } | { ok: false; error: string }> {
  if (Platform.OS !== 'web') return { ok: false, error: 'not_web' };
  const name = String(nickname || '').trim();
  const id = String(playerId || '').trim();
  const room = String(code || '').trim().toUpperCase();
  if (!name || !id || room.length < 3) return { ok: false, error: 'bad_nick' };
  try {
    const res = await fetch('/api/room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'rename',
        code: room,
        playerId: id,
        nickname: name,
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
