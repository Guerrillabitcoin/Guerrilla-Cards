/**
 * Keep only this-round answers and freeze Zar reveal order.
 * Empty [] is truthy in JS — never treat it as a valid order.
 */
function isIndexPerm(order, n) {
  if (!Array.isArray(order) || !n || order.length !== n) return false;
  const nums = order.map((x) => Number(x));
  return (
    nums.every((i) => Number.isInteger(i) && i >= 0 && i < n) &&
    new Set(nums).size === n
  );
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
  return sortSubsByPlayerId(Array.from(byId.values()));
}

function freezeRevealOrder(existingOrder, incomingOrder, n) {
  if (isIndexPerm(existingOrder, n)) return existingOrder.map((x) => Number(x));
  if (isIndexPerm(incomingOrder, n)) return incomingOrder.map((x) => Number(x));
  return Array.from({ length: n }, (_, i) => i);
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
  return {
    ...state,
    submissions,
    revealOrder: freezeRevealOrder(
      state.revealOrder,
      null,
      submissions.length
    ),
  };
}

module.exports = {
  isIndexPerm,
  sortSubsByPlayerId,
  currentRoundSubs,
  freezeRevealOrder,
  sanitizeRoomState,
};
