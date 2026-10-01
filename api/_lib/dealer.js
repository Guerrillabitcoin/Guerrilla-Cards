/** Server mirror of src/engine/dealer.ts (single dealer enforcement). */
const HOST_GRACE_MS = 10000;

function fallbackDealerId(state) {
  const players = (state && state.players) || [];
  const w = players.find((p) => p && p.id === state.roundWinnerId);
  if (state.phase === 'reveal' && w && !w.isBot && !w.isHost) return w.id;
  const guest = players.find((p) => p && !p.isBot && !p.isHost);
  return guest ? guest.id : null;
}

/** May `actorId` push a round advance out of `existing` (reveal / discarding)? */
function mayAdvanceFrom(existing, actorId) {
  if (!existing || existing.mode === 'solo') return true;
  const players = existing.players || [];
  const host = players.find((p) => p && p.isHost);
  if (!host || host.id === actorId) return true;
  if (!actorId || fallbackDealerId(existing) !== actorId) return false;
  const now = Date.now();
  if (existing.phase === 'reveal') {
    const base = existing.revealEndsAt || existing.updatedAt || 0;
    return now > base + HOST_GRACE_MS - 1500;
  }
  if (existing.phase === 'discarding') {
    return now > (existing.updatedAt || 0) + HOST_GRACE_MS + 3500;
  }
  return true;
}

module.exports = { HOST_GRACE_MS, fallbackDealerId, mayAdvanceFrom };
