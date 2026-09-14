/**
 * Cross-device async room sync via /api/room (Vercel KV).
 * MVP: full GameState in KV includes all hands — acceptable for now;
 * later: server-authoritative hands / fog of war.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { coerceGameState, type GameState } from '../engine/types';

const SEAT_KEY = (code: string) => `guerrilla_seat_${code.trim().toUpperCase()}`;
const ONLINE_KEY = (code: string) =>
  `guerrilla_online_${code.trim().toUpperCase()}`;

function roomApiUrl(query?: string): string | null {
  if (Platform.OS !== 'web') return null;
  return query ? `/api/room?${query}` : '/api/room';
}

/** Strip bulky decks before KV — receivers hydrate from packIds + hands. */
export function slimForRoom(state: GameState): GameState {
  return {
    ...state,
    promptDeck: [],
    answerDeck: [],
  };
}

export type PushResult =
  | { ok: true }
  | { ok: false; error: string; status?: number };

export type PullResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string; status?: number };

export async function pushRoom(state: GameState): Promise<PushResult> {
  const url = roomApiUrl();
  if (!url) return { ok: false, error: 'not_web' };
  try {
    const body = JSON.stringify({
      action: 'upsert',
      code: state.code,
      state: slimForRoom(state),
    });
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
    };
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        error: data.error || `http_${res.status}`,
        status: res.status,
      };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'network_error',
    };
  }
}

export async function pullRoom(code: string): Promise<PullResult> {
  const normalized = code.trim().toUpperCase();
  const url = roomApiUrl(`code=${encodeURIComponent(normalized)}`);
  if (!url) return { ok: false, error: 'not_web' };
  try {
    const res = await fetch(url);
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      state?: GameState;
    };
    if (res.status === 404) {
      return { ok: false, error: 'not_found', status: 404 };
    }
    if (!res.ok || !data.ok || !data.state) {
      return {
        ok: false,
        error: data.error || `http_${res.status}`,
        status: res.status,
      };
    }
    return { ok: true, state: coerceGameState(data.state) };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'network_error',
    };
  }
}

export async function getMySeat(code: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(SEAT_KEY(code));
  } catch {
    return null;
  }
}

export async function setMySeat(code: string, playerId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(SEAT_KEY(code), playerId);
  } catch {
    // ignore
  }
}

export async function getOnlineFlag(code: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONLINE_KEY(code))) === '1';
  } catch {
    return false;
  }
}

export async function setOnlineFlag(
  code: string,
  online: boolean
): Promise<void> {
  try {
    if (online) await AsyncStorage.setItem(ONLINE_KEY(code), '1');
    else await AsyncStorage.removeItem(ONLINE_KEY(code));
  } catch {
    // ignore
  }
}
