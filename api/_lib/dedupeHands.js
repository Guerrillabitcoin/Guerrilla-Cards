/**
 * v0.99.422.32 — cross-hand duplicate guard (server, inside the room lock).
 *
 * Concurrent submits/discards refill each hand from that client's own local deck, so two
 * players can draw the same replacement card (seen: GCSQ8 core-a-0304). After every merged
 * upsert we enforce: each answer id lives in at most one place (a hand OR a current
 * submission). Cards in play keep priority; among hands, the player who already held the card
 * in the pre-write server state keeps it. Every other copy is swapped in place for a fresh
 * server-deck card that is in no hand and not in play. Affected seats get
 * handFix[playerId] = ts so their client adopts the server hand (see GameContext).
 */
const { answerPool } = require('./serverDeck');

const PHASES = new Set(['submitting', 'judging', 'reveal', 'discarding']);

function dedupeHands(existing, state) {
  if (!state || !PHASES.has(state.phase) || !Array.isArray(state.players)) return state;
  const handFix = { ...((existing && existing.handFix) || {}) }; // server-only field
  const round = Number(state.round) || 0;
  const inPlay = new Set();
  for (const s of state.submissions || []) {
    if (!s || s.rival || !Array.isArray(s.cards)) continue;
    if (s.round != null && Number(s.round) !== round) continue;
    for (const c of s.cards) if (c && c.id) inPlay.add(c.id);
  }
  const prevOwner = new Map();
  for (const p of (existing && existing.players) || []) {
    for (const c of (p && p.hand) || []) if (c && c.id && !prevOwner.has(c.id)) prevOwner.set(c.id, p.id);
  }
  const owner = new Map(); // id → playerId that keeps it
  // Pass 1: previous server owner keeps its card.
  for (const p of state.players) {
    for (const c of (p && p.hand) || []) {
      if (!c || !c.id || inPlay.has(c.id) || owner.has(c.id)) continue;
      if (prevOwner.get(c.id) === p.id) owner.set(c.id, p.id);
    }
  }
  // Pass 2: first remaining claimant (seat order) keeps it.
  for (const p of state.players) {
    for (const c of (p && p.hand) || []) {
      if (!c || !c.id || inPlay.has(c.id) || owner.has(c.id)) continue;
      owner.set(c.id, p.id);
    }
  }
  const dups = []; // [playerIndex, cardIndex]
  const seenInHand = new Set();
  state.players.forEach((p, pi) => {
    ((p && p.hand) || []).forEach((c, ci) => {
      if (!c || !c.id) return;
      const key = `${p.id}\u0000${c.id}`;
      const dupSelf = seenInHand.has(key);
      seenInHand.add(key);
      if (inPlay.has(c.id) || owner.get(c.id) !== p.id || dupSelf) dups.push([pi, ci]);
    });
  });
  if (!dups.length) {
    return existing && existing.handFix ? { ...state, handFix } : stripClientHandFix(state);
  }
  const occupied = new Set(inPlay);
  for (const p of state.players) for (const c of (p && p.hand) || []) if (c && c.id) occupied.add(c.id);
  for (const p of (existing && existing.players) || []) for (const c of (p && p.hand) || []) if (c && c.id) occupied.add(c.id);
  const pool = answerPool(state.packIds).filter((c) => !occupied.has(c.id));
  const now = Date.now();
  const players = state.players.map((p) => (p ? { ...p, hand: (p.hand || []).slice() } : p));
  const drop = new Map(); // pi → Set(ci) when pool is empty
  const fixed = [];
  for (const [pi, ci] of dups) {
    const p = players[pi];
    const old = p.hand[ci];
    if (pool.length) {
      const j = Math.floor(Math.random() * pool.length);
      const fresh = pool[j];
      pool[j] = pool[pool.length - 1];
      pool.pop();
      p.hand[ci] = { ...fresh };
    } else {
      if (!drop.has(pi)) drop.set(pi, new Set());
      drop.get(pi).add(ci);
    }
    handFix[p.id] = now;
    fixed.push(`${p.id}:${old && old.id}`);
  }
  for (const [pi, set] of drop) players[pi].hand = players[pi].hand.filter((_, ci) => !set.has(ci));
  console.warn('dedupe_hands', state.code, `r${round}`, state.phase, fixed.join(','));
  return {
    ...state,
    players,
    handFix,
    updatedAt: Math.max(Number(state.updatedAt) || 0, now),
  };
}

function stripClientHandFix(state) {
  if (!state || !('handFix' in state)) return state;
  const { handFix, ...rest } = state; // never trust a client-sent handFix
  return rest;
}

module.exports = { dedupeHands };
