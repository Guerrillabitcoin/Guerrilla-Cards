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

// ---- Seat tokens (secret per seat; issued by /api/room on create/join) ----
const TOKEN_KEY = (code: string) => `guerrilla_seattok_${code.trim().toUpperCase()}`;

function readTokenMap(code: string): Record<string, string> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(TOKEN_KEY(code));
    const m = raw ? JSON.parse(raw) : {};
    return m && typeof m === 'object' ? m : {};
  } catch {
    return {};
  }
}

export function getSeatToken(code: string, seatId?: string | null): string | undefined {
  captureTokenFromUrl();
  if (!code || !seatId) return undefined;
  return readTokenMap(code)[seatId] || undefined;
}

export function setSeatToken(code: string, seatId: string, token: string): void {
  if (!code || !seatId || !token) return;
  try {
    if (typeof localStorage === 'undefined') return;
    const m = readTokenMap(code);
    if (m[seatId] === token) return;
    m[seatId] = token;
    localStorage.setItem(TOKEN_KEY(code), JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

/** Seat links carry &t=<token>: store it for that code+seat before claiming. */
export function captureTokenFromUrl(): void {
  try {
    if (typeof window === 'undefined' || !window.location?.search) return;
    const q = new URLSearchParams(window.location.search);
    const t = q.get('t');
    const seat = q.get('seat');
    const code = q.get('code');
    if (t && seat && code) setSeatToken(code, seat, t);
  } catch {
    /* ignore */
  }
}

function seatHeaders(code: string): Record<string, string> {
  const seat = seatCache[normalizeCode(code)];
  const tok = seat ? getSeatToken(code, seat) : undefined;
  return seat && tok ? { 'X-Seat': seat, 'X-Seat-Token': tok } : {};
}

/** Host only: tokens of every human seat (for «Enlaces de asiento»). */
export async function fetchSeatTokens(
  code: string,
  actorId: string
): Promise<Record<string, string>> {
  const url = roomApiUrl();
  if (!url) return {};
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'seatTokens',
        code: normalizeCode(code),
        actorId,
        token: getSeatToken(code, actorId),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { tokens?: Record<string, string> };
    const tokens = data.tokens || {};
    for (const [id, t] of Object.entries(tokens)) setSeatToken(code, id, t);
    return tokens;
  } catch {
    return {};
  }
}

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
      // Bots are ghost seats: everyone must see their phrase to vote/judge.
      // Redacting them left «…» forever on the server after autoSubmitBots.
      const owner = state.players.find((p) => p.id === s.playerId);
      if (owner?.isBot) return s;
      return redactSubmission(s);
    });
  }
  // Publish every seat's hand until a human has submitted this round.
  // Multi bots auto-submit before the first push; if we keyed off submissions.length
  // the guest/bot hands never left the host device and play hung on empty mano.
  const humanSubCount = (state.submissions ?? []).filter((s) => {
    if (!s || s.rival) return false;
    const pl = state.players.find((p) => p.id === s.playerId);
    return !!pl && !pl.isBot;
  }).length;
  const publishAllHands =
    state.phase === 'lobby' ||
    (state.phase === 'submitting' && humanSubCount === 0);
  const submittedIds = new Set(
    (state.submissions ?? [])
      .filter((s) => s && !s.rival && s.playerId)
      .map((s) => s.playerId)
  );
  const players =
    !myPlayerId || publishAllHands
      ? state.players
      : state.players.map((p) => {
          if (p.id === myPlayerId) return p;
          // Keep bot hands on the wire until that bot has submitted so the
          // host valve / server can still auto-pick if a human answered first.
          if (
            p.isBot &&
            state.phase === 'submitting' &&
            !submittedIds.has(p.id)
          ) {
            return p;
          }
          return { ...p, hand: [] };
        });
  return { ...state, players, submissions, promptDeck: [], answerDeck: [] };
}

