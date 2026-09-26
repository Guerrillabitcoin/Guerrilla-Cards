/**
 * Technical host only: rematch + prompt lock.
 * League totals always max-merge; rematch clears the award latch
 * so the next match can add +1.
 */
function hostIdOf(state) {
  const list = (state && state.players) || [];
  const host = list.find((p) => p && p.isHost);
  return host && host.id ? String(host.id) : '';
}

function isHostActor(state, actorId) {
  if (!actorId) return false;
  return hostIdOf(state) === String(actorId);
}

function maxLeague(a, b) {
  const out = {};
  for (const m of [a, b]) {
    if (!m || typeof m !== 'object') continue;
    Object.keys(m).forEach((id) => {
      if (!id) return;
      const v = Number(m[id]) || 0;
      out[id] = Math.max(out[id] || 0, v);
    });
  }
  return out;
}

function applyHostAuthority(existing, incoming, actorId) {
  if (!existing || !incoming) return { reject: false, state: incoming };
  const host =
    isHostActor(existing, actorId) || isHostActor(incoming, actorId);

  const incomingRematch =
    existing.phase === 'results' &&
    incoming.phase !== 'results' &&
    incoming.phase !== 'lobby' &&
    (Number(incoming.round) || 0) <= 1;
  if (incomingRematch && actorId && !host) {
    return { reject: true, state: existing };
  }

  let state = incoming;
  const sameRound =
    (Number(existing.round) || 0) === (Number(incoming.round) || 0);
  const inPlay =
    existing.phase !== 'lobby' &&
    incoming.phase !== 'lobby' &&
    existing.phase !== 'results' &&
    incoming.phase !== 'results';
  if (
    sameRound &&
    inPlay &&
    existing.currentPrompt &&
    incoming.currentPrompt &&
    existing.currentPrompt.id !== incoming.currentPrompt.id
  ) {
    state = {
      ...state,
      currentPrompt: host ? incoming.currentPrompt : existing.currentPrompt,
    };
  }

  const leagueScores = maxLeague(existing.leagueScores, state.leagueScores);
  if (incomingRematch) {
    state = { ...state, leagueScores, leagueAwarded: false };
  } else if (incoming.phase === 'results' && existing.phase === 'results') {
    state = {
      ...state,
      leagueScores,
      leagueAwarded: !!(existing.leagueAwarded || incoming.leagueAwarded),
    };
  } else {
    state = { ...state, leagueScores };
  }
  return { reject: false, state };
}

module.exports = {
  hostIdOf,
  isHostActor,
  applyHostAuthority,
};
