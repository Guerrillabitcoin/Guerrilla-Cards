/**
 * Vercel serverless: cross-device async rooms via Vercel KV / Upstash Redis REST.
 * Env: KV_REST_API_URL + KV_REST_API_TOKEN, or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.
 *
 * Upsert merges hands by player id and submissions (prefer real card text while
 * submitting; prefer full incoming on judging/reveal/results with real-text fallback).
 * Votes are unioned by voterId (and submissions by playerId) so concurrent pushes
 * keep all votes instead of last-write-wins.
 */

const ROOM_PREFIX = 'gc:room:';
const MAX_BODY_CHARS = 900_000;
const ASYNC_MAX_PLAYERS = 8;
const {
  sanitizeRoomState,
  freezeRevealOrder,
  currentRoundSubs,
  sortSubsByPlayerId,
  mergeLeagueMaps,
  mergePlayerScores,
} = require('./sanitizeRoom');
const { applyHostAuthority } = require('./hostGate');
function uid(prefix) {
  return (
    prefix +
    '_' +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 6)
  );
}

const JOIN_NICK_POOL = [
  'TostadaRebelde',
  'CafeConHielo',
  'PatataNinja',
  'ChorizoEspacial',
  'GatoFiscal',
  'MochiCaotico',
  'SillaVoladora',
  'BizcochoPunk',
  'CalcetinLibre',
  'AjoValiente',
  'YogurSamurai',
  'TortillaGlitch',
  'PanIntegral',
  'SalsaSecreta',
  'RatonPiloto',
];

function randomJoinNick() {
  const base =
    JOIN_NICK_POOL[Math.floor(Math.random() * JOIN_NICK_POOL.length)] ||
    'Jugador';
  return base + Math.floor(10 + Math.random() * 89);
}

function uniqueNick(desired, players) {
  const taken = new Set(
    (players || []).map((p) => String(p.nickname || '').toLowerCase())
  );
  let nick = String(desired || '').trim();
  if (!nick) nick = randomJoinNick();
  if (!taken.has(nick.toLowerCase())) return nick.slice(0, 42);
  for (let i = 0; i < 24; i++) {
    const cand = randomJoinNick();
    if (!taken.has(cand.toLowerCase())) return cand.slice(0, 42);
  }
  let n = 2;
  const base = nick.slice(0, 36);
  while (taken.has((base + n).toLowerCase()) && n < 99) n++;
  return (base + n).slice(0, 42);
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function kvUrl() {
  return process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
}

function kvToken() {
  return process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
}

function kvConfigured() {
  return !!(kvUrl() && kvToken());
}

async function kvCommand(cmd) {
  const url = kvUrl();
  const token = kvToken();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`kv_http_${res.status}:${text.slice(0, 120)}`);
  }
  return res.json();
}

function normalizeCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
}

function parseExisting(raw) {
  if (raw == null || raw === '') return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}


/** Snapshot fingerprint so join/upsert can detect mid-flight lobby races. */
function lobbyStamp(state) {
  if (!state || typeof state !== 'object') return '';
  const ids = (state.players || [])
    .map((p) => (p && p.id ? String(p.id) : ''))
    .filter(Boolean)
    .sort()
    .join(',');
  return `${state.updatedAt || 0}|${ids}|${state.phase || ''}`;
}

/**
 * Atomic-ish lobby join: re-read before SET; retry if another writer won the race.
 * Prevents host/peer upsert (GET@2 seats → SET) from wiping a concurrent 3rd join.
 */
