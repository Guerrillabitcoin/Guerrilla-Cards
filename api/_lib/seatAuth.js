/**
 * Seat tokens + incoming-state validation for /api/room.
 *
 * Tokens: secret per human seat, stored in a separate KV key (gc:tok:CODE),
 * never inside room state and never returned by GET. Rooms created before
 * v0.99.422.24 have no token key → "legacy" (no enforcement) until they expire.
 */
const crypto = require('crypto');

const TOKEN_PREFIX = 'gc:tok:';
const NICK_MAX = 42;

function newToken() {
  return crypto.randomBytes(16).toString('hex');
}

function tokensKey(code) {
  return TOKEN_PREFIX + code;
}

function parseTokens(raw) {
  if (raw == null || raw === '') return null;
  try {
    const t = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return t && typeof t === 'object' ? t : null;
  } catch {
    return null;
  }
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  if (!x.length || x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}

/** tokens == null → legacy room (allowed). Otherwise seat must match. */
function seatAuthOk(tokens, seatId, token) {
  if (!tokens) return true;
  const id = String(seatId || '');
  if (!id || !tokens[id]) return false;
  return safeEqual(tokens[id], token);
}

function sanitizeNick(raw) {
  return String(raw == null ? '' : raw)
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, '')
    .replace(/[<>`"\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NICK_MAX)
    .trim();
}

function isTwoPlayerVote(state) {
  const humans = (state.players || []).filter((p) => p && !p.isBot).length;
  return (
    (state.judgeMode || 'zar') === 'vote' &&
    state.mode !== 'solo' &&
    (Number(state.maxPlayers) === 2 || humans === 2)
  );
}

/**
 * Ballot rules (mirror client castVote / castVoteFlexible):
 * human seat, submitted this round, target is a current option,
 * no self-vote unless 1v1 vote.
 */
function ballotError(state, voterId, targetId) {
  if (!state || state.phase !== 'judging') return 'not_judging';
  if ((state.judgeMode || 'zar') !== 'vote') return 'not_vote';
  const voter = (state.players || []).find((p) => p && p.id === voterId);
  if (!voter) return 'not_seat';
  if (voter.isBot) return 'bot_no_vote';
  const round = Number(state.round) || 0;
  const subs = (state.submissions || []).filter(
    (s) => s && !s.rival && s.playerId && (s.round == null || s.round === round)
  );
  if (!subs.some((s) => s.playerId === voterId)) return 'not_submitted';
  if (!subs.some((s) => s.playerId === targetId)) return 'bad_target';
  if (voterId === targetId && !isTwoPlayerVote(state)) return 'self_vote';
  return null;
}

/**
 * Restrict what one actor's upsert may change:
 * - roster (ids, isHost, isBot) comes from the server; guests cannot add/drop seats
 * - scores + liga are server-owned (client values ignored)
 * - submissions / votes / discard marks / Listo only for the actor's own seat
 *   (host may also act for bots)
 * - nicknames: only own seat (sanitized); host may name bots
 */
function restrictIncoming(existing, incoming, actorId) {
  if (!existing || !incoming) return incoming;
  const exPlayers = (existing.players || []).filter((p) => p && p.id);
  const exById = new Map(exPlayers.map((p) => [p.id, p]));
  const hostId = (exPlayers.find((p) => p.isHost) || {}).id || '';
  const actorIsHost = !!actorId && actorId === hostId;
  const botIds = new Set(exPlayers.filter((p) => p.isBot).map((p) => p.id));
  const owns = (pid) =>
    !!pid && (pid === actorId || (actorIsHost && botIds.has(pid)));
  const lobby = incoming.phase === 'lobby' && existing.phase === 'lobby';

  let players = (incoming.players || []).filter((p) => p && p.id);
  players = players
    .filter((p) => {
      if (exById.has(p.id)) return true;
      // New seats: only host may add bots. Humans join via action 'join'.
      return actorIsHost && !!p.isBot;
    })
    .map((p) => {
      const ex = exById.get(p.id);
      if (!ex) {
        return {
          ...p,
          isHost: false,
          isBot: true,
          score: 0,
          nickname: sanitizeNick(p.nickname) || 'Bot',
        };
      }
      let nickname = ex.nickname;
      if (p.id === actorId || (actorIsHost && ex.isBot)) {
        nickname = sanitizeNick(p.nickname) || ex.nickname;
      }
      return {
        ...p,
        id: ex.id,
        isHost: !!ex.isHost,
        isBot: !!ex.isBot,
        nickname,
        score: Number(ex.score) || 0,
      };
    });
  if (!actorIsHost) {
    // Guests never drop seats either: keep server roster order.
    const inById = new Map(players.map((p) => [p.id, p]));
    players = exPlayers.map((ex) => inById.get(ex.id) || ex);
  }

  const sameRound =
    (Number(existing.round) || 0) === (Number(incoming.round) || 0);

  const exSubs = new Map();
  for (const s of existing.submissions || []) {
    if (s && s.playerId && !s.rival) exSubs.set(s.playerId, s);
  }
  const submissions = (incoming.submissions || [])
    .map((s) => {
      if (!s || !s.playerId) return null;
      if (s.rival) return incoming.mode === 'solo' ? s : null;
      if (owns(s.playerId)) return s;
      const ex = exSubs.get(s.playerId);
      if (!ex) return null;
      if (s.round != null && ex.round != null && s.round !== ex.round) return null;
      return ex;
    })
    .filter(Boolean);

  let votes = {};
  if (sameRound && existing.phase === 'judging') {
    votes = { ...(existing.votes || {}) };
    const mine = incoming.votes && actorId ? incoming.votes[actorId] : null;
    if (mine && !votes[actorId] && !ballotError(existing, actorId, String(mine))) {
      votes[actorId] = String(mine);
    }
  } else if (sameRound && (existing.phase === 'reveal' || existing.phase === 'results')) {
    votes = { ...(existing.votes || {}) };
  }

  const exDone = new Set(
    sameRound && existing.phase === 'discarding' ? existing.discardDonePlayerIds || [] : []
  );
  const discardDonePlayerIds = (incoming.discardDonePlayerIds || []).filter(
    (id) => exDone.has(id) || owns(id)
  );
  const exReady = new Set(existing.restartReadyIds || []);
  const restartReadyIds = (incoming.restartReadyIds || []).filter(
    (id) => exReady.has(id) || id === actorId
  );

  const out = {
    ...incoming,
    players,
    submissions,
    votes,
    discardDonePlayerIds,
    restartReadyIds,
    leagueScores: { ...(existing.leagueScores || {}) },
    leagueAwarded: !!existing.leagueAwarded,
    leagueMatchCount: Number(existing.leagueMatchCount) || 0,
  };
  if (lobby) {
    out.players = out.players.map((p) => ({ ...p, score: 0 }));
  }
  return out;
}

/**
 * Server-owned scoring on judging → reveal/results pushes.
 * vote: roll incoming back to judging; the server tallies (resolveVotesIfCompleteServer).
 * zar: only the Comandante may pick; winner must be a current non-zar option; +1 server-side.
 */
function applyServerScoring(existing, incoming, actorId) {
  if (!existing || !incoming) return incoming;
  if (existing.phase !== 'judging') return incoming;
  if (incoming.phase !== 'reveal' && incoming.phase !== 'results') return incoming;
  if ((Number(existing.round) || 0) !== (Number(incoming.round) || 0)) return incoming;
  const rollback = {
    ...incoming,
    phase: 'judging',
    roundWinnerId: null,
    roundWinnerIds: [],
    revealEndsAt: null,
    activeSeatId: existing.activeSeatId || null,
  };
  if ((existing.judgeMode || 'zar') === 'vote') return rollback;
  const players = existing.players || [];
  const zar = players[Number(existing.zarIndex) || 0];
  const winnerId = String(incoming.roundWinnerId || '');
  const round = Number(existing.round) || 0;
  const valid =
    zar &&
    zar.id === actorId &&
    winnerId &&
    winnerId !== zar.id &&
    (existing.submissions || []).some(
      (s) => s && !s.rival && s.playerId === winnerId && (s.round == null || s.round === round)
    );
  if (!valid) return rollback;
  const scored = (incoming.players || []).map((p) =>
    p && p.id === winnerId ? { ...p, score: (Number(p.score) || 0) + 1 } : p
  );
  const target = Number(existing.targetScore) || 999;
  const hit = scored.some((p) => p && (Number(p.score) || 0) >= target);
  return {
    ...incoming,
    players: scored,
    roundWinnerId: winnerId,
    roundWinnerIds: [],
    phase: hit ? 'results' : 'reveal',
    activeSeatId: hit ? null : incoming.activeSeatId || winnerId,
    revealEndsAt: hit ? null : incoming.revealEndsAt || Date.now() + 5000,
  };
}

function stripHands(state) {
  if (!state || !Array.isArray(state.players)) return state;
  return { ...state, players: state.players.map((p) => (p ? { ...p, hand: [] } : p)) };
}

module.exports = {
  TOKEN_PREFIX,
  NICK_MAX,
  newToken,
  tokensKey,
  parseTokens,
  seatAuthOk,
  sanitizeNick,
  ballotError,
  isTwoPlayerVote,
  restrictIncoming,
  applyServerScoring,
  stripHands,
};