/** True when the server fixed (dedup-swapped) this seat's hand after our local copy. */
export function serverFixedMyHand(
  remote: GameState | null | undefined,
  local: GameState | null | undefined,
  seat?: string | null
): boolean {
  if (!seat || !remote?.handFix) return false;
  return (remote.handFix[seat] ?? 0) > (local?.handFix?.[seat] ?? 0);
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
      // Server swapped a duplicate in my hand → adopt the server hand verbatim.
      if (serverFixedMyHand(remote, local, myPlayerId) && rp.hand && rp.hand.length > 0) {
        return rp;
      }
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
      // After scoring, trust remote (server/client resolve). Math.max was
      // re-inflating split (+1+1) / clear-win (+2) bugs across peers.
      if (remote.phase === 'reveal' || remote.phase === 'results') {
        /* keep rp.score */
      } else {
        const score = Math.max(Number(rp.score) || 0, Number(lp.score) || 0);
        if (score !== (Number(rp.score) || 0)) rp = { ...rp, score };
      }
    }
    return rp;
  });
  let submissions = remote.submissions ?? [];
  const remoteRound = remote.round;
  const pickNeed = Math.max(1, remote.currentPrompt?.pick ?? 1);
  submissions = submissions.filter((s) => s.round == null || s.round === remoteRound);
  // Defense in depth: drop incomplete !rival multipick answers from remote.
  submissions = submissions.filter(
    (s) => s.rival || (Array.isArray(s.cards) && s.cards.length === pickNeed)
  );
  // Prefer local real text for bot seats over remote fog («…»).
  // Host autoSubmitBots has the real phrase; a peer push must not blank the mesa.
  if (
    myPlayerId &&
    local.submissions?.length &&
    (local.round ?? 0) === (remote.round ?? 0) &&
    (local.currentPrompt?.id ?? null) === (remote.currentPrompt?.id ?? null)
  ) {
    const botIds = new Set(
      remote.players.filter((p) => p.isBot).map((p) => p.id)
    );
    if (botIds.size) {
      submissions = submissions.map((s) => {
        if (!s || s.rival || !botIds.has(s.playerId)) return s;
        if (s.cards.some((c) => !isRedactedCardText(c.text))) return s;
        const localSub = local.submissions.find(
          (ls) =>
            ls.playerId === s.playerId &&
            !ls.rival &&
            (ls.round == null || ls.round === remoteRound)
        );
        if (
          localSub &&
          localSub.cards.length === pickNeed &&
          localSub.cards.some((c) => !isRedactedCardText(c.text))
        ) {
          return { ...localSub, round: remoteRound };
        }
        return s;
      });
    }
  }

  // Un-redact MY submission text if the server already has my seat.
  // Never add a local-only submission the server lacks (ghost «ya contestaste»).
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
    if (
      localSub &&
      localSub.cards.length === pickNeed &&
      localSub.cards.some((c) => !isRedactedCardText(c.text))
    ) {
      const serverHasMine = submissions.some((s) => s.playerId === myPlayerId && !s.rival);
      if (serverHasMine) {
        submissions = submissions.map((s) => {
          if (s.playerId !== myPlayerId || s.rival) return s;
          const remoteRedacted = s.cards.every((c) => isRedactedCardText(c.text));
          return remoteRedacted ? { ...localSub, round: remoteRound } : s;
        });
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
  | { ok: true; skipped?: false; state?: GameState }
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
      actorId: myPlayerId || undefined,
      token: getSeatToken(state.code, myPlayerId) || undefined,
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
      seatToken?: string;
    };
    if (data.seatToken && myPlayerId) setSeatToken(state.code, myPlayerId, data.seatToken);
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

/**
 * True when `local` holds one of MY actions (submit / discard / vote) for the
 * same round+phase that the server state `remote` does not show yet.
 */
export function missingMyAction(
  local: GameState,
  remote: GameState | null | undefined,
  myPlayerId?: string | null
): boolean {
  if (!remote || !myPlayerId) return false;
  if ((local.round ?? 0) !== (remote.round ?? 0)) return false;
  if (local.phase !== remote.phase) return false;
  if (local.phase === 'submitting') {
    const mine = (local.submissions ?? []).some(
      (s) => s && !s.rival && s.playerId === myPlayerId
    );
    if (!mine) return false;
    return !(remote.submissions ?? []).some(
      (s) => s && !s.rival && s.playerId === myPlayerId
    );
  }
  if (local.phase === 'discarding') {
    if (!(local.discardDonePlayerIds ?? []).includes(myPlayerId)) return false;
    return !(remote.discardDonePlayerIds ?? []).includes(myPlayerId);
  }
  if (local.phase === 'judging') {
    if (!local.votes?.[myPlayerId]) return false;
    return !remote.votes?.[myPlayerId];
  }
  return false;
}

/**
 * pushRoom + confirm: retry (backoff) until the server state shows my
 * submit/discard/vote, or the server moved past this phase. Network / 503
 * (room_busy) errors are retried too.
 */
export async function pushRoomConfirmed(
  state: GameState,
  myPlayerId?: string | null,
  attempts = 4
): Promise<PushResult> {
  let last: PushResult = { ok: false, error: 'not_sent' };
  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      await new Promise((r) => setTimeout(r, 250 * 2 ** (i - 1) + Math.random() * 150));
    }
    last = await pushRoom(state, myPlayerId);
    if (!last.ok) {
      if (last.status && last.status >= 400 && last.status < 500) return last;
      continue;
    }
    const remote = last.state;
    if (!remote || !missingMyAction(state, remote, myPlayerId)) return last;
  }
  return last;
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
      seatToken?: string;
    };
    if (!res.ok || !data.ok || !data.state || !data.playerId) {
      return { ok: false, error: data.error || `http_${res.status}`, status: res.status };
    }
    if (data.seatToken) setSeatToken(normalized, data.playerId, data.seatToken);
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
      body: JSON.stringify({
        action: 'claim',
        code: normalizeCode(code),
        playerId,
        token: getSeatToken(code, playerId),
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

export async function pullRoom(code: string): Promise<PullResult> {
  const normalized = code.trim().toUpperCase();
  const url = roomApiUrl(`code=${encodeURIComponent(normalized)}`);
  if (!url) return { ok: false, error: 'not_web' };
  try {
    const res = await fetch(url, { headers: seatHeaders(normalized) });
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
  if (!playerId) {
    delete seatCache[key];
    try {
      await AsyncStorage.removeItem(SEAT_KEY(code));
    } catch {
      /* ignore */
    }
    return;
  }
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
