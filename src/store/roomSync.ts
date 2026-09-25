/**
 * Cross-device async room sync via /api/room (Vercel KV).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { coerceGameState, type GameState, type Submission } from '../engine/types';
import { resolveVotesIfComplete } from '../engine/vote2p';
export { gameProgress } from '../engine/syncProgress';

const SEAT_KEY = (code: string) => `guerrilla_seat_${code.trim().toUpperCase()}`;
const ONLINE_KEY = (code: string) =>
  `guerrilla_online_${code.trim().toUpperCase()}`;

const seatCache: Record<string, string> = {};

function roomApiUrl(query?: string): string | null {
  if (Platform.OS !== 'web') return null;
  return query ? `/api/room?${query}` : '/api/room';
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export function isRedactedCardText(text: string | undefined | null): boolean {
  if (text == null) return true;
  const t = String(text).trim();
  return t === '' || t === '…' || t === '...';
}

function redactSubmission(sub: Submission): Submission {
  return {
    ...sub,
    cards: sub.cards.map((c) => ({ ...c, text: '…' })),
  };
}

function shouldRedactSubmissionTexts(phase: GameState['phase']): boolean {
  return phase === 'submitting' || phase === 'lobby' || phase === 'discarding';
}

export function slimForRoom(
  state: GameState,
  myPlayerId?: string | null
): GameState {
  let submissions = state.submissions;
  if (shouldRedactSubmissionTexts(state.phase)) {
    submissions = state.submissions.map((s) => {
      if (myPlayerId && s.playerId === myPlayerId) return s;
      return redactSubmission(s);
    });
  }
  const publishAllHands =
    state.phase === 'lobby' ||
    (state.phase === 'submitting' && (state.submissions?.length ?? 0) === 0);
  const players =
    !myPlayerId || publishAllHands
      ? state.players
      : state.players.map((p) => (p.id === myPlayerId ? p : { ...p, hand: [] }));
  return { ...state, players, submissions, promptDeck: [], answerDeck: [] };
}

export function mergeHandsPreserveLocal(
  remote: GameState,
  local: GameState | null | undefined,
  myPlayerId?: string | null
): GameState {
  if (!local?.players?.length) return resolveVotesIfComplete(remote);
  const localById = new Map(local.players.map((p) => [p.id, p]));
  const players = remote.players.map((rp) => {
    const lp = localById.get(rp.id);
    if (myPlayerId && rp.id === myPlayerId) {
      if (
        local.phase === 'discarding' &&
        (local.discardDonePlayerIds ?? []).includes(myPlayerId) &&
        lp &&
        lp.hand.length > 0
      ) {
        return { ...rp, hand: lp.hand };
      }
      if ((!rp.hand || rp.hand.length === 0) && lp && lp.hand.length > 0) {
        return { ...rp, hand: lp.hand };
      }
      return rp;
    }
    if (rp.hand && rp.hand.length > 0) {
      /* keep rp */
    } else if (lp && lp.hand.length > 0) {
      rp = { ...rp, hand: lp.hand };
    }
    const rematchIncoming =
      (remote.round ?? 0) <= 1 &&
      (remote.phase === 'submitting' || remote.phase === 'discarding') &&
      (local.phase === 'results' || (local.round ?? 0) > 1);
    if (lp && !rematchIncoming) {
      const score = Math.max(Number(rp.score) || 0, Number(lp.score) || 0);
      if (score !== (Number(rp.score) || 0)) rp = { ...rp, score };
    }
    return rp;
  });
  let submissions = remote.submissions ?? [];
  const remoteRound = remote.round;
  submissions = submissions.filter((s) => s.round == null || s.round === remoteRound);
  if (
    myPlayerId &&
    shouldRedactSubmissionTexts(remote.phase) &&
    local.phase === remote.phase &&
    local.phase === 'submitting' &&
    local.submissions?.length &&
    (local.round ?? 0) === (remote.round ?? 0) &&
    (local.currentPrompt?.id ?? null) === (remote.currentPrompt?.id ?? null)
  ) {
    const localSub = local.submissions.find(
      (s) => s.playerId === myPlayerId && !s.rival && (s.round == null || s.round === remoteRound)
    );
    if (localSub && localSub.cards.some((c) => !isRedactedCardText(c.text))) {
      submissions = submissions.map((s) => {
        if (s.playerId !== myPlayerId) return s;
        const remoteRedacted = s.cards.every((c) => isRedactedCardText(c.text));
        return remoteRedacted ? { ...localSub, round: remoteRound } : s;
      });
      if (!submissions.some((s) => s.playerId === myPlayerId)) {
        submissions = [...submissions, { ...localSub, round: remoteRound }];
      }
    }
  }

  let votes = { ...(remote.votes ?? {}) };
  if (
    local &&
    (local.round ?? 0) === (remote.round ?? 0) &&
    (local.currentPrompt?.id ?? null) === (remote.currentPrompt?.id ?? null) &&
    (local.phase === 'judging' ||
      remote.phase === 'judging' ||
      Object.keys(local.votes ?? {}).length > 0 ||
      Object.keys(remote.votes ?? {}).length > 0)
  ) {
    votes = { ...(local.votes ?? {}), ...(remote.votes ?? {}) };
  }

  if (
    local &&
    remote.phase === 'submitting' &&
    local.phase === 'submitting' &&
    (local.round ?? 0) === (remote.round ?? 0) &&
    (local.currentPrompt?.id ?? null) === (remote.currentPrompt?.id ?? null)
  ) {
    const byId = new Map<string, Submission>();
    for (const s of [...(local.submissions ?? []), ...submissions]) {
      if (!s?.playerId || s.rival) continue;
      if (s.round != null && s.round !== remoteRound) continue;
      const prev = byId.get(s.playerId);
      if (!prev) {
        byId.set(s.playerId, s);
        continue;
      }
      const sReal = s.cards.some((c) => !isRedactedCardText(c.text));
      const pReal = prev.cards.some((c) => !isRedactedCardText(c.text));
      byId.set(s.playerId, sReal || !pReal ? s : prev);
    }
    submissions = Array.from(byId.values());
  }

  return resolveVotesIfComplete({ ...remote, players, submissions, votes });
}

