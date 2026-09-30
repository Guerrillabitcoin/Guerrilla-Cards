/**
 * Keep only this-round answers and freeze Zar reveal order.
 * Empty [] is truthy in JS — never treat it as a valid order.
 * During judging/reveal, submissions stay in frozen arrival order (never
 * alphabetical re-sort) so revealOrder indices / playerIds stay stable.
 */
function isIndexPerm(order, n) {
  if (!Array.isArray(order) || !n || order.length !== n) return false;
  const nums = order.map((x) => Number(x));
  return (
    nums.every((i) => Number.isInteger(i) && i >= 0 && i < n) &&
    new Set(nums).size === n
  );
}

function isPlayerIdPerm(order, playerIds) {
  if (!Array.isArray(order) || !Array.isArray(playerIds)) return false;
  if (!playerIds.length || order.length !== playerIds.length) return false;
  const ids = new Set(playerIds.map(String));
  if (ids.size !== playerIds.length) return false;
  const seen = new Set();
  for (const x of order) {
    const id = String(x);
    if (!ids.has(id) || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}

function isRedactedCardText(text) {
  if (text == null) return true;
  const t = String(text).trim();
  return t === '' || t === '…' || t === '...';
}

function hasRealCardText(cards) {
  return (cards || []).some((c) => c && !isRedactedCardText(c.text));
}

function sortSubsByPlayerId(subs) {
  return (subs || [])
    .slice()
    .sort((a, b) =>
      String((a && a.playerId) || '').localeCompare(
        String((b && b.playerId) || '')
      )
    );
}

/**
 * Union this-round !rival (and zar-exclude in judging/reveal) by playerId,
 * prefer real card text. In judging/reveal: order like existing
 * state.submissions (frozen). Submitting may sort by playerId.
 */
function currentRoundSubs(state) {
  const round = Number(state && state.round) || 0;
  const voteMode = ((state && state.judgeMode) || 'zar') === 'vote';
  const players = (state && state.players) || [];
  const zarIdx = Number(state && state.zarIndex);
  const zar = players[Number.isFinite(zarIdx) ? zarIdx : 0];
  let subs = ((state && state.submissions) || []).filter(
    (s) => s && !s.rival && (s.round == null || s.round === round)
  );
  const phase = state && state.phase;
  if (
    !voteMode &&
    zar &&
    zar.id &&
    (phase === 'judging' || phase === 'reveal')
  ) {
    subs = subs.filter((s) => s.playerId !== zar.id);
  }
  const byId = new Map();
  for (const s of subs) {
    if (!s.playerId) continue;
    const prev = byId.get(s.playerId);
    if (!prev) {
      byId.set(s.playerId, s);
      continue;
    }
    if (hasRealCardText(s.cards) && !hasRealCardText(prev.cards)) {
      byId.set(s.playerId, s);
    }
  }
  if (phase === 'judging' || phase === 'reveal') {
    const ids = Array.from(byId.keys());
    // Prefer revealOrder playerIds when it is a valid perm — keeps Opción
    // order and submissions array aligned across polls.
    if (isPlayerIdPerm(state && state.revealOrder, ids)) {
      return state.revealOrder.map((id) => byId.get(String(id))).filter(Boolean);
    }
    const frozen = [];
    const used = new Set();
    for (const s of (state && state.submissions) || []) {
      if (!s || !s.playerId) continue;
      const merged = byId.get(s.playerId);
      if (merged && !used.has(s.playerId)) {
        frozen.push(merged);
        used.add(s.playerId);
      }
    }
    for (const [id, s] of byId) {
      if (!used.has(id)) frozen.push(s);
    }
    return frozen;
  }
  // Submitting: stable alphabetical is fine (revealOrder still empty).
  return sortSubsByPlayerId(Array.from(byId.values()));
}

/**
 * Keep existing/incoming revealOrder when length matches and it is a valid
 * perm of indices OR of the given playerIds. Prefer playerId order when minting.
 */
function freezeRevealOrder(existingOrder, incomingOrder, n, playerIds) {
  const ids = Array.isArray(playerIds)
    ? playerIds.map(String).filter(Boolean)
    : [];
  if (ids.length === n && isPlayerIdPerm(existingOrder, ids)) {
    return existingOrder.slice();
  }
  if (isIndexPerm(existingOrder, n)) {
    return existingOrder.map((x) => Number(x));
  }
  if (ids.length === n && isPlayerIdPerm(incomingOrder, ids)) {
    return incomingOrder.slice();
  }
  if (isIndexPerm(incomingOrder, n)) {
    return incomingOrder.map((x) => Number(x));
  }
  if (ids.length === n && n > 0) {
    return ids.slice();
  }
  return Array.from({ length: n }, (_, i) => i);
}

function mergePlayerScores(existingPlayers, incomingPlayers) {
  const best = {};
  for (const list of [existingPlayers, incomingPlayers]) {
    for (const p of list || []) {
      if (!p || !p.id) continue;
      const n = Number(p.score);
      best[p.id] = Math.max(best[p.id] || 0, Number.isFinite(n) ? n : 0);
    }
  }
  const base =
    incomingPlayers && incomingPlayers.length
      ? incomingPlayers
      : existingPlayers || [];
  return base.map((p) =>
    p && p.id && best[p.id] != null ? { ...p, score: best[p.id] } : p
  );
}

function mergeLeagueMaps() {
  const out = {};
  for (let i = 0; i < arguments.length; i++) {
    const m = arguments[i];
    if (!m || typeof m !== 'object') continue;
    Object.keys(m).forEach((id) => {
      if (!id) return;
      const v = Number(m[id]) || 0;
      out[id] = Math.max(out[id] || 0, v);
    });
  }
  return out;
}

function sanitizeRoomState(state) {
  if (!state || typeof state !== 'object') return state;
  const phase = state.phase;
  if (phase !== 'submitting' && phase !== 'judging' && phase !== 'reveal') {
    return state;
  }
  const submissions = currentRoundSubs(state);
  if (phase === 'submitting') {
    return { ...state, submissions, revealOrder: [] };
  }
  const playerIds = submissions.map((s) => s && s.playerId).filter(Boolean);
  return {
    ...state,
    submissions,
    revealOrder: freezeRevealOrder(
      state.revealOrder,
      null,
      submissions.length,
      playerIds
    ),
  };
}

module.exports = {
  isIndexPerm,
  isPlayerIdPerm,
  sortSubsByPlayerId,
  currentRoundSubs,
  freezeRevealOrder,
  sanitizeRoomState,
  mergeLeagueMaps,
  mergePlayerScores,
};