async function joinLobbyAtomic(key, code, nicknameDesired) {
  const MAX_ATTEMPTS = 5;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const existingData = await kvCommand(['GET', key]);
    const existing = parseExisting(existingData?.result);
    if (!existing) {
      return { status: 404, body: { ok: false, error: 'not_found' } };
    }
    if (existing.phase !== 'lobby') {
      return { status: 409, body: { ok: false, error: 'not_lobby' } };
    }
    const players = Array.isArray(existing.players) ? existing.players.slice() : [];
    const capRaw = Number(existing.maxPlayers);
    const cap = Math.max(
      2,
      Math.min(
        ASYNC_MAX_PLAYERS,
        Number.isFinite(capRaw) && capRaw >= 2 ? Math.floor(capRaw) : ASYNC_MAX_PLAYERS
      )
    );
    if (players.length >= cap) {
      return { status: 409, body: { ok: false, error: 'lobby_full' } };
    }
    const before = lobbyStamp(existing);
    const nickname = uniqueNick(nicknameDesired, players);
    const playerId = uid('p');
    const player = {
      id: playerId,
      nickname,
      isHost: false,
      score: 0,
      hand: [],
      isBot: false,
    };
    const state = {
      ...existing,
      code,
      phase: 'lobby',
      players: [...players, player],
      updatedAt: Date.now(),
    };
    const payload = JSON.stringify(state);
    if (payload.length > MAX_BODY_CHARS) {
      return { status: 413, body: { ok: false, error: 'state_too_large' } };
    }
    // Re-check immediately before write (closes most host-upsert wipe windows)
    const againData = await kvCommand(['GET', key]);
    const again = parseExisting(againData?.result);
    if (!again || lobbyStamp(again) !== before) {
      continue; // raced — retry with fresh roster
    }
    await kvCommand(['SET', key, payload]);
    // Verify our seat survived a trailing concurrent SET
    const verifyData = await kvCommand(['GET', key]);
    const verify = parseExisting(verifyData?.result);
    const stillThere =
      verify &&
      Array.isArray(verify.players) &&
      verify.players.some((p) => p && p.id === playerId);
    if (stillThere) {
      return {
        status: 200,
        body: { ok: true, code, playerId, state: verify },
      };
    }
    // Wiped by concurrent upsert — retry join on the survivor roster
  }
  return { status: 409, body: { ok: false, error: 'join_busy' } };
}


function mergeLobbyPlayers(existingPlayers, incomingPlayers) {
  const byId = new Map();
  for (const p of existingPlayers || []) {
    if (p && p.id) byId.set(p.id, { ...p });
  }
  for (const p of incomingPlayers || []) {
    if (!p || !p.id) continue;
    const prev = byId.get(p.id);
    if (!prev) {
      byId.set(p.id, p);
      continue;
    }
    // Rename is authoritative from the renaming client (incoming)
    const incomingNick =
      p.nickname != null ? String(p.nickname).trim() : '';
    byId.set(p.id, {
      ...prev,
      ...p,
      nickname: incomingNick || prev.nickname,
    });
  }
  const merged = Array.from(byId.values());
  if (merged.length > ASYNC_MAX_PLAYERS) {
    return merged.slice(0, ASYNC_MAX_PLAYERS);
  }
  return merged;
}

function isRedactedCardText(text) {
  if (text == null) return true;
  const t = String(text).trim();
  return t === '' || t === '…' || t === '...';
}

function hasRealCardText(cards) {
  return (cards || []).some((c) => c && !isRedactedCardText(c.text));
}

const HAND_SIZE_MERGE = 12;

/**
 * Merge hands by player id.
 * mode 'prefer-incoming' (default / normal upserts): non-empty incoming wins.
 * mode 'next-cycle' (reveal/judging → submitting): preserve post-submit hands —
 *   empty incoming → keep existing
 *   empty existing → take incoming
 *   incoming longer → take incoming (refill)
 *   both >= HAND_SIZE or equal non-empty → KEEP EXISTING (don't clobber with Zar snapshot)
 */
function mergeHandsByPlayerId(existingPlayers, incomingPlayers, mode) {
  const nextCycle = mode === 'next-cycle';
  const existingById = new Map();
  for (const p of existingPlayers || []) {
    if (p && p.id) existingById.set(p.id, p);
  }
  return (incomingPlayers || []).map((p) => {
    if (!p || !p.id) return p;
    const ex = existingById.get(p.id);
    const inHand = Array.isArray(p.hand) ? p.hand : [];
    const exHand = ex && Array.isArray(ex.hand) ? ex.hand : [];

    if (nextCycle) {
      if (inHand.length === 0) {
        if (exHand.length > 0) return { ...p, hand: exHand };
        return p;
      }
      if (exHand.length === 0) return p;
      if (inHand.length > exHand.length) return p;
      if (
        (inHand.length >= HAND_SIZE_MERGE && exHand.length >= HAND_SIZE_MERGE) ||
        inHand.length === exHand.length
      ) {
        return { ...p, hand: exHand };
      }
      // Prefer existing over a shorter/partial Zar snapshot
      return { ...p, hand: exHand };
    }

    if (inHand.length > 0) return p;
    if (exHand.length > 0) return { ...p, hand: exHand };
    return p;
  });
}