export function hasRicherVotes(
  a: GameState | null | undefined,
  b: GameState | null | undefined
): boolean {
  const av = a?.votes ?? {};
  const bv = b?.votes ?? {};
  const aKeys = Object.keys(av);
  if (aKeys.length <= Object.keys(bv).length) {
    return aKeys.some((k) => av[k] && !bv[k]);
  }
  return aKeys.some((k) => av[k] && !bv[k]) || aKeys.length > Object.keys(bv).length;
}

export type PushResult =
  | { ok: true; skipped?: false }
  | { ok: true; skipped: true; state: GameState }
  | { ok: false; error: string; status?: number };

export type PullResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string; status?: number };

export async function pushRoom(
  state: GameState,
  myPlayerId?: string | null
): Promise<PushResult> {
  const url = roomApiUrl();
  if (!url) return { ok: false, error: 'not_web' };
  try {
    const body = JSON.stringify({
      action: 'upsert',
      code: state.code,
      state: slimForRoom(state, myPlayerId),
    });
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      skipped?: boolean;
      state?: GameState;
    };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || `http_${res.status}`, status: res.status };
    }
    if (data.skipped && data.state) {
      return { ok: true, skipped: true, state: coerceGameState(data.state) };
    }
    if (data.state) {
      return { ok: true, state: coerceGameState(data.state) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network_error' };
  }
}

export type JoinResult =
  | { ok: true; state: GameState; playerId: string }
  | { ok: false; error: string; status?: number };

export async function joinRoom(
  code: string,
  nickname?: string | null
): Promise<JoinResult> {
  const url = roomApiUrl();
  if (!url) return { ok: false, error: 'not_web' };
  const normalized = normalizeCode(code);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'join',
        code: normalized,
        nickname: nickname?.trim() || undefined,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      state?: GameState;
      playerId?: string;
    };
    if (!res.ok || !data.ok || !data.state || !data.playerId) {
      return { ok: false, error: data.error || `http_${res.status}`, status: res.status };
    }
    return { ok: true, state: coerceGameState(data.state), playerId: data.playerId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network_error' };
  }
}

export type OpenRoomRow = {
  code: string;
  players: string[];
  seated: number;
  maxPlayers: number;
  judgeMode: string;
  updatedAt: number;
};

export async function listOpenRooms(): Promise<
  { ok: true; rooms: OpenRoomRow[] } | { ok: false; error: string }
> {
  const url = roomApiUrl('list=1');
  if (!url) return { ok: false, error: 'not_web' };
  try {
    const res = await fetch(url);
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      rooms?: OpenRoomRow[];
    };
    if (!res.ok || !data.ok) return { ok: false, error: data.error || `http_${res.status}` };
    return { ok: true, rooms: data.rooms ?? [] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network_error' };
  }
}

export async function claimSeat(code: string, playerId: string): Promise<JoinResult> {
  const url = roomApiUrl();
  if (!url) return { ok: false, error: 'not_web' };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'claim', code: normalizeCode(code), playerId }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      state?: GameState;
      playerId?: string;
    };
    if (!res.ok || !data.ok || !data.state || !data.playerId) {
      return { ok: false, error: data.error || `http_${res.status}`, status: res.status };
    }
    return { ok: true, state: coerceGameState(data.state), playerId: data.playerId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network_error' };
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
    if (res.status === 404) return { ok: false, error: 'not_found', status: 404 };
    if (!res.ok || !data.ok || !data.state) {
      return { ok: false, error: data.error || `http_${res.status}`, status: res.status };
    }
    return { ok: true, state: coerceGameState(data.state) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network_error' };
  }
}

export function getMySeatSync(code: string): string | null {
  const key = normalizeCode(code);
  return seatCache[key] ?? null;
}

export async function getMySeat(code: string): Promise<string | null> {
  const key = normalizeCode(code);
  if (seatCache[key]) return seatCache[key];
  try {
    const id = await AsyncStorage.getItem(SEAT_KEY(code));
    if (id) seatCache[key] = id;
    return id;
  } catch {
    return null;
  }
}

export async function setMySeat(code: string, playerId: string): Promise<void> {
  const key = normalizeCode(code);
  seatCache[key] = playerId;
  try {
    await AsyncStorage.setItem(SEAT_KEY(code), playerId);
  } catch {
    /* ignore */
  }
}

export async function getOnlineFlag(code: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONLINE_KEY(code))) === '1';
  } catch {
    return false;
  }
}

export async function setOnlineFlag(code: string, online: boolean): Promise<void> {
  try {
    if (online) await AsyncStorage.setItem(ONLINE_KEY(code), '1');
    else await AsyncStorage.removeItem(ONLINE_KEY(code));
  } catch {
    /* ignore */
  }
}
