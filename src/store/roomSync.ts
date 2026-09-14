/**
 * Cross-device async room sync via /api/room (Vercel KV).
 * Sync: slimForRoom strips decks + early submission text; hands kept so deals reach all devices.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { coerceGameState, type GameState, type Submission } from '../engine/types';
export { gameProgress } from '../engine/syncProgress';

const SEAT_KEY = (code: string) => `guerrilla_seat_${code.trim().toUpperCase()}`;
const ONLINE_KEY = (code: string) =>
  `guerrilla_online_${code.trim().toUpperCase()}`;

/** In-memory seat cache for sync applyRemoteGame merges. */
const seatCache: Record<string, string> = {};

function roomApiUrl(query?: string): string | null {
  if (Platform.OS !== 'web') return null;
  return query ? `/api/room?${query}` : '/api/room';
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}


/** True when card text looks redacted for early-phase fog. */
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
  return (
    phase === 'submitting' || phase === 'lobby' || phase === 'discarding'
  );
}

/**
 * Strip bulky decks + redact early submission text before KV.
 * Hands are kept for all seats so a deal on the host reaches every device
 * (UI still only shows «Tu mano»). Submission text stays fogged until judging.
 */
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

  // Fresh submitting (no answers yet) or lobby: publish all hands (deals).
  // Mid-round: only own hand so we do not clobber peers with a stale snapshot.
  const publishAllHands =
    state.phase === 'lobby' ||
    ((state.phase === 'submitting' || state.phase === 'discarding') &&
      (state.submissions?.length ?? 0) === 0);

  const players =
    !myPlayerId || publishAllHands
      ? state.players
      : state.players.map((p) =>
          p.id === myPlayerId ? p : { ...p, hand: [] }
        );

  return {
    ...state,
    players,
    submissions,
    promptDeck: [],
    answerDeck: [],
  };
}

/**
 * After pull/hydrate: keep local hand when remote blanked ours;
 * for others prefer remote non-empty else local.
 */
export function mergeHandsPreserveLocal(
  remote: GameState,
  local: GameState | null | undefined,
  myPlayerId?: string | null
): GameState {
  if (!local?.players?.length) return remote;

  const localById = new Map(local.players.map((p) => [p.id, p]));
  const players = remote.players.map((rp) => {
    const lp = localById.get(rp.id);
    if (myPlayerId && rp.id === myPlayerId) {
      if ((!rp.hand || rp.hand.length === 0) && lp && lp.hand.length > 0) {
        return { ...rp, hand: lp.hand };
      }
      return rp;
    }
    if (rp.hand && rp.hand.length > 0) return rp;
    if (lp && lp.hand.length > 0) return { ...rp, hand: lp.hand };
    return rp;
  });

  // Preserve own submission real text when remote fog redacted it (early phase).
  // Same round + same prompt only; never pull prior-round answers forward.
  let submissions = remote.submissions ?? [];
  const remoteRound = remote.round;
  submissions = submissions.filter(
    (s) => s.round == null || s.round === remoteRound
  );
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
      (s) =>
        s.playerId === myPlayerId &&
        !s.rival &&
        (s.round == null || s.round === remoteRound)
    );
    if (
      localSub &&
      localSub.cards.some((c) => !isRedactedCardText(c.text))
    ) {
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

  return { ...remote, players, submissions };
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
      return {
        ok: false,
        error: data.error || `http_${res.status}`,
        status: res.status,
      };
    }
    if (data.skipped && data.state) {
      return { ok: true, skipped: true, state: coerceGameState(data.state) };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'network_error',
    };
  }
}


export type JoinResult =
  | { ok: true; state: GameState; playerId: string }
  | { ok: false; error: string; status?: number };

/** Atomic server join — unique seat + nick. */
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
      return {
        ok: false,
        error: data.error || `http_${res.status}`,
        status: res.status,
      };
    }
    return {
      ok: true,
      state: coerceGameState(data.state),
      playerId: data.playerId,
    };
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