/**
 * Merge submissions by playerId preferring real (non-redacted) card text.
 */
function mergeSubmissionsPreferReal(existingSubs, incomingSubs) {
  const byId = new Map();
  for (const s of existingSubs || []) {
    if (s && s.playerId) byId.set(s.playerId, s);
  }
  for (const s of incomingSubs || []) {
    if (!s || !s.playerId) continue;
    const ex = byId.get(s.playerId);
    if (!ex) {
      byId.set(s.playerId, s);
      continue;
    }
    if (hasRealCardText(s.cards)) {
      byId.set(s.playerId, s);
    } else if (hasRealCardText(ex.cards)) {
      // keep existing real
    } else {
      byId.set(s.playerId, s);
    }
  }
  return Array.from(byId.values());
}

function mergeSubmissions(existing, incoming) {
  const incomingPhase = incoming?.phase;
  const existingPhase = existing?.phase;
  const revealPhases = ['judging', 'reveal', 'results'];

  if (revealPhases.includes(incomingPhase)) {
    // Prefer incoming (full) but fall back to existing real text per player
    // so a last-submitter push with fogged peers does not wipe answers.
    return mergeSubmissionsPreferReal(
      existing?.submissions,
      incoming?.submissions
    );
  }

  if (
    (incomingPhase === 'submitting' || incomingPhase === 'discarding') &&
    (existingPhase === 'submitting' ||
      existingPhase === 'discarding' ||
      existingPhase === 'lobby' ||
      !existingPhase)
  ) {
    return mergeSubmissionsPreferReal(
      existing?.submissions,
      incoming?.submissions
    );
  }

  return incoming?.submissions ?? existing?.submissions ?? [];
}


function shuffleIndices(n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** When all required answers are in, force judging (order-independent). */

function phaseRank(phase) {
  switch (phase) {
    case 'results':
      return 50;
    case 'reveal':
      return 40;
    case 'judging':
      return 30;
    case 'discarding':
      return 20;
    case 'submitting':
      return 10;
    case 'lobby':
      return 0;
    default:
      return 0;
  }
}

/**
 * Monotonic progress across rounds. reveal(r) < discarding(r) < submitting(r+1).
 * Prevents treating a legitimate next-round push as a phase "downgrade".
 */
function gameProgress(state) {
  if (!state || typeof state !== 'object') return 0;
  const round = Number(state.round) || 0;
  switch (state.phase) {
    case 'lobby':
      return round * 10 + 0;
    case 'submitting':
      return round * 10 + 1;
    case 'judging':
      return round * 10 + 2;
    case 'reveal':
      return round * 10 + 3;
    case 'discarding':
      return round * 10 + 4;
    case 'results':
      return round * 10 + 9;
    default:
      return round * 10;
  }
}

function isNextCycleAdvance(existing, incoming) {
  if (!existing || !incoming) return false;
  const ip = incoming.phase;
  const ep = existing.phase;
  if (ip !== 'submitting' && ip !== 'discarding') return false;
  if (ep !== 'reveal' && ep !== 'judging' && ep !== 'results') return false;
  return gameProgress(incoming) > gameProgress(existing);
}

function promoteJudgingIfReady(state) {
  if (!state || state.phase !== 'submitting') return state;
  if (state.mode === 'solo') return state;
  const voteMode = (state.judgeMode || 'zar') === 'vote';
  const players = state.players || [];
  const zar = players[state.zarIndex || 0];
  const round = Number(state.round) || 0;
  let subs = (state.submissions || []).filter(
    (s) => s && !s.rival && (s.round == null || s.round === round)
  );
  if (!voteMode && zar?.id) {
    subs = subs.filter((s) => s.playerId !== zar.id);
  }
  const needed = voteMode
    ? players.length
    : Math.max(0, players.length - 1);
  if (subs.length < needed) return state;
  const firstVoter = players.find((p) => !p.isBot) || players[0];
  return {
    ...state,
    submissions: subs,
    revealOrder: freezeRevealOrder(state.revealOrder, null, sortSubsByPlayerId(subs).length),
submissions: sortSubsByPlayerId(subs),
    votes: {},
    phase: 'judging',
    activeSeatId: voteMode
      ? firstVoter?.id || zar?.id || null
      : zar?.id || null,
    updatedAt: Date.now(),
  };
}

function unionDiscardDone(a, b) {
  const out = [];
  const seen = new Set();
  for (const id of [...(a || []), ...(b || [])]) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function mergeLastDiscarded(existing, incoming) {
  const byId = new Map();
  for (const row of existing || []) {
    if (row && row.playerId) byId.set(row.playerId, row);
  }
  for (const row of incoming || []) {
    if (row && row.playerId) byId.set(row.playerId, row);
  }
  return Array.from(byId.values());
}

/** Union vote maps by voterId. Incoming overwrites the same voter; peers keep theirs. */
function mergeVotesByVoterId(existingVotes, incomingVotes) {
  const out = { ...(existingVotes || {}) };
  for (const [voterId, targetId] of Object.entries(incomingVotes || {})) {
    if (!voterId || targetId == null || targetId === '') continue;
    out[voterId] = targetId;
  }
  return out;
}

function voteCount(votes) {
  return Object.keys(votes || {}).length;
}

/**
 * Lightweight server-side finalize when all submission owners have voted.
 * Mirrors client resolveVotesIfComplete / tallyVotesIfComplete enough to advance
 * phase so the room does not hang waiting for a client that never saw the union.
 */
function resolveVotesIfCompleteServer(state) {
  if (!state || state.phase !== 'judging') return state;
  if ((state.judgeMode || 'zar') !== 'vote' || state.mode === 'solo') return state;
  const votes = state.votes || {};
  const eligible = (state.submissions || [])
    .filter((s) => s && !s.rival)
    .map((s) => s.playerId)
    .filter(Boolean);
  if (!eligible.length || !eligible.every((id) => !!votes[id])) return state;

  const tallies = {};
  for (const target of Object.values(votes)) {
    tallies[target] = (tallies[target] || 0) + 1;
  }
  let best = -1;
  for (const n of Object.values(tallies)) {
    if (n > best) best = n;
  }
  const tied = Object.keys(tallies).filter((id) => tallies[id] === best);
  const humans = (state.players || []).filter((p) => p && !p.isBot).length;
  const hostId =
    ((state.players || []).find((p) => p && p.isHost) || {}).id ||
    eligible[0] ||
    null;
  const now = Date.now();

  // 2-player vote: +votesReceived each (special scoring)
  if (humans === 2 || Number(state.maxPlayers) === 2) {
    const players = (state.players || []).map((p) =>
      p && p.id in tallies
        ? { ...p, score: (p.score || 0) + (tallies[p.id] || 0) }
        : p
    );
    const hitTarget = players.some(
      (p) => p && p.score >= (state.targetScore || 999)
    );
    const isSplit = tied.length > 1;
    return {
      ...state,
      players,
      votes,
      roundWinnerId: isSplit ? hostId : tied[0] || hostId,
      roundWinnerIds: isSplit ? tied : [],
      phase: hitTarget ? 'results' : 'reveal',
      activeSeatId: hitTarget ? null : hostId,
      updatedAt: now,
    };
  }

  // >2 humans: tie annuls (no points)
  if (tied.length >= 2) {
    return {
      ...state,
      votes,
      roundWinnerId: null,
      roundWinnerIds: tied,
      phase: 'reveal',
      activeSeatId: hostId,
      updatedAt: now,
    };
  }

  const winnerId = tied[0];
  if (!winnerId) {
    return {
      ...state,
      votes,
      roundWinnerId: null,
      roundWinnerIds: eligible.slice(0, 2),
      phase: 'reveal',
      activeSeatId: hostId,
      updatedAt: now,
    };
  }
  const players = (state.players || []).map((p) =>
    p && p.id === winnerId ? { ...p, score: (p.score || 0) + 1 } : p
  );
  const hitTarget = players.some(
    (p) => p && p.score >= (state.targetScore || 999)
  );
  return {
    ...state,
    players,
    votes,
    roundWinnerId: winnerId,
    roundWinnerIds: [],
    phase: hitTarget ? 'results' : 'reveal',
    activeSeatId: hitTarget ? null : winnerId,
    updatedAt: now,
  };
}

function applyPrivacyMerges(existing, incoming) {
  if (!existing || typeof existing !== 'object') return incoming;

  // reveal/judging → next submitting/discarding: accept new cycle wholesale
  if (isNextCycleAdvance(existing, incoming)) {
    const players = mergeHandsByPlayerId(
      existing.players,
      incoming.players,
      'next-cycle'
    );
    // Always wipe prior-round answers on cycle advance (ignore incoming leftovers)
    return promoteJudgingIfReady({
      ...incoming,
      players,
      submissions: [],
      revealOrder: [],
      votes: {},
      roundWinnerId: null,
      roundWinnerIds: [],
      discardDonePlayerIds:
        incoming.phase === 'discarding'
          ? incoming.discardDonePlayerIds || []
          : [],
      lastDiscarded:
        incoming.phase === 'discarding' ? incoming.lastDiscarded || [] : [],
    });
  }

  const players = mergeHandsByPlayerId(existing.players, incoming.players);
  const submissions = mergeSubmissions(existing, incoming);
  // Prefer higher gameProgress (not raw phaseRank — submitting after reveal is forward)
  let phase = incoming.phase;
  if (gameProgress(existing) > gameProgress(incoming)) {
    phase = existing.phase;
  } else if (
    existing.phase === 'judging' ||
    incoming.phase === 'judging'
  ) {
    if (phaseRank(phase) < phaseRank('judging')) phase = 'judging';
  }
  const clearWinner =
    phase === 'submitting' || phase === 'discarding' || phase === 'lobby';
  const sameRound =
    (Number(existing.round) || 0) === (Number(incoming.round) || 0);
  // Judging (and same-round reveal/results): union votes by voterId — concurrent
  // castVote pushes must not last-write-wins wipe a peer's ballot.
  let votes = incoming.votes || {};
  if (
    sameRound &&
    (phase === 'judging' ||
      existing.phase === 'judging' ||
      incoming.phase === 'judging' ||
      ((phase === 'reveal' || phase === 'results') &&
        (voteCount(existing.votes) > 0 || voteCount(incoming.votes) > 0)))
  ) {
    votes = mergeVotesByVoterId(existing.votes, incoming.votes);
  } else if (clearWinner) {
    votes = incoming.votes || {};
  } else {
    votes =
      voteCount(incoming.votes) >= voteCount(existing.votes)
        ? incoming.votes || existing.votes || {}
        : existing.votes || incoming.votes || {};
  }
  let state = {
    ...incoming,
    phase,
    players,
    submissions,
    votes,
    roundWinnerId: clearWinner
      ? incoming.roundWinnerId ?? null
      : incoming.roundWinnerId || existing.roundWinnerId || null,
    roundWinnerIds: clearWinner
      ? incoming.roundWinnerIds || []
      : incoming.roundWinnerIds || existing.roundWinnerIds || [],
  };
  // Discarding: never lose a peer who already discarded (avoids double-discard)
  if (
    phase === 'discarding' &&
    existing.phase === 'discarding' &&
    (Number(existing.round) || 0) === (Number(incoming.round) || 0)
  ) {
    const doneIds = unionDiscardDone(
      existing.discardDonePlayerIds,
      incoming.discardDonePlayerIds
    );
    const doneSet = new Set(doneIds);
    // Prefer post-discard hand from whoever just marked done
    const exById = new Map((existing.players || []).map((p) => [p.id, p]));
    const inById = new Map((incoming.players || []).map((p) => [p.id, p]));
    const mergedPlayers = (state.players || []).map((p) => {
      if (!p || !p.id || !doneSet.has(p.id)) return p;
      const inc = inById.get(p.id);
      const ex = exById.get(p.id);
      const inHand = inc && Array.isArray(inc.hand) ? inc.hand : [];
      const exHand = ex && Array.isArray(ex.hand) ? ex.hand : [];
      const curHand = Array.isArray(p.hand) ? p.hand : [];
      if (inHand.length > 0 && (incoming.discardDonePlayerIds || []).includes(p.id)) {
        return { ...p, hand: inHand };
      }
      if (exHand.length > 0 && (existing.discardDonePlayerIds || []).includes(p.id)) {
        return { ...p, hand: exHand };
      }
      if (curHand.length > 0) return p;
      if (inHand.length > 0) return { ...p, hand: inHand };
      if (exHand.length > 0) return { ...p, hand: exHand };
      return p;
    });
    state = {
      ...state,
      players: mergedPlayers,
      discardDonePlayerIds: doneIds,
      lastDiscarded: mergeLastDiscarded(
        existing.lastDiscarded,
        incoming.lastDiscarded
      ),
    };
  }
  if (phase === 'reveal' || phase === 'results') {
    // Keep scores from the more advanced side
    if (
      phaseRank(existing.phase) >= phaseRank('reveal') &&
      phaseRank(incoming.phase) < phaseRank('reveal')
    ) {
      state.players = mergeHandsByPlayerId(incoming.players, existing.players);
      state.roundWinnerId = existing.roundWinnerId;
      state.submissions = mergeSubmissionsPreferReal(
        existing.submissions,
        incoming.submissions
      );
    }
  }
  if (phase === 'judging') {
    state.submissions = currentRoundSubs(state);
    state.revealOrder = freezeRevealOrder(
      existing.revealOrder,
      incoming.revealOrder,
      state.submissions.length
    );
    state.activeSeatId =
      incoming.activeSeatId || existing.activeSeatId || state.activeSeatId;
    state = resolveVotesIfCompleteServer(state);
  }
    state.leagueScores = mergeLeagueMaps(
    existing && existing.leagueScores,
    incoming && incoming.leagueScores,
    state.leagueScores
  );
    const mergingRematch =
    state &&
    (Number(state.round) || 0) <= 1 &&
    (state.phase === 'submitting' || state.phase === 'discarding');
  if (!mergingRematch) {
    state.players = mergePlayerScores(existing && existing.players, state.players);
  }
  return sanitizeRoomState(promoteJudgingIfReady(state));
}
async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (!kvConfigured()) {
    return res.status(503).json({ ok: false, error: 'kv_not_configured' });
  }

  try {
    if (req.method === 'GET') {
      const code = normalizeCode(req.query?.code);
      if (!code || code.length < 3) {
        return res.status(400).json({ ok: false, error: 'bad_code' });
      }
      const key = `${ROOM_PREFIX}${code}`;
      const data = await kvCommand(['GET', key]);
      const raw = data?.result;
      if (raw == null || raw === '') {
        return res.status(404).json({ ok: false, error: 'not_found' });
      }
      let state;
      try {
        state = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch {
        return res.status(500).json({ ok: false, error: 'corrupt_state' });
      }
        state = sanitizeRoomState(state);
      return res.status(200).json({ ok: true, state });
    }

    if (req.method === 'POST') {
      let body = {};
      try {
        body =
          typeof req.body === 'string'
            ? JSON.parse(req.body)
            : req.body || {};
      } catch {
        return res.status(400).json({ ok: false, error: 'invalid_json' });
      }

      const action = body.action || 'upsert';

      // Atomic join: server assigns a unique seat + nick (CAS + verify)
      if (action === 'join') {
        const code = normalizeCode(body.code);
        if (!code || code.length < 3) {
          return res.status(400).json({ ok: false, error: 'bad_code' });
        }
        const key = `${ROOM_PREFIX}${code}`;
        const joined = await joinLobbyAtomic(key, code, body.nickname);
        return res.status(joined.status).json(joined.body);
      }

      if (action === 'claim') {
        const code = normalizeCode(body.code);
        const playerId = String(body.playerId || '').trim();
        if (!code || code.length < 3) {
          return res.status(400).json({ ok: false, error: 'bad_code' });
        }
        if (!playerId) {
          return res.status(400).json({ ok: false, error: 'missing_seat' });
        }
        const key = `${ROOM_PREFIX}${code}`;
        const existingData = await kvCommand(['GET', key]);
        const existing = parseExisting(existingData?.result);
        if (!existing) {
          return res.status(404).json({ ok: false, error: 'not_found' });
        }
        const players = Array.isArray(existing.players) ? existing.players : [];
        const seat = players.find((p) => p && p.id === playerId && !p.isBot);
        if (!seat) {
          return res.status(404).json({ ok: false, error: 'seat_missing' });
        }
        return res.status(200).json({
          ok: true,
          code,
          playerId: seat.id,
          state: { ...existing, code },
        });
      }

      // Default action: upsert (host create / pushRoom)
      const code = normalizeCode(body.code || body.state?.code);
      if (!code || code.length < 3) {
        return res.status(400).json({ ok: false, error: 'bad_code' });
      }
      if (!body.state || typeof body.state !== 'object') {
        return res.status(400).json({ ok: false, error: 'missing_state' });
      }

            let incoming = { ...body.state, code };
      const actorId = String(body.actorId || '').trim();
      const key = `${ROOM_PREFIX}${code}`;

      // Load existing for merge / stale skip
      const existingData = await kvCommand(['GET', key]);
      const existing = parseExisting(existingData?.result);
      if (existing && typeof existing === 'object') {
        const auth = applyHostAuthority(existing, incoming, actorId);
        if (auth.reject) {
          return res.status(200).json({
            ok: true,
            skipped: true,
            state: existing,
            code,
          });
        }
        incoming = auth.state;
      }

      let state = incoming;

      if (existing && typeof existing === 'object') {
        const bothLobby =
          existing.phase === 'lobby' && incoming.phase === 'lobby';
        const remoteNewer =
          (existing.updatedAt ?? 0) > (incoming.updatedAt ?? 0);
        const existingProg = gameProgress(existing);
        const incomingProg = gameProgress(incoming);

        // Rematch from results resets round/progress; newer updatedAt wins.
                const incomingRematch =
          incoming.phase !== 'results' &&
          incoming.phase !== 'lobby' &&
          (Number(incoming.round) || 0) <= 1 &&
          existing.phase === 'results';
        const existingRematch =
          existing.phase !== 'results' &&
          existing.phase !== 'lobby' &&
          (Number(existing.round) || 0) <= 1;
        const matchRestart =
          incomingRematch &&
          (incoming.updatedAt ?? 0) >= (existing.updatedAt ?? 0);
        if (existingRematch && incoming.phase === 'results') {
          return res.status(200).json({
            ok: true,
            skipped: true,
            state: existing,
            code,
          });
        }

        // Stale only when remote is strictly ahead in round/phase progress.
        // reveal → next submitting/discarding is FORWARD (higher gameProgress).
        if (!bothLobby && existingProg > incomingProg && !matchRestart) {
          return res.status(200).json({
            ok: true,
            skipped: true,
            state: existing,
            code,
          });
        }

               if (matchRestart) {
          state = { ...incoming, code };
          state.players = (state.players || []).map((p) =>
            p ? { ...p, score: 0 } : p
          );
          state.submissions = [];
          state.votes = {};
          state.roundWinnerId = null;
          state.roundWinnerIds = [];
          // Preserve session league totals across rematch
          // Preserve session league totals across rematch
          if (existing.leagueScores && typeof existing.leagueScores === 'object') {
            state.leagueScores = {
              ...existing.leagueScores,
              ...(incoming.leagueScores || {}),
            };
          } else if (incoming.leagueScores) {
            state.leagueScores = incoming.leagueScores;
          }
          if (existing.restartReadyIds && !incoming.restartReadyIds) {
            state.restartReadyIds = [];
          }
        } else if (bothLobby) {
          // Concurrent host/joiner pushes: union players by id so neither wipes seats
          // Re-GET right before compose to catch joins that landed after our first GET.
          const freshData = await kvCommand(['GET', key]);
          const fresh = parseExisting(freshData?.result) || existing;
          const mergedPlayers = mergeLobbyPlayers(
            mergeLobbyPlayers(fresh.players, existing.players),
            incoming.players
          );
          const withHands = mergeHandsByPlayerId(
            fresh.players,
            mergedPlayers
          );
          const base =
            (fresh.updatedAt ?? 0) >= (incoming.updatedAt ?? 0) ||
            (fresh.players?.length ?? 0) > (incoming.players?.length ?? 0)
              ? fresh
              : incoming;
          const nextUpdated = Math.max(
            Date.now(),
            (fresh.updatedAt ?? 0) + 1,
            (existing.updatedAt ?? 0) + 1,
            (incoming.updatedAt ?? 0) + 1
          );
          state = {
            ...base,
            ...incoming,
            code,
            phase: 'lobby',
            players: withHands,
            packIds: base.packIds?.length ? base.packIds : incoming.packIds,
            mode: base.mode || incoming.mode,
            judgeMode: base.judgeMode || incoming.judgeMode,
            targetScore: base.targetScore ?? incoming.targetScore,
            maxPlayers: base.maxPlayers ?? incoming.maxPlayers,
            leagueScores: {
              ...(fresh.leagueScores || {}),
              ...(existing.leagueScores || {}),
              ...(incoming.leagueScores || {}),
            },
            restartReadyIds:
              incoming.restartReadyIds ||
              fresh.restartReadyIds ||
              existing.restartReadyIds ||
              [],
            submissions: mergeSubmissions(fresh, {
              ...incoming,
              phase: 'lobby',
            }),
            updatedAt: nextUpdated,
          };
        } else if (remoteNewer && existingProg > incomingProg) {
          // Remote strictly ahead — don't clobber
          return res.status(200).json({
            ok: true,
            skipped: true,
            state: existing,
            code,
          });
        } else if (
          remoteNewer &&
          existingProg === incomingProg &&
          existing.phase === incoming.phase &&
          (existing.phase === 'submitting' || existing.phase === 'judging')
        ) {
          // Same submitting/judging tick, remote newer: still merge peer
          // answers / votes (union) so concurrent pushes do not hang.
          state = applyPrivacyMerges(existing, incoming);
        } else if (
          remoteNewer &&
          existingProg === incomingProg &&
          existing.phase === 'judging' &&
          incoming.phase === 'judging'
        ) {
          state = applyPrivacyMerges(existing, incoming);
        } else if (remoteNewer && existingProg >= incomingProg) {
          // Same-or-equal progress, remote newer — keep remote
          // Exception: richer vote map on equal judging progress already handled above.
          return res.status(200).json({
            ok: true,
            skipped: true,
            state: existing,
            code,
          });
        } else {
          // Accept incoming (newer, equal, or next-cycle advance)
          state = applyPrivacyMerges(existing, incoming);
        }
      }

      state = promoteJudgingIfReady(state);
      state = resolveVotesIfCompleteServer(state);
      state = sanitizeRoomState(state);
      state.leagueScores = mergeLeagueMaps(
        existing && existing.leagueScores,
        incoming && incoming.leagueScores,
        state.leagueScores
      );

      const payload = JSON.stringify(state);
      if (payload.length > MAX_BODY_CHARS) {
        return res.status(413).json({ ok: false, error: 'state_too_large' });
      }

      await kvCommand(['SET', key, payload]);
      return res.status(200).json({ ok: true, code, state, merged: true });
    }

    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  } catch (err) {
    console.warn('room_kv_error', String(err));
    return res.status(500).json({ ok: false, error: 'kv_error' });
  }
};

handler.mergeHandsByPlayerId = mergeHandsByPlayerId;
handler.isNextCycleAdvance = isNextCycleAdvance;
handler.applyPrivacyMerges = applyPrivacyMerges;
handler.mergeVotesByVoterId = mergeVotesByVoterId;
handler.resolveVotesIfCompleteServer = resolveVotesIfCompleteServer;
module.exports = handler;

